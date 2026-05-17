"""Builds and delivers reconnaissance digests from pending alerts.

Delivery channels are gated by the customer's plan. The actual send functions
are stubs for the MVP — wiring SMTP and the WhatsApp Business API is the next
milestone — but the channel-gating and alert lifecycle are real.
"""

from __future__ import annotations

import sqlite3

from .detection import PRICE_DROP, PRICE_RISE, UNDERCUT
from .plans import get_plan

_KIND_TITLES = {
    UNDERCUT: "Competitors undercutting you",
    PRICE_DROP: "Competitor price drops",
    PRICE_RISE: "Competitor price rises",
}


def build_digest(conn: sqlite3.Connection, customer_id: int) -> str | None:
    """Render a text digest of undelivered alerts, or None if there are none."""
    customer = conn.execute(
        "SELECT * FROM customers WHERE id = ?", (customer_id,)
    ).fetchone()
    if customer is None:
        raise ValueError(f"Customer {customer_id} not found")

    alerts = conn.execute(
        "SELECT kind, message FROM alerts WHERE customer_id = ? AND delivered = 0 "
        "ORDER BY kind, created_at",
        (customer_id,),
    ).fetchall()
    if not alerts:
        return None

    lines = [
        f"Reconicas — competition report for {customer['name']}",
        "=" * 48,
        "",
    ]
    for kind, title in _KIND_TITLES.items():
        group = [a for a in alerts if a["kind"] == kind]
        if not group:
            continue
        lines.append(f"{title} ({len(group)})")
        lines.extend(f"  - {a['message']}" for a in group)
        lines.append("")

    lines.append(f"{len(alerts)} update(s) since your last report.")
    return "\n".join(lines)


def _send_email(to: str, body: str) -> None:
    print(f"[email -> {to}]\n{body}\n")


def _send_whatsapp(to: str, body: str) -> None:
    print(f"[whatsapp -> {to}]\n{body}\n")


def _publish_dashboard(customer_id: int, body: str) -> None:
    print(f"[dashboard -> customer {customer_id}] digest ready ({len(body)} chars)")


def deliver_digests(conn: sqlite3.Connection) -> list[dict]:
    """Build and deliver digests to every customer with pending alerts."""
    delivered: list[dict] = []
    for customer in conn.execute("SELECT * FROM customers").fetchall():
        digest = build_digest(conn, customer["id"])
        if digest is None:
            continue

        channels = get_plan(customer["plan"]).channels
        if "email" in channels:
            _send_email(customer["email"], digest)
        if "whatsapp" in channels:
            _send_whatsapp(customer["email"], digest)
        if "dashboard" in channels:
            _publish_dashboard(customer["id"], digest)

        conn.execute(
            "UPDATE alerts SET delivered = 1 WHERE customer_id = ? AND delivered = 0",
            (customer["id"],),
        )
        delivered.append(
            {"customer_id": customer["id"], "channels": sorted(channels)}
        )

    conn.commit()
    return delivered
