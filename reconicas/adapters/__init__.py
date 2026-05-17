"""Storefront platform adapters."""

from __future__ import annotations

from .base import PlatformAdapter, ProductData
from .salla import SallaAdapter

_ADAPTERS: dict[str, type[PlatformAdapter]] = {
    "salla": SallaAdapter,
}


def get_adapter(platform: str) -> PlatformAdapter:
    try:
        return _ADAPTERS[platform]()
    except KeyError:
        raise ValueError(
            f"No adapter for platform {platform!r}. "
            f"Available: {', '.join(_ADAPTERS)}"
        ) from None


__all__ = ["PlatformAdapter", "ProductData", "SallaAdapter", "get_adapter"]
