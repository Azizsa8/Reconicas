"""Shared test fixtures and helpers."""

from __future__ import annotations

import os
import shutil
from pathlib import Path

import pytest


def _detect_chrome() -> bool:
    """Best-effort check for a real Google Chrome installation.

    The ``real_chrome=True`` fetcher option requires the system Chrome
    binary (not the Playwright-bundled chromium).  Probe the usual
    locations on macOS / Linux / Windows.
    """
    if shutil.which("google-chrome") or shutil.which("google-chrome-stable"):
        return True
    candidates = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/opt/google/chrome/chrome",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ]
    return any(Path(p).exists() for p in candidates)


CHROME_AVAILABLE = _detect_chrome()
SKIP_REAL_CHROME = pytest.mark.skipif(
    not CHROME_AVAILABLE,
    reason="real_chrome=True requires a Google Chrome installation",
)


@pytest.fixture(scope="session")
def chrome_available() -> bool:
    """Pytest fixture exposing ``CHROME_AVAILABLE`` to tests."""
    return CHROME_AVAILABLE
