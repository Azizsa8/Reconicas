"""Salla storefront adapter.

Strategy: Salla themes emit standard schema.org JSON-LD ``Product`` blocks on
product pages, and stores publish an XML sitemap. We discover candidate URLs
from the sitemap and read prices from JSON-LD — both are machine-readable web
standards, which keeps extraction resilient to theme/layout changes.

Only publicly visible storefront data is read. Nothing behind a login.
"""

from __future__ import annotations

import json
import re
import xml.etree.ElementTree as ET

from scrapling.fetchers import Fetcher

from .base import PlatformAdapter, ProductData

_JSONLD_RE = re.compile(
    r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
    re.IGNORECASE | re.DOTALL,
)


def _normalize_availability(value: str | None) -> str | None:
    if not value:
        return None
    return value.rstrip("/").rsplit("/", 1)[-1] or None


def _coerce_price(value: object) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return None


def _iter_jsonld_objects(html: str):
    """Yield every JSON object embedded in ld+json blocks, flattening @graph."""
    for raw in _JSONLD_RE.findall(html):
        try:
            data = json.loads(raw.strip())
        except json.JSONDecodeError:
            continue
        stack = [data]
        while stack:
            item = stack.pop()
            if isinstance(item, list):
                stack.extend(item)
            elif isinstance(item, dict):
                if "@graph" in item and isinstance(item["@graph"], list):
                    stack.extend(item["@graph"])
                yield item


def _types(obj: dict) -> set[str]:
    t = obj.get("@type", "")
    return {t} if isinstance(t, str) else set(t)


def extract_product_from_jsonld(html: str, page_url: str) -> ProductData | None:
    """Pure parser: build a ProductData from a page's JSON-LD, or None.

    Separated from network I/O so it can be unit tested with fixture HTML.
    """
    for obj in _iter_jsonld_objects(html):
        if "Product" not in _types(obj):
            continue

        offers = obj.get("offers")
        if isinstance(offers, list):
            offers = offers[0] if offers else {}
        if not isinstance(offers, dict):
            offers = {}

        price = _coerce_price(offers.get("price") or offers.get("lowPrice"))
        if price is None:
            continue

        sku = obj.get("sku") or obj.get("mpn")
        external_id = str(obj.get("productID") or sku or page_url)
        name = obj.get("name")
        if not isinstance(name, str) or not name.strip():
            continue

        return ProductData(
            external_id=external_id,
            name=name.strip(),
            url=page_url,
            price=price,
            currency=offers.get("priceCurrency") or "SAR",
            sku=str(sku) if sku else None,
            availability=_normalize_availability(
                (offers.get("availability") if isinstance(offers, dict) else None)
            ),
        )
    return None


class SallaAdapter(PlatformAdapter):
    platform = "salla"

    def __init__(self, request_timeout: int = 30):
        self.request_timeout = request_timeout

    def _get(self, url: str):
        return Fetcher.get(url, timeout=self.request_timeout, stealthy_headers=True)

    def _sitemap_locs(self, url: str, depth: int = 0) -> list[str]:
        """Return <loc> entries from a sitemap, descending into sitemap indexes."""
        try:
            resp = self._get(url)
        except Exception:
            return []
        if resp.status != 200:
            return []
        try:
            root = ET.fromstring(resp.body)
        except ET.ParseError:
            return []

        ns = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
        locs = [el.text.strip() for el in root.iter(f"{ns}loc") if el.text]

        if root.tag == f"{ns}sitemapindex" and depth < 2:
            # Prefer sub-sitemaps that look product-specific to avoid waste.
            product_maps = [u for u in locs if "product" in u.lower()] or locs
            collected: list[str] = []
            for sub in product_maps:
                collected.extend(self._sitemap_locs(sub, depth + 1))
            return collected
        return locs

    def discover_product_urls(self, store_url: str, limit: int | None = None) -> list[str]:
        base = store_url.rstrip("/")
        urls: list[str] = []
        seen: set[str] = set()
        for loc in self._sitemap_locs(f"{base}/sitemap.xml"):
            if loc in seen:
                continue
            seen.add(loc)
            urls.append(loc)
        return urls

    def parse_product(self, product_url: str) -> ProductData | None:
        try:
            resp = self._get(product_url)
        except Exception:
            return None
        if resp.status != 200:
            return None
        return extract_product_from_jsonld(resp.body.decode("utf-8", "ignore"), product_url)
