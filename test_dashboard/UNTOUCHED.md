# Untouched-tests report

Inventory of every `scrapling/` module without a dedicated
`tests/.../test_<name>.py` file. Each entry lists its size, public
surface, indirect coverage from other tests, suggested priority, and a
concrete proposal for the missing test file.

Generated against `main @ 4cbc388` plus the Wave-1/2 PR.

## Legend

| Priority | Meaning |
|---|---|
| **P0** | Core logic, zero coverage anywhere. Author tests next sprint. |
| **P1** | Real logic, indirectly exercised. Add focused unit tests soon. |
| **P2** | Thin wrapper / glue code. Add tests when touching the file. |

---

## P0 — fully untouched

### `scrapling/core/translator.py` · 134 loc · 4 classes
**Public surface:** `XPathExpr`, `TranslatorProtocol`, `TranslatorMixin`,
`HTMLTranslator`, plus `css_to_xpath`, `from_xpath`, `join`,
`xpath_element`, `xpath_pseudo_element`,
`xpath_attr_functional_pseudo_element`.

**Indirect coverage:** 0 test files reference `HTMLTranslator`.

**Risk:** CSS-to-XPath translation is the foundation under every CSS
selector call. A regression here silently breaks user queries.

**Proposed test:** `tests/parser/test_translator.py`

```python
from scrapling.core.translator import HTMLTranslator

def test_basic_css_to_xpath():
    t = HTMLTranslator()
    assert t.css_to_xpath("div.foo") == "descendant-or-self::div[@class and contains(concat(' ', normalize-space(@class), ' '), ' foo ')]"

def test_pseudo_first_child(): ...
def test_attribute_contains(): ...
def test_nth_child_translation(): ...
def test_join_combinators(): ...
def test_xpathexpr_repr(): ...
# Pin Scrapling-specific divergences from parsel here so any drift is loud.
```

Estimate: ~30 min, ~80 LOC.

---

### `scrapling/core/mixins.py` · 90 loc · 1 class
**Public surface:** `SelectorsGeneration` (`generate_css_selector`,
`generate_full_css_selector`, `generate_xpath_selector`,
`generate_full_xpath_selector`).

**Indirect coverage:** 0 test files reference it.

**Risk:** This mixin is what powers “round-trip” selector generation
(give me a selector for *this* element). It is used by AI tooling and
selector-similarity. Breaking it silently breaks LLM workflows.

**Proposed test:** `tests/parser/test_selectors_generation.py`

```python
from scrapling import Selector

HTML = """<div id='root'><ul><li class='a'>1</li><li class='a b'>2</li></ul></div>"""

def test_generate_css_selector_uses_id_when_unique(): ...
def test_generate_full_css_selector_walks_ancestors(): ...
def test_generate_xpath_selector_handles_classes(): ...
def test_generate_full_xpath_selector_is_absolute(): ...
def test_round_trip_select_then_regenerate_matches_same_node(): ...
```

Estimate: ~45 min, ~120 LOC.

---

## P1 — real logic, indirectly exercised, no dedicated tests

### `scrapling/engines/static.py` · **783 loc** · 3 classes
**Public surface:** `FetcherSession`, `FetcherClient`,
`AsyncFetcherClient` (+ `get`/`post`/`put`/`delete` on each).

**Indirect coverage:** 4 test files reference these (`test_requests`,
`test_requests_session`, async equivalents). Behaviour is exercised but
internals like retry, redirect, header merging, proxy rotation
plumbing, etc. are not.

**Risk:** Largest file in the package with the broadest user-visible
surface. Static fetchers are the default path most consumers hit.

**Proposed test:** `tests/fetchers/test_static_internals.py` — unit
tests for the private helpers (`_merge_headers`, `_resolve_proxy`,
`_build_session`, retry policy, timeout handling) that the behavioural
tests can’t reach without spinning up an HTTP server.

Estimate: ~3 h, ~250 LOC. Best to split into 2 PRs (sync first, async
second).

---

### `scrapling/core/custom_types.py` · 345 loc · 3 classes
**Public surface:** `TextHandler`, `TextHandlers`, `AttributesHandler`
plus 36 method shims.

**Indirect coverage:** Only 1 test file imports `TextHandler` directly.
The handlers are used everywhere via `Selector(...).text`, so the
default path is exercised, but specific helpers (`split`, `strip`,
`capitalize`, `expandtabs`, regex helpers) aren’t pinned.

**Proposed test:** `tests/parser/test_text_handlers.py`

Parametrize over the 30+ string-style helpers and assert they preserve
the `TextHandler` type. Then a focused block for `re_first`, `re_all`,
JSON parsing, type coercion.

Estimate: ~1 h, ~150 LOC.

---

### `scrapling/engines/toolbelt/convertor.py` · 323 loc · 1 class
**Public surface:** `ResponseFactory.from_playwright_response`,
`from_async_playwright_response`, `from_http_request`.

**Indirect coverage:** 1 reference, via integration tests that also
need a browser.

**Risk:** Conversion bugs surface as wrong status codes, missing
cookies, or wrong encoding in the user-facing `Response` object.

**Proposed test:** `tests/fetchers/test_response_factory.py` using
fake Playwright/HTTPX response objects (no real browser needed) →
unblocks regression catching without the chromium dependency.

Estimate: ~1.5 h, ~180 LOC.

---

### `scrapling/engines/toolbelt/custom.py` · 307 loc · 3 classes
**Public surface:** `Response`, `BaseFetcher`, `StatusText` plus
helpers `body`, `follow`, `display_config`, `configure`, `get`.

**Indirect coverage:** 1 test references `BaseFetcher`.

**Proposed test:** `tests/fetchers/test_response_model.py` — checks
attribute coercion, `.follow()`, cookies, byte/text body access,
`display_config` snapshotting.

Estimate: ~1 h, ~120 LOC.

---

### `scrapling/engines/toolbelt/fingerprints.py` · 59 loc · 2 funcs
**Public surface:** `get_os_name`, `generate_headers`.

**Indirect coverage:** 1 test references the helpers; the deterministic
seed path and OS-detection branches aren’t exercised.

**Proposed test:** `tests/fetchers/test_fingerprints.py` — patch the
OS-detection (`sys.platform`) and assert the User-Agent / `Sec-CH-UA`
headers look right for each branch.

Estimate: ~20 min, ~50 LOC.

---

## P2 — already exercised behaviourally, dedicated tests would be nice

### `scrapling/fetchers/chrome.py` · 97 loc
`DynamicFetcher` wrapper around the engine. Already exercised by
`tests/fetchers/{sync,async}/test_dynamic.py`. A dedicated unit test
file isn’t critical, but a `tests/fetchers/test_dynamic_fetcher_unit.py`
covering its argument-validation branches without launching a browser
would let us catch wiring bugs in the Chromium-less CI path.

Estimate: ~30 min, ~60 LOC.

---

### `scrapling/spiders/templates/crawler.py` · 72 loc
`CrawlRule`, `CrawlSpider`. Exercised by `tests/spiders/test_templates.py`,
which is in the green column. No new file needed; flag if behaviour
drifts.

---

## Tracking summary

| Module | Priority | Existing coverage | Proposed file | Est. work |
|---|---|---|---|---|
| `core/translator.py` | P0 | none | `tests/parser/test_translator.py` | 30 min |
| `core/mixins.py` | P0 | none | `tests/parser/test_selectors_generation.py` | 45 min |
| `engines/static.py` | P1 | indirect (4 files) | `tests/fetchers/test_static_internals.py` | 3 h |
| `core/custom_types.py` | P1 | indirect (1) | `tests/parser/test_text_handlers.py` | 1 h |
| `engines/toolbelt/convertor.py` | P1 | indirect (1) | `tests/fetchers/test_response_factory.py` | 1.5 h |
| `engines/toolbelt/custom.py` | P1 | indirect (1) | `tests/fetchers/test_response_model.py` | 1 h |
| `engines/toolbelt/fingerprints.py` | P1 | indirect (1) | `tests/fetchers/test_fingerprints.py` | 20 min |
| `fetchers/chrome.py` | P2 | yes (4 files) | `tests/fetchers/test_dynamic_fetcher_unit.py` | 30 min |
| `spiders/templates/crawler.py` | P2 | yes (1 file) | _(no new file)_ | – |

**Total proposed:** 7 new test files, ~9 hours of engineering work,
~960 LOC of new test code.

---

## Manual steps that need your call

These can’t be done autonomously by an agent — they require your
judgement:

1. **Confirm P0 priorities** before I author the two P0 test files.
   The translator file is a parsel fork; you may want to keep it
   loosely tested on purpose. Decide:
   - ship the strict tests as-is, or
   - pin only the Scrapling-specific divergences.
2. **Decide the static.py split.** Either:
   - one large `test_static_internals.py` (faster but harder to review), or
   - one PR per public class (`FetcherSession`, `FetcherClient`,
     `AsyncFetcherClient`).
3. **Approve the test-data fixtures.** A couple of the proposed tests
   need fake `playwright.Response` objects. Confirm you’re fine with us
   building them as plain dataclasses inside the test module rather
   than vendoring Playwright internals.
4. **Schedule the Wave 4 (ROADMAP) work.** Pagination detection,
   schema auto-detect, page analyzer, regex generator, and the Scrapy
   plugin are net-new features. Each needs a design discussion before
   coding. Best handled as separate issues.
