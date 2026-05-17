"""Undercut and price-movement detection.

Pure logic, no I/O — the scanner feeds it rows and persists what it returns.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Alert kinds
PRICE_DROP = "price_drop"
PRICE_RISE = "price_rise"
UNDERCUT = "undercut"


@dataclass
class PendingAlert:
    kind: str
    message: str
    old_price: float | None = None
    new_price: float | None = None


def normalize_name(name: str) -> str:
    """Lowercase and collapse whitespace for fuzzy name matching."""
    return re.sub(r"\s+", " ", name.strip().lower())


def price_change_alert(
    product_name: str,
    old_price: float | None,
    new_price: float,
) -> PendingAlert | None:
    """Alert when a tracked competitor product's price moves between scans."""
    if old_price is None or old_price == new_price:
        return None
    if new_price < old_price:
        pct = (old_price - new_price) / old_price * 100
        return PendingAlert(
            kind=PRICE_DROP,
            message=(
                f"{product_name}: competitor dropped price "
                f"{old_price:.2f} → {new_price:.2f} (-{pct:.0f}%)"
            ),
            old_price=old_price,
            new_price=new_price,
        )
    pct = (new_price - old_price) / old_price * 100
    return PendingAlert(
        kind=PRICE_RISE,
        message=(
            f"{product_name}: competitor raised price "
            f"{old_price:.2f} → {new_price:.2f} (+{pct:.0f}%)"
        ),
        old_price=old_price,
        new_price=new_price,
    )


def match_own_product(
    competitor_sku: str | None,
    competitor_name: str,
    own_products: list[dict],
) -> dict | None:
    """Match a competitor product to one of the customer's own products.

    SKU match is exact and preferred; name match is a normalized fallback.
    ``own_products`` rows must expose ``sku``, ``name`` and ``price``.
    """
    if competitor_sku:
        for own in own_products:
            if own.get("sku") and str(own["sku"]) == str(competitor_sku):
                return own

    target = normalize_name(competitor_name)
    for own in own_products:
        if normalize_name(own["name"]) == target:
            return own
    return None


def undercut_alert(
    competitor_name: str,
    competitor_price: float,
    own_product: dict,
) -> PendingAlert | None:
    """Alert when a competitor prices a matched product below the customer."""
    own_price = own_product["price"]
    if competitor_price >= own_price:
        return None
    gap = (own_price - competitor_price) / own_price * 100
    return PendingAlert(
        kind=UNDERCUT,
        message=(
            f"{own_product['name']}: competitor sells '{competitor_name}' at "
            f"{competitor_price:.2f} — {gap:.0f}% below your {own_price:.2f}"
        ),
        old_price=own_price,
        new_price=competitor_price,
    )
