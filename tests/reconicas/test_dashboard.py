import pytest

from reconicas import dashboard
from reconicas import db as _db


@pytest.fixture
def db_path(tmp_path):
    path = tmp_path / "reconicas.db"
    _db.init_db(path)
    return path


def _seed(conn, plan="starter"):
    customer_id = conn.execute(
        "INSERT INTO customers (name, email, plan, currency) VALUES (?, ?, ?, ?)",
        ("Aziz Store", "aziz@example.com", plan, "SAR"),
    ).lastrowid
    competitor_id = conn.execute(
        "INSERT INTO competitors (customer_id, label, platform, store_url) "
        "VALUES (?, ?, 'salla', ?)",
        (customer_id, "Rival", "https://rival.salla.sa"),
    ).lastrowid
    product_id = conn.execute(
        "INSERT INTO products (competitor_id, external_id, sku, name, url) "
        "VALUES (?, '12345', 'OUD-50', 'Oud Perfume', 'https://rival.salla.sa/p')",
        (competitor_id,),
    ).lastrowid
    conn.execute(
        "INSERT INTO price_snapshots (product_id, price, currency) VALUES (?, ?, 'SAR')",
        (product_id, 199.0),
    )
    conn.execute(
        "INSERT INTO alerts (customer_id, competitor_id, product_id, kind, message) "
        "VALUES (?, ?, ?, 'undercut', 'Rival undercuts you')",
        (customer_id, competitor_id, product_id),
    )
    conn.commit()
    return customer_id, competitor_id, product_id


def test_customers_view_counts(db_path):
    conn = _db.connect(db_path)
    _seed(conn)
    rows = dashboard.customers_view(conn)
    conn.close()
    assert len(rows) == 1
    assert rows[0]["competitor_count"] == 1
    assert rows[0]["pending_alerts"] == 1


def test_customer_view_populated_for_dashboard_plan(db_path):
    conn = _db.connect(db_path)
    customer_id, _, _ = _seed(conn, plan="starter")
    view = dashboard.customer_view(conn, customer_id)
    conn.close()
    assert view["dashboard_enabled"] is True
    assert len(view["competitors"]) == 1
    assert view["competitors"][0]["product_count"] == 1
    assert len(view["alerts"]) == 1


def test_customer_view_gated_on_free_plan(db_path):
    conn = _db.connect(db_path)
    customer_id, _, _ = _seed(conn, plan="free")
    view = dashboard.customer_view(conn, customer_id)
    conn.close()
    assert view["dashboard_enabled"] is False
    assert view["competitors"] == []
    assert view["alerts"] == []


def test_customer_view_missing_returns_none(db_path):
    conn = _db.connect(db_path)
    assert dashboard.customer_view(conn, 999) is None
    conn.close()


def test_competitor_view_latest_price(db_path):
    conn = _db.connect(db_path)
    _, competitor_id, product_id = _seed(conn)
    conn.execute(
        "INSERT INTO price_snapshots (product_id, price, currency) VALUES (?, ?, 'SAR')",
        (product_id, 149.0),
    )
    conn.commit()
    view = dashboard.competitor_view(conn, competitor_id)
    conn.close()
    assert len(view["products"]) == 1
    assert view["products"][0]["latest_price"] == 149.0


def test_product_view_history_newest_first(db_path):
    conn = _db.connect(db_path)
    _, _, product_id = _seed(conn)
    conn.execute(
        "INSERT INTO price_snapshots (product_id, price, currency, scanned_at) "
        "VALUES (?, 149.0, 'SAR', '2099-01-01 00:00:00')",
        (product_id,),
    )
    conn.commit()
    view = dashboard.product_view(conn, product_id)
    conn.close()
    assert len(view["history"]) == 2
    assert view["history"][0]["price"] == 149.0
    assert view["product"]["competitor_label"] == "Rival"


def test_route_index_and_pages(db_path):
    conn = _db.connect(db_path)
    customer_id, competitor_id, product_id = _seed(conn)

    status, body = dashboard._route(conn, "/")
    assert status == 200 and "Reconicas dashboard" in body

    status, body = dashboard._route(conn, f"/customer/{customer_id}")
    assert status == 200 and "Rival" in body

    status, body = dashboard._route(conn, f"/competitor/{competitor_id}")
    assert status == 200 and "Oud Perfume" in body

    status, body = dashboard._route(conn, f"/product/{product_id}")
    assert status == 200 and "Price history" in body

    status, _ = dashboard._route(conn, "/customer/999")
    assert status == 404
    status, _ = dashboard._route(conn, "/nonsense")
    assert status == 404
    conn.close()


def test_route_escapes_html(db_path):
    conn = _db.connect(db_path)
    conn.execute(
        "INSERT INTO customers (name, email, plan) VALUES (?, ?, 'starter')",
        ("<script>alert(1)</script>", "x@example.com"),
    )
    conn.commit()
    status, body = dashboard._route(conn, "/")
    conn.close()
    assert status == 200
    assert "<script>alert(1)</script>" not in body
    assert "&lt;script&gt;" in body
