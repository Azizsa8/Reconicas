"""Fixed-size worker pool that drains the scan-job queue.

The pool size is an operator-set constant. Whether the platform has one
customer or ten thousand, exactly ``max_workers`` scrapes run at once — that
is the whole point of the queue-based design.
"""

from __future__ import annotations

import sqlite3
import threading
from pathlib import Path

from . import db as _db
from .scanner import run_scan


def _claim_job(conn: sqlite3.Connection) -> sqlite3.Row | None:
    """Atomically take one queued job and mark it running."""
    conn.execute("BEGIN IMMEDIATE")
    try:
        job = conn.execute(
            "SELECT * FROM scan_jobs WHERE status = 'queued' ORDER BY id LIMIT 1"
        ).fetchone()
        if job is None:
            conn.execute("ROLLBACK")
            return None
        conn.execute(
            "UPDATE scan_jobs SET status = 'running', started_at = datetime('now') "
            "WHERE id = ?",
            (job["id"],),
        )
        conn.execute("COMMIT")
        return job
    except Exception:
        conn.execute("ROLLBACK")
        raise


def _worker_loop(db_path: str | Path, results: list) -> None:
    conn = _db.connect(db_path)
    try:
        while True:
            job = _claim_job(conn)
            if job is None:
                return
            try:
                summary = run_scan(conn, job["competitor_id"])
                conn.execute(
                    "UPDATE scan_jobs SET status = 'done', "
                    "finished_at = datetime('now') WHERE id = ?",
                    (job["id"],),
                )
                conn.commit()
                results.append({"job_id": job["id"], "ok": True, **summary})
            except Exception as exc:  # noqa: BLE001 - record failure, keep draining
                conn.execute(
                    "UPDATE scan_jobs SET status = 'failed', "
                    "finished_at = datetime('now'), error = ? WHERE id = ?",
                    (str(exc), job["id"]),
                )
                conn.commit()
                results.append({"job_id": job["id"], "ok": False, "error": str(exc)})
    finally:
        conn.close()


def run_workers(db_path: str | Path = _db.DEFAULT_DB_PATH, max_workers: int = 3) -> list:
    """Drain the queue with a fixed pool. Returns per-job result summaries."""
    results: list = []
    threads = [
        threading.Thread(target=_worker_loop, args=(db_path, results), daemon=True)
        for _ in range(max(1, max_workers))
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    return results
