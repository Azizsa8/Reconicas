"""Shared test fixtures and helpers.

Detects which browser binaries are available on the host and converts
the corresponding "binary missing" failures into informative skips,
so a fresh `pip install -r tests/requirements.txt && pytest` produces a
clean signal instead of dozens of identical playwright launch errors.
"""

from __future__ import annotations

import os
import shutil
from pathlib import Path

import pytest

# ---------------------------------------------------------------------------
# Binary detection
# ---------------------------------------------------------------------------

def _detect_chrome() -> bool:
    """Real Google Chrome (not the Playwright-bundled chromium)."""
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


def _detect_chromium() -> bool:
    """Playwright's chromium download (`playwright install chromium`).

    Uses Playwright's own bookkeeping when available, so we detect the
    version Playwright actually expects (not just *some* chromium on disk).
    """
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            exe = Path(p.chromium.executable_path)
            return exe.exists()
    except Exception:
        pass
    # Fallback: look in the standard download roots.
    roots = [
        Path.home() / ".cache" / "ms-playwright",
        Path.home() / "Library" / "Caches" / "ms-playwright",
        Path(os.environ.get("PLAYWRIGHT_BROWSERS_PATH", "/opt/pw-browsers")),
    ]
    if "LOCALAPPDATA" in os.environ:
        roots.append(Path(os.environ["LOCALAPPDATA"]) / "ms-playwright")
    for root in roots:
        if not root.exists():
            continue
        for entry in root.iterdir():
            if entry.name.startswith("chromium-"):
                for binname in ("chrome", "chrome.exe", "headless_shell", "headless_shell.exe"):
                    if any(entry.rglob(binname)):
                        return True
    return False


def _detect_camoufox() -> bool:
    """Camoufox download (`camoufox fetch`) — used by StealthyFetcher."""
    if shutil.which("camoufox"):
        try:
            import camoufox  # noqa: F401
        except ImportError:
            return False
    roots = [
        Path.home() / ".cache" / "camoufox",
        Path.home() / "Library" / "Caches" / "camoufox",
    ]
    if "LOCALAPPDATA" in os.environ:
        roots.append(Path(os.environ["LOCALAPPDATA"]) / "camoufox")
    return any(p.exists() and any(p.iterdir()) for p in roots if p.exists())


CHROME_AVAILABLE = _detect_chrome()
CHROMIUM_AVAILABLE = _detect_chromium()
CAMOUFOX_AVAILABLE = _detect_camoufox()


SKIP_REAL_CHROME = pytest.mark.skipif(
    not CHROME_AVAILABLE,
    reason="real_chrome=True requires Google Chrome — install Chrome or unset real_chrome",
)
SKIP_NO_CHROMIUM = pytest.mark.skipif(
    not CHROMIUM_AVAILABLE,
    reason="Playwright Chromium not installed — run `python -m playwright install chromium`",
)
SKIP_NO_CAMOUFOX = pytest.mark.skipif(
    not CAMOUFOX_AVAILABLE,
    reason="Camoufox not installed — run `python -m camoufox fetch`",
)

# Files whose tests universally require a given browser binary.
_CHROMIUM_FILES = (
    "tests/fetchers/async/test_dynamic.py",
    "tests/fetchers/async/test_dynamic_session.py",
    "tests/fetchers/sync/test_dynamic.py",
)
_CAMOUFOX_FILES = (
    "tests/fetchers/async/test_stealth.py",
    "tests/fetchers/async/test_stealth_session.py",
    "tests/fetchers/sync/test_stealth_session.py",
)

# tests/ai/test_ai_mcp.py is mixed: TestNormalizeCredentials and a couple
# of get tests are static-fetcher-only.  Map each subtest to the binary
# it actually exercises.
_AI_MCP_FILE = "tests/ai/test_ai_mcp.py"
_AI_MCP_STATIC_ONLY = {
    "TestMCPServer::test_get_tool",
    "TestMCPServer::test_bulk_get_tool",
}  # plus the entire TestNormalizeCredentials class
_AI_MCP_NEEDS_CAMOUFOX_KEYWORDS = ("stealthy",)


def _ai_mcp_required_binary(nid: str) -> str | None:
    """Return 'chromium', 'camoufox', or None for an ai/test_ai_mcp.py nodeid."""
    if "TestNormalizeCredentials" in nid:
        return None
    short = nid.split(_AI_MCP_FILE + "::", 1)[-1]
    if short in _AI_MCP_STATIC_ONLY:
        return None
    name = short.rsplit("::", 1)[-1]
    if any(k in name for k in _AI_MCP_NEEDS_CAMOUFOX_KEYWORDS):
        return "camoufox"
    return "chromium"


def pytest_collection_modifyitems(config, items):  # noqa: ARG001
    """Stamp browser-dep tests with the right skip marker when binaries are missing."""
    if CHROMIUM_AVAILABLE and CAMOUFOX_AVAILABLE:
        return
    for item in items:
        nid = item.nodeid.replace(os.sep, "/")
        if not CHROMIUM_AVAILABLE and any(nid.startswith(f) for f in _CHROMIUM_FILES):
            item.add_marker(SKIP_NO_CHROMIUM)
        if not CAMOUFOX_AVAILABLE and any(nid.startswith(f) for f in _CAMOUFOX_FILES):
            item.add_marker(SKIP_NO_CAMOUFOX)
        if nid.startswith(_AI_MCP_FILE):
            need = _ai_mcp_required_binary(nid)
            if need == "chromium" and not CHROMIUM_AVAILABLE:
                item.add_marker(SKIP_NO_CHROMIUM)
            elif need == "camoufox" and not CAMOUFOX_AVAILABLE:
                item.add_marker(SKIP_NO_CAMOUFOX)


def pytest_report_header(config):  # noqa: ARG001
    """Surface the detected browser state at the top of pytest output."""
    return [
        f"browser detection: "
        f"chrome={'yes' if CHROME_AVAILABLE else 'no'}, "
        f"chromium={'yes' if CHROMIUM_AVAILABLE else 'no'}, "
        f"camoufox={'yes' if CAMOUFOX_AVAILABLE else 'no'}",
    ]


@pytest.fixture(scope="session")
def chrome_available() -> bool:
    return CHROME_AVAILABLE


@pytest.fixture(scope="session")
def chromium_available() -> bool:
    return CHROMIUM_AVAILABLE


@pytest.fixture(scope="session")
def camoufox_available() -> bool:
    return CAMOUFOX_AVAILABLE
