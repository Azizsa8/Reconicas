"""SQLite storage for Reconicas.

SQLite is intentional for the MVP: it doubles as the persistent job queue,
so no Redis/broker is needed and the worker concurrency stays a fixed,
operator-controlled number.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

DEFAULT_DB_PATH = Path("reconicas.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS customers (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL,
    plan          TEXT NOT NULL DEFAULT 'free',
    currency      TEXT NOT NULL DEFAULT 'SAR',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS competitors (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id   INTEGER NOT NULL REFERENCES customers(id),
    label         TEXT NOT NULL,
    platform      TEXT NOT NULL DEFAULT 'salla',
    store_url     TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    competitor_id INTEGER NOT NULL REFERENCES competitors(id),
    external_id   TEXT NOT NULL,
    sku           TEXT,
    name          TEXT NOT NULL,
    url           TEXT NOT NULL,
    first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(competitor_id, external_id)
);

CREATE TABLE IF NOT EXISTS price_snapshots (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id    INTEGER NOT NULL REFERENCES products(id),
    price         REAL NOT NULL,
    currency      TEXT NOT NULL DEFAULT 'SAR',
    availability  TEXT,
    scanned_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The customer's own catalog, used to detect when a competitor undercuts them.
CREATE TABLE IF NOT EXISTS own_products (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id   INTEGER NOT NULL REFERENCES customers(id),
    sku           TEXT,
    name          TEXT NOT NULL,
    price         REAL NOT NULL,
    currency      TEXT NOT NULL DEFAULT 'SAR'
);

-- Persistent scan queue. status: queued -> running -> done | failed
CREATE TABLE IF NOT EXISTS scan_jobs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    competitor_id INTEGER NOT NULL REFERENCES competitors(id),
    status        TEXT NOT NULL DEFAULT 'queued',
    enqueued_at   TEXT NOT NULL DEFAULT (datetime('now')),
    started_at    TEXT,
    finished_at   TEXT,
    error         TEXT
);

CREATE TABLE IF NOT EXISTS alerts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id   INTEGER NOT NULL REFERENCES customers(id),
    competitor_id INTEGER NOT NULL REFERENCES competitors(id),
    product_id    INTEGER REFERENCES products(id),
    kind          TEXT NOT NULL,
    message       TEXT NOT NULL,
    old_price     REAL,
    new_price     REAL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    delivered     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_snapshots_product ON price_snapshots(product_id, scanned_at);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON scan_jobs(status);
CREATE INDEX IF NOT EXISTS idx_alerts_customer ON alerts(customer_id, delivered);
"""


def connect(db_path: str | Path = DEFAULT_DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path), timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_db(db_path: str | Path = DEFAULT_DB_PATH) -> None:
    conn = connect(db_path)
    try:
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()
