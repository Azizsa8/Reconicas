"""Platform adapter interface.

Each storefront platform (Salla, Zid, ...) gets one adapter. The scanner only
ever talks to this interface, so adding Zid later means adding one file.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class ProductData:
    """A single product as observed on a competitor storefront."""

    external_id: str
    name: str
    url: str
    price: float
    currency: str = "SAR"
    sku: str | None = None
    availability: str | None = None


class PlatformAdapter(ABC):
    """Reads a competitor storefront and returns its catalog with prices."""

    platform: str = "base"

    @abstractmethod
    def discover_product_urls(self, store_url: str, limit: int | None = None) -> list[str]:
        """Return product page URLs for the store, capped at ``limit``."""

    @abstractmethod
    def parse_product(self, product_url: str) -> ProductData | None:
        """Fetch and parse one product page. Returns None if it is not a product."""

    def scan(self, store_url: str, limit: int | None = None) -> list[ProductData]:
        """Discover and parse the catalog. Default impl walks every URL."""
        products: list[ProductData] = []
        for url in self.discover_product_urls(store_url, limit=limit):
            product = self.parse_product(url)
            if product is not None:
                products.append(product)
            if limit is not None and len(products) >= limit:
                break
        return products
