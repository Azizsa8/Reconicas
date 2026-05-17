"""Runs a single competitor scan: fetch catalog, store prices, raise alerts."""

from __future__ import annotations

import sqlite3

from . import detection
from .adapters import get_adapter
from .plans import get_plan


def _upsert_product(conn: sqlite3.Connection, competitor_id: int, product) -> int:
    """Insert or update a product row, returning its id."""
    row = conn.execute(
        "SELECT id FROM products WHERE competitor_id = ? AND external_id = ?",
        (competitor_id, product.external_id),
    ).fetchone()
    if row:
        conn.execute(
            "UPDATE products SET name = ?, url = ?, sku = ?, "
            "last_seen_at = datetime('now') WHERE id = ?",
            (product.name, product.url, product.sku, row["id"]),
        )
        return row["id"]
    cur = conn.execute(
        "INSERT INTO products (competitor_id, external_id, sku, name, url) "
        "VALUES (?, ?, ?, ?, ?)",
        (competitor_id, product.external_id, product.sku, product.name, product.url),
    )
    return cur.lastrowid


def _last_price(conn: sqlite3.Connection, product_id: int) -> float | None:
    row = conn.execute(
        "SELECT price FROM price_snapshots WHERE product_id = ? "
        "ORDER BY scanned_at DESC, id DESC LIMIT 1",
        (product_id,),
    ).fetchone()
    return row["price"] if row else None


def _record_alert(conn, customer_id, competitor_id, product_id, alert) -> None:
    conn.execute(
        "INSERT INTO alerts (customer_id, competitor_id, product_id, kind, "
        "message, old_price, new_price) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            customer_id,
            competitor_id,
            product_id,
            alert.kind,
            alert.message,
            alert.old_price,
            alert.new_price,
        ),
    )


def run_scan(conn: sqlite3.Connection, competitor_id: int) -> dict:
    """Scan one competitor. Returns a summary dict.

    Raises if the competitor or its customer cannot be found.
    """
    competitor = conn.execute(
        "SELECT * FROM competitors WHERE id = ?", (competitor_id,)
    ).fetchone()
    if competitor is None:
        raise ValueError(f"Competitor {competitor_id} not found")

    customer = conn.execute(
        "SELECT * FROM customers WHERE id = ?", (competitor["customer_id"],)
    ).fetchone()
    if customer is None:
        raise ValueError(f"Customer for competitor {competitor_id} not found")

    plan = get_plan(customer["plan"])
    own_products = [
        dict(r)
        for r in conn.execute(
            "SELECT sku, name, price FROM own_products WHERE customer_id = ?",
            (customer["id"],),
        ).fetchall()
    ]

    adapter = get_adapter(competitor["platform"])
    scraped = adapter.scan(competitor["store_url"], limit=plan.max_products)

    alerts_raised = 0
    for product in scraped:
        product_id = _upsert_product(conn, competitor_id, product)
        previous = _last_price(conn, product_id)

        conn.execute(
            "INSERT INTO price_snapshots (product_id, price, currency, availability) "
            "VALUES (?, ?, ?, ?)",
            (product_id, product.price, product.currency, product.availability),
        )

        change = detection.price_change_alert(product.name, previous, product.price)
        if change is not None:
            _record_alert(conn, customer["id"], competitor_id, product_id, change)
            alerts_raised += 1

        # Only evaluate undercut on first sighting or when the price moved,
        # so the digest does not repeat the same alert every scan.
        if previous is None or previous != product.price:
            own = detection.match_own_product(product.sku, product.name, own_products)
            if own is not None:
                under = detection.undercut_alert(product.name, product.price, own)
                if under is not None:
                    _record_alert(
                        conn, customer["id"], competitor_id, product_id, under
                    )
                    alerts_raised += 1

    conn.commit()
    return {
        "competitor_id": competitor_id,
        "products_scanned": len(scraped),
        "alerts_raised": alerts_raised,
    }
