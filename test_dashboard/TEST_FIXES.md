# Test-suite fix plan

Triage of the **58 failures / 725 tests** captured in
`test_dashboard/pytest_report.json` and the strategy for closing them in
waves.

## Baseline (before this PR)

| Bucket | Count | Cause |
|---|---|---|
| `missing_browser: chromium` | 45 | Playwright Chromium not on disk |
| `missing_browser: chrome (real_chrome=True)` | 4 | System Google Chrome not present |
| `missing_dep: markdownify` | 7 | `markdownify` only in `[ai,shell]` extras |
| `missing_dep: IPython` | 2 | `IPython` only in `[shell]` extras |
| **Total** | **58** | **0 are code defects — all infrastructure** |

The shipped tests that exercise scraping logic, parsing, spiders,
checkpoints, robotstxt, sitemap parsing, scheduler, etc. are **all
green** (667 passing).

---

## Wave 1 — landed in this PR

1. **`tests/conftest.py`** introduces `SKIP_REAL_CHROME` — a session-wide
   marker that detects whether system Chrome is installed (Linux, macOS
   and Windows paths) and skips parametrizations that hard-require it.
2. **`tests/fetchers/sync/test_dynamic.py`** and
   **`tests/fetchers/async/test_dynamic.py`** wrap the two
   `real_chrome=True` parametrizations in `pytest.param(..., marks=SKIP_REAL_CHROME)`.
   These now skip cleanly on Chrome-less machines instead of dying inside
   playwright with an unhelpful traceback.
3. **`tests/requirements.txt`** adds `markdownify` and `IPython` so a
   bare `pip install -r tests/requirements.txt` is enough to run the
   non-browser tests; CI keeps using tox extras and is unchanged.
4. **Dashboard regenerated** — the gallery, Next Movements list, and
   per-feature screens reflect the new state.

Estimated outcome on CI: the 4 `test_properties[kwargs0|kwargs3]`
failures stop being flaky on runners that don't ship Chrome, and local
contributors stop seeing 9 spurious failures the first time they run
the suite.

---

## Wave 2 — defensive skips for missing browser

CI installs `chromium` via `playwright install chromium`. Local
contributors may not — the typical first run produces ~45 noisy
failures. Plan:

- Mirror the Chrome detection: add `CHROMIUM_AVAILABLE` to `conftest.py`
  by probing `~/.cache/ms-playwright` / `~/Library/Caches/ms-playwright`
  / `%LOCALAPPDATA%\ms-playwright`. If absent, raise a clear
  pytest-warning at session start and skip the entire `fetchers/sync`,
  `fetchers/async`, `ai/test_ai_mcp.py` test files.
- Same treatment for **Camoufox** (used by StealthyFetcher). Detect the
  `camoufox` binary via `camoufox path` or its cache directory.
- Land this as a single small PR so contributors get an actionable
  message:

  ```
  Skipped 49 browser tests — run `python -m playwright install chromium`
  and `python -m camoufox fetch` to enable them.
  ```

Why a separate PR: blanket-skipping is a policy change and should not
ride into the gallery PR.

---

## Wave 3 — fill the coverage gaps surfaced by the Next Movements list

The dashboard's “source modules without a matching test file” box
lists every `scrapling/` module that has no `tests/.../test_<name>.py`
counterpart. Walk that list, decide per module:

- **Trivial wrappers** (`__init__`, `_types`, constants) — no test
  needed, suppress in the dashboard via an allowlist.
- **Real logic** (e.g. `scrapling/core/translator.py`,
  `scrapling/engines/toolbelt/*`) — open a tracking issue per module
  with one failing skeleton test to anchor the work.

This is the biggest body of work. Expect 6–10 new test files; do them
as one PR per feature area so reviewers can stay focused.

---

## Wave 4 — ROADMAP follow-throughs

Two ROADMAP items are still open:

- `Add functionality to automatically detect pagination URLs`
- `Add the ability to auto-detect schemas in pages and manipulate them`
- `Add analyzer ability that tries to learn about the page through meta-elements`
- `Add the ability to generate a regex from a group of elements`
- `Create a Scrapy plugin/decorator to make it replace parsel in the response argument when needed`

Each needs both an implementation and a `tests/parser/test_<name>.py`.
Track in a roadmap issue and gate the dashboard's “unfinished” counter
on whether their test file exists.

---

## Wave 5 — keep the dashboard honest

Add a tiny pre-commit/CI step that fails if `pytest_report.json` is
older than the latest `tests/` change, so the dashboard never silently
drifts out of date. Two-liner in `.pre-commit-config.yaml`.

---

## Verification

After Wave 1 (this PR), in an environment that has Chromium + the
test deps:

```bash
pip install -r tests/requirements.txt
pip install -e .[ai,shell]
python -m playwright install chromium
python -m pytest tests/ \
  --json-report --json-report-file=test_dashboard/pytest_report.json \
  -p no:cacheprovider -o addopts=""
python test_dashboard/generate.py
```

Expected: 0 failures on a CI-equivalent runner; up to 4 skipped
(`real_chrome=True`) on machines without Google Chrome installed.
