import pytest

from reconicas import db as _db
from reconicas import scanner
from reconicas.adapters.base import ProductData
from reconicas.detection import PRICE_DROP, UNDERCUT
from reconicas.digest import build_digest, deliver_digests
from reconicas.scheduler import schedule_scans
from reconicas.worker import run_workers


class FakeAdapter:
    """Stand-in for a real platform adapter; returns a fixed catalog."""

    def __init__(self, products):
        self._products = products

    def scan(self, store_url, limit=None):
        items = self._products
        return items if limit is None else items[:limit]


@pytest.fixture
def db_path(tmp_path):
    path = tmp_path / "reconicas.db"
    _db.init_db(path)
    return path


def _seed_customer(conn, plan="starter"):
    customer_id = conn.execute(
        "INSERT INTO customers (name, email, plan) VALUES (?, ?, ?)",
        ("Aziz Store", "aziz@example.com", plan),
    ).lastrowid
    competitor_id = conn.execute(
        "INSERT INTO competitors (customer_id, label, platform, store_url) "
        "VALUES (?, ?, ?, ?)",
        (customer_id, "Rival", "salla", "https://rival.salla.sa"),
    ).lastrowid
    conn.commit()
    return customer_id, competitor_id


def test_full_pipeline_detects_undercut(db_path, monkeypatch):
    conn = _db.connect(db_path)
    customer_id, _ = _seed_customer(conn)
    conn.execute(
        "INSERT INTO own_products (customer_id, sku, name, price) VALUES (?, ?, ?, ?)",
        (customer_id, "OUD-50", "Oud Perfume 50ml", 250.0),
    )
    conn.commit()
    conn.close()

    catalog = [
        ProductData("12345", "Oud Perfume 50ml", "u1", 199.0, sku="OUD-50"),
        ProductData("999", "Random Item", "u2", 50.0, sku="R-1"),
    ]
    monkeypatch.setattr(scanner, "get_adapter", lambda platform: FakeAdapter(catalog))

    conn = _db.connect(db_path)
    assert schedule_scans(conn) == 1
    conn.close()

    results = run_workers(db_path, max_workers=2)
    assert len(results) == 1 and results[0]["ok"]

    conn = _db.connect(db_path)
    snapshots = conn.execute("SELECT COUNT(*) c FROM price_snapshots").fetchone()["c"]
    assert snapshots == 2

    alert = conn.execute(
        "SELECT * FROM alerts WHERE kind = ?", (UNDERCUT,)
    ).fetchone()
    assert alert is not None
    assert alert["new_price"] == 199.0

    digest = build_digest(conn, customer_id)
    assert digest is not None and "undercutting" in digest

    delivered = deliver_digests(conn)
    assert delivered and "dashboard" in delivered[0]["channels"]
    pending = conn.execute(
        "SELECT COUNT(*) c FROM alerts WHERE delivered = 0"
    ).fetchone()["c"]
    assert pending == 0
    conn.close()


def test_price_drop_detected_across_scans(db_path, monkeypatch):
    conn = _db.connect(db_path)
    _, competitor_id = _seed_customer(conn)

    first = [ProductData("12345", "Oud Perfume", "u1", 199.0, sku="OUD-50")]
    second = [ProductData("12345", "Oud Perfume", "u1", 149.0, sku="OUD-50")]

    monkeypatch.setattr(scanner, "get_adapter", lambda p: FakeAdapter(first))
    scanner.run_scan(conn, competitor_id)

    monkeypatch.setattr(scanner, "get_adapter", lambda p: FakeAdapter(second))
    summary = scanner.run_scan(conn, competitor_id)
    assert summary["alerts_raised"] >= 1

    drop = conn.execute("SELECT * FROM alerts WHERE kind = ?", (PRICE_DROP,)).fetchone()
    assert drop is not None
    assert drop["old_price"] == 199.0 and drop["new_price"] == 149.0
    conn.close()


def test_scheduler_respects_competitor_limit(db_path, monkeypatch):
    conn = _db.connect(db_path)
    # Free plan allows only 1 competitor.
    customer_id = conn.execute(
        "INSERT INTO customers (name, email, plan) VALUES (?, ?, 'free')",
        ("Solo", "solo@example.com"),
    ).lastrowid
    for i in range(3):
        conn.execute(
            "INSERT INTO competitors (customer_id, label, platform, store_url) "
            "VALUES (?, ?, 'salla', ?)",
            (customer_id, f"c{i}", f"https://c{i}.salla.sa"),
        )
    conn.commit()
    assert schedule_scans(conn) == 1
    conn.close()
