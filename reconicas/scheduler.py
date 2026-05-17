"""Enqueues scan jobs at each customer's plan-defined cadence.

This is where two plan limits are enforced: how many competitors a customer
may track, and how often each one is scanned. Nothing here scrapes — it only
writes rows to the ``scan_jobs`` queue.
"""

from __future__ import annotations

import sqlite3

from .plans import get_plan


def _has_open_job(conn: sqlite3.Connection, competitor_id: int) -> bool:
    row = conn.execute(
        "SELECT 1 FROM scan_jobs WHERE competitor_id = ? "
        "AND status IN ('queued', 'running') LIMIT 1",
        (competitor_id,),
    ).fetchone()
    return row is not None


def _hours_since_last_scan(conn: sqlite3.Connection, competitor_id: int) -> float | None:
    row = conn.execute(
        "SELECT (julianday('now') - julianday(finished_at)) * 24 AS hrs "
        "FROM scan_jobs WHERE competitor_id = ? AND status = 'done' "
        "ORDER BY finished_at DESC LIMIT 1",
        (competitor_id,),
    ).fetchone()
    return row["hrs"] if row and row["hrs"] is not None else None


def schedule_scans(conn: sqlite3.Connection) -> int:
    """Enqueue due scans for every customer. Returns the number enqueued."""
    enqueued = 0
    for customer in conn.execute("SELECT id, plan FROM customers").fetchall():
        plan = get_plan(customer["plan"])
        # Competitor-count limit: only the first N competitors are scanned.
        competitors = conn.execute(
            "SELECT id FROM competitors WHERE customer_id = ? "
            "ORDER BY id LIMIT ?",
            (customer["id"], plan.max_competitors),
        ).fetchall()

        for competitor in competitors:
            cid = competitor["id"]
            if _has_open_job(conn, cid):
                continue
            elapsed = _hours_since_last_scan(conn, cid)
            if elapsed is not None and elapsed < plan.scan_interval_hours:
                continue
            conn.execute(
                "INSERT INTO scan_jobs (competitor_id, status) VALUES (?, 'queued')",
                (cid,),
            )
            enqueued += 1

    conn.commit()
    return enqueued
