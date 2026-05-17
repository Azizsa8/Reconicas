"""Read-only web dashboard for Reconicas.

A user-facing surface that only reads pre-computed data — it never triggers a
scrape. The data layer (the ``*_view`` functions) is pure: it takes a
connection and returns plain dicts, so it can be tested without HTTP.

The dashboard channel is plan-gated exactly like digest delivery: a customer
whose plan does not include the ``dashboard`` channel sees an upgrade prompt
instead of the overview.

Built on the standard library only, so it adds no dependency to the project.
"""

from __future__ import annotations

import html
import sqlite3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

from . import db as _db
from .plans import get_plan

_LATEST_PRICE = (
    "SELECT price FROM price_snapshots WHERE product_id = p.id "
    "ORDER BY scanned_at DESC, id DESC LIMIT 1"
)
_LATEST_SCAN = (
    "SELECT scanned_at FROM price_snapshots WHERE product_id = p.id "
    "ORDER BY scanned_at DESC, id DESC LIMIT 1"
)


# --- data layer (pure: conn in, dicts out) --------------------------------


def customers_view(conn: sqlite3.Connection) -> list[dict]:
    """Every customer with their competitor count and pending-alert count."""
    rows = conn.execute(
        "SELECT c.id, c.name, c.email, c.plan, c.currency, "
        "(SELECT COUNT(*) FROM competitors WHERE customer_id = c.id) "
        "  AS competitor_count, "
        "(SELECT COUNT(*) FROM alerts "
        "  WHERE customer_id = c.id AND delivered = 0) AS pending_alerts "
        "FROM customers c ORDER BY c.id"
    ).fetchall()
    return [dict(r) for r in rows]


def customer_view(conn: sqlite3.Connection, customer_id: int) -> dict | None:
    """Overview for one customer, or None if the customer does not exist.

    The returned dict always carries ``dashboard_enabled``; the detailed
    sections are only populated when the customer's plan grants dashboard
    access.
    """
    customer = conn.execute(
        "SELECT * FROM customers WHERE id = ?", (customer_id,)
    ).fetchone()
    if customer is None:
        return None

    plan = get_plan(customer["plan"])
    enabled = "dashboard" in plan.channels
    view: dict = {
        "customer": dict(customer),
        "plan": plan,
        "dashboard_enabled": enabled,
        "competitors": [],
        "alerts": [],
        "own_products": [],
    }
    if not enabled:
        return view

    view["competitors"] = [
        dict(r)
        for r in conn.execute(
            "SELECT co.id, co.label, co.platform, co.store_url, "
            "(SELECT COUNT(*) FROM products WHERE competitor_id = co.id) "
            "  AS product_count, "
            "(SELECT MAX(finished_at) FROM scan_jobs "
            "  WHERE competitor_id = co.id AND status = 'done') AS last_scan "
            "FROM competitors co WHERE co.customer_id = ? ORDER BY co.id",
            (customer_id,),
        ).fetchall()
    ]
    view["alerts"] = [
        dict(r)
        for r in conn.execute(
            "SELECT kind, message, old_price, new_price, created_at, delivered "
            "FROM alerts WHERE customer_id = ? "
            "ORDER BY created_at DESC, id DESC LIMIT 50",
            (customer_id,),
        ).fetchall()
    ]
    view["own_products"] = [
        dict(r)
        for r in conn.execute(
            "SELECT sku, name, price, currency FROM own_products "
            "WHERE customer_id = ? ORDER BY name",
            (customer_id,),
        ).fetchall()
    ]
    return view


def competitor_view(conn: sqlite3.Connection, competitor_id: int) -> dict | None:
    """A competitor's tracked products with their latest observed price."""
    competitor = conn.execute(
        "SELECT * FROM competitors WHERE id = ?", (competitor_id,)
    ).fetchone()
    if competitor is None:
        return None

    products = [
        dict(r)
        for r in conn.execute(
            f"SELECT p.id, p.name, p.sku, p.url, "
            f"({_LATEST_PRICE}) AS latest_price, "
            f"({_LATEST_SCAN}) AS latest_scan "
            f"FROM products p WHERE p.competitor_id = ? ORDER BY p.name",
            (competitor_id,),
        ).fetchall()
    ]
    return {"competitor": dict(competitor), "products": products}


def product_view(conn: sqlite3.Connection, product_id: int) -> dict | None:
    """A tracked product with its full price-snapshot history."""
    product = conn.execute(
        "SELECT p.*, co.label AS competitor_label, co.id AS competitor_id "
        "FROM products p JOIN competitors co ON co.id = p.competitor_id "
        "WHERE p.id = ?",
        (product_id,),
    ).fetchone()
    if product is None:
        return None

    history = [
        dict(r)
        for r in conn.execute(
            "SELECT price, currency, availability, scanned_at "
            "FROM price_snapshots WHERE product_id = ? "
            "ORDER BY scanned_at DESC, id DESC",
            (product_id,),
        ).fetchall()
    ]
    return {"product": dict(product), "history": history}


# --- rendering -------------------------------------------------------------

_STYLE = """
body { font-family: system-ui, sans-serif; margin: 2rem auto; max-width: 60rem;
       color: #1a1a1a; line-height: 1.5; padding: 0 1rem; }
h1, h2 { font-weight: 600; }
a { color: #1864ab; text-decoration: none; }
a:hover { text-decoration: underline; }
table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
th, td { text-align: left; padding: .4rem .6rem; border-bottom: 1px solid #e5e5e5; }
th { background: #f5f5f5; }
.crumbs { color: #888; font-size: .9rem; margin-bottom: 1rem; }
.tag { display: inline-block; padding: .1rem .5rem; border-radius: .6rem;
       font-size: .8rem; background: #e7f5ff; color: #1864ab; }
.notice { background: #fff3bf; border: 1px solid #ffe066; padding: 1rem;
          border-radius: .4rem; }
.undercut { color: #c92a2a; }
.empty { color: #888; font-style: italic; }
"""


_DASH = "<span class='empty'>—</span>"
_NEVER = "<span class='empty'>never</span>"


def _esc(value) -> str:
    return html.escape("" if value is None else str(value))


def _page(title: str, body: str) -> str:
    return (
        "<!doctype html><html lang='en'><head><meta charset='utf-8'>"
        f"<title>{_esc(title)}</title><style>{_STYLE}</style></head>"
        f"<body>{body}</body></html>"
    )


def _money(value, currency: str) -> str:
    if value is None:
        return "<span class='empty'>—</span>"
    return f"{float(value):.2f}&nbsp;{_esc(currency)}"


def render_customers(customers: list[dict]) -> str:
    rows = "".join(
        f"<tr><td><a href='/customer/{c['id']}'>{_esc(c['name'])}</a></td>"
        f"<td><span class='tag'>{_esc(c['plan'])}</span></td>"
        f"<td>{c['competitor_count']}</td>"
        f"<td>{c['pending_alerts']}</td></tr>"
        for c in customers
    )
    if not rows:
        rows = "<tr><td colspan='4' class='empty'>No customers yet.</td></tr>"
    body = (
        "<h1>Reconicas dashboard</h1>"
        "<table><tr><th>Customer</th><th>Plan</th>"
        "<th>Competitors</th><th>Pending alerts</th></tr>"
        f"{rows}</table>"
    )
    return _page("Reconicas dashboard", body)


def render_customer(view: dict) -> str:
    customer = view["customer"]
    plan = view["plan"]
    crumbs = "<div class='crumbs'><a href='/'>Customers</a> / " + _esc(
        customer["name"]
    ) + "</div>"
    header = (
        f"<h1>{_esc(customer['name'])}</h1>"
        f"<p>{_esc(customer['email'])} &middot; "
        f"<span class='tag'>{_esc(plan.name)} plan</span></p>"
    )

    if not view["dashboard_enabled"]:
        body = (
            crumbs + header
            + "<div class='notice'>The web dashboard is available on the "
            "Starter and Pro plans. Upgrade to view competitor pricing and "
            "alert history here.</div>"
        )
        return _page(customer["name"], body)

    comp_rows = "".join(
        f"<tr><td><a href='/competitor/{c['id']}'>{_esc(c['label'])}</a></td>"
        f"<td>{_esc(c['platform'])}</td>"
        f"<td>{c['product_count']}</td>"
        f"<td>{_esc(c['last_scan']) or _NEVER}</td>"
        "</tr>"
        for c in view["competitors"]
    )
    if not comp_rows:
        comp_rows = "<tr><td colspan='4' class='empty'>No competitors.</td></tr>"
    competitors = (
        "<h2>Competitors</h2><table><tr><th>Label</th><th>Platform</th>"
        f"<th>Products</th><th>Last scan</th></tr>{comp_rows}</table>"
    )

    alert_rows = "".join(
        f"<tr><td>{_esc(a['kind'])}</td>"
        f"<td class='{'undercut' if a['kind'] == 'undercut' else ''}'>"
        f"{_esc(a['message'])}</td>"
        f"<td>{'sent' if a['delivered'] else 'pending'}</td>"
        f"<td>{_esc(a['created_at'])}</td></tr>"
        for a in view["alerts"]
    )
    if not alert_rows:
        alert_rows = "<tr><td colspan='4' class='empty'>No alerts yet.</td></tr>"
    alerts = (
        "<h2>Recent alerts</h2><table><tr><th>Kind</th><th>Message</th>"
        f"<th>Status</th><th>Raised</th></tr>{alert_rows}</table>"
    )

    own_rows = "".join(
        f"<tr><td>{_esc(p['name'])}</td><td>{_esc(p['sku'])}</td>"
        f"<td>{_money(p['price'], p['currency'])}</td></tr>"
        for p in view["own_products"]
    )
    if not own_rows:
        own_rows = "<tr><td colspan='3' class='empty'>No catalog yet.</td></tr>"
    own = (
        "<h2>Your catalog</h2><table><tr><th>Product</th><th>SKU</th>"
        f"<th>Price</th></tr>{own_rows}</table>"
    )

    return _page(
        customer["name"], crumbs + header + competitors + alerts + own
    )


def render_competitor(view: dict) -> str:
    competitor = view["competitor"]
    crumbs = (
        "<div class='crumbs'><a href='/'>Customers</a> / "
        f"<a href='/customer/{competitor['customer_id']}'>customer "
        f"{competitor['customer_id']}</a> / {_esc(competitor['label'])}</div>"
    )
    rows = "".join(
        f"<tr><td><a href='/product/{p['id']}'>{_esc(p['name'])}</a></td>"
        f"<td>{_esc(p['sku'])}</td>"
        f"<td>{_money(p['latest_price'], 'SAR')}</td>"
        f"<td>{_esc(p['latest_scan']) or _DASH}</td>"
        "</tr>"
        for p in view["products"]
    )
    if not rows:
        rows = "<tr><td colspan='4' class='empty'>No products tracked.</td></tr>"
    body = (
        crumbs
        + f"<h1>{_esc(competitor['label'])}</h1>"
        + f"<p><a href='{_esc(competitor['store_url'])}'>"
        f"{_esc(competitor['store_url'])}</a></p>"
        + "<table><tr><th>Product</th><th>SKU</th><th>Latest price</th>"
        f"<th>Last seen</th></tr>{rows}</table>"
    )
    return _page(competitor["label"], body)


def render_product(view: dict) -> str:
    product = view["product"]
    crumbs = (
        "<div class='crumbs'><a href='/'>Customers</a> / "
        f"<a href='/competitor/{product['competitor_id']}'>"
        f"{_esc(product['competitor_label'])}</a> / "
        f"{_esc(product['name'])}</div>"
    )
    rows = "".join(
        f"<tr><td>{_esc(h['scanned_at'])}</td>"
        f"<td>{_money(h['price'], h['currency'])}</td>"
        f"<td>{_esc(h['availability'])}</td></tr>"
        for h in view["history"]
    )
    if not rows:
        rows = "<tr><td colspan='3' class='empty'>No price snapshots.</td></tr>"
    body = (
        crumbs
        + f"<h1>{_esc(product['name'])}</h1>"
        + f"<p><a href='{_esc(product['url'])}'>{_esc(product['url'])}</a></p>"
        + "<h2>Price history</h2>"
        + "<table><tr><th>Scanned at</th><th>Price</th>"
        f"<th>Availability</th></tr>{rows}</table>"
    )
    return _page(product["name"], body)


# --- HTTP server -----------------------------------------------------------


def _route(conn: sqlite3.Connection, path: str) -> tuple[int, str]:
    """Resolve a request path to an (HTTP status, HTML body) pair."""
    parts = [p for p in path.strip("/").split("/") if p]

    if not parts:
        return 200, render_customers(customers_view(conn))

    if len(parts) == 2 and parts[1].isdigit():
        ident = int(parts[1])
        if parts[0] == "customer":
            view = customer_view(conn, ident)
            if view is not None:
                return 200, render_customer(view)
        elif parts[0] == "competitor":
            view = competitor_view(conn, ident)
            if view is not None:
                return 200, render_competitor(view)
        elif parts[0] == "product":
            view = product_view(conn, ident)
            if view is not None:
                return 200, render_product(view)

    return 404, _page("Not found", "<h1>404</h1><p><a href='/'>Home</a></p>")


def make_handler(db_path: str):
    """Build a request handler bound to a database path.

    A fresh connection is opened per request: sqlite connections are not
    thread-safe and the server is threaded.
    """

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802 (stdlib-mandated name)
            path = urlparse(self.path).path
            conn = _db.connect(db_path)
            try:
                status, body = _route(conn, path)
            finally:
                conn.close()
            encoded = body.encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)

        def log_message(self, fmt: str, *args) -> None:
            # Quieter than the default stderr line per request.
            print(f"[dashboard] {self.address_string()} {fmt % args}")

    return Handler


def serve(db_path: str, host: str = "127.0.0.1", port: int = 8000) -> None:
    """Run the dashboard server until interrupted."""
    server = ThreadingHTTPServer((host, port), make_handler(db_path))
    print(f"Reconicas dashboard on http://{host}:{port} (db: {db_path})")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nDashboard stopped.")
    finally:
        server.server_close()
