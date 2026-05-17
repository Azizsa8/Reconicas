import pytest

from reconicas.plans import PLANS, get_plan


def test_plan_tiers_present():
    assert set(PLANS) == {"free", "starter", "pro"}


def test_scan_interval_hours():
    assert get_plan("free").scan_interval_hours == 168
    assert get_plan("starter").scan_interval_hours == 24
    assert get_plan("pro").scan_interval_hours == 12


def test_limits_increase_with_tier():
    free, starter, pro = get_plan("free"), get_plan("starter"), get_plan("pro")
    assert free.max_competitors < starter.max_competitors < pro.max_competitors
    assert pro.max_products is None
    assert pro.api_access and not free.api_access


def test_channels_gated_by_tier():
    assert get_plan("free").channels == {"email"}
    assert "whatsapp" in get_plan("pro").channels
    assert "whatsapp" not in get_plan("starter").channels


def test_unknown_plan_raises():
    with pytest.raises(ValueError):
        get_plan("enterprise")
