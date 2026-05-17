from reconicas import detection


def test_price_drop_alert():
    alert = detection.price_change_alert("Shirt", 100.0, 80.0)
    assert alert is not None
    assert alert.kind == detection.PRICE_DROP
    assert alert.old_price == 100.0 and alert.new_price == 80.0
    assert "-20%" in alert.message


def test_price_rise_alert():
    alert = detection.price_change_alert("Shirt", 100.0, 125.0)
    assert alert is not None
    assert alert.kind == detection.PRICE_RISE
    assert "+25%" in alert.message


def test_no_alert_when_unchanged_or_first_seen():
    assert detection.price_change_alert("Shirt", 100.0, 100.0) is None
    assert detection.price_change_alert("Shirt", None, 100.0) is None


def test_match_own_product_prefers_sku():
    own = [
        {"sku": "A1", "name": "Blue Shirt", "price": 90.0},
        {"sku": "B2", "name": "Red Shirt", "price": 70.0},
    ]
    match = detection.match_own_product("B2", "completely different name", own)
    assert match["sku"] == "B2"


def test_match_own_product_falls_back_to_name():
    own = [{"sku": None, "name": "Blue  Shirt", "price": 90.0}]
    match = detection.match_own_product(None, "  blue shirt ", own)
    assert match is not None and match["price"] == 90.0


def test_undercut_alert_only_when_cheaper():
    own = {"sku": "A1", "name": "Blue Shirt", "price": 100.0}
    assert detection.undercut_alert("Rival Shirt", 100.0, own) is None
    alert = detection.undercut_alert("Rival Shirt", 75.0, own)
    assert alert is not None
    assert alert.kind == detection.UNDERCUT
    assert "25%" in alert.message
