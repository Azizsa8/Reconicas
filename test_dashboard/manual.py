#!/usr/bin/env python3
"""Generate the manual-work HTML page (test_dashboard/manual.html).

Standalone view of every task that needs human judgement (decisions,
scheduling, approvals, external setup).  Each card has a checkbox and a
copy button; a floating "Generate combined prompt" assembles a single
Claude-ready prompt from the selected items.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from html import escape
from pathlib import Path

OUT = Path(__file__).resolve().parent / "manual.html"

# ---------------------------------------------------------------------------
# The manual-task catalogue.  Edit this list — everything else is
# generated from it.
# ---------------------------------------------------------------------------

TASKS = [
    # ---------------------------------------------------------------- decisions
    {
        "id": "D1",
        "category": "Decision",
        "priority": "P0",
        "title": "Translator test strategy: strict pin vs. divergence-only",
        "owner": "Maintainer",
        "estimate": "10 min discussion",
        "context": (
            "scrapling/core/translator.py is an adapted fork of parsel's "
            "CSS→XPath translator. Wave 3 includes a new "
            "tests/parser/test_translator.py — but its scope is your call."
        ),
        "options": [
            ("Strict pin (recommended)",
             "Tests assert exact XPath strings for the full surface. "
             "Catches every drift but you must update tests whenever you "
             "intentionally diverge."),
            ("Divergence-only",
             "Only assert behaviour that intentionally differs from parsel. "
             "Lower maintenance, but parsel-equivalent regressions slip "
             "through silently."),
        ],
        "deliverable": "tests/parser/test_translator.py (~80 LOC)",
        "blocks": ["Wave 3 P0 — translator coverage"],
        "prompt_template": (
            "Author tests/parser/test_translator.py for scrapling/core/translator.py. "
            "Strategy = {choice}. Cover HTMLTranslator.css_to_xpath, XPathExpr, "
            "and the public xpath_* helpers. Keep the file self-contained — "
            "no fixtures from elsewhere in tests/."
        ),
    },
    {
        "id": "D2",
        "category": "Decision",
        "priority": "P1",
        "title": "scrapling/engines/static.py — one PR or three?",
        "owner": "Maintainer",
        "estimate": "5 min decision",
        "context": (
            "783-LOC file. Wave 3 plans tests/fetchers/test_static_internals.py "
            "(~250 LOC, ~3 h). Two ways to split:"
        ),
        "options": [
            ("Single PR (faster)",
             "All sync + async + session internals tested in one file. "
             "Ships sooner; harder to review."),
            ("Three PRs (recommended)",
             "FetcherSession → FetcherClient → AsyncFetcherClient. Each "
             "PR is ~80 LOC. Easier to review and bisect failures."),
        ],
        "deliverable": "tests/fetchers/test_static_internals*.py",
        "blocks": ["Wave 3 P1 — static.py coverage"],
        "prompt_template": (
            "Implement Wave 3 static.py coverage using the {choice} strategy. "
            "Mock HTTPX / curl_cffi at the boundary so the tests don't "
            "depend on a live server. Cover retries, redirects, header "
            "merging, proxy plumbing, and timeout handling."
        ),
    },
    {
        "id": "D3",
        "category": "Decision",
        "priority": "P2",
        "title": "Fake fixtures vs. vendored playwright internals",
        "owner": "Maintainer",
        "estimate": "2 min decision",
        "context": (
            "tests/fetchers/test_response_factory.py needs a stand-in for "
            "playwright.Response so it can run without a real browser."
        ),
        "options": [
            ("Minimal dataclasses (recommended)",
             "Plain @dataclass with the attributes ResponseFactory reads. "
             "Independent of Playwright versions."),
            ("Real playwright Response",
             "Requires a launched browser; ties the test to a binary."),
            ("Mock with unittest.mock",
             "Spec= the real class. Brittle against playwright upgrades."),
        ],
        "deliverable": "tests/fetchers/test_response_factory.py",
        "blocks": ["Wave 3 P1 — convertor.py coverage"],
        "prompt_template": (
            "Implement tests/fetchers/test_response_factory.py for "
            "scrapling/engines/toolbelt/convertor.py using {choice}. Verify "
            "status, headers, cookies, encoding, and follow() behaviour."
        ),
    },

    # ---------------------------------------------------------------- scheduling
    {
        "id": "S1",
        "category": "Scheduling",
        "priority": "P0",
        "title": "Schedule Wave 3 authoring window (~9 h total)",
        "owner": "You",
        "estimate": "9 h coding (can be split across days)",
        "context": (
            "7 new test files queued. Listed below with per-file estimates."
        ),
        "options": [
            ("Single block (intensive day)",
             "All 7 files in one focused day. Faster cycle time; risk of fatigue."),
            ("Spread across the week (recommended)",
             "1-2 files per day. Lower context-switching cost; reviewable PRs."),
        ],
        "deliverable": "7 PRs landed",
        "blocks": ["Wave 3 completion"],
        "prompt_template": (
            "Open the test files in the order they appear in "
            "test_dashboard/UNTOUCHED.md and author them using the {choice} cadence. "
            "Stop after each file for a quick self-review before moving on."
        ),
    },
    {
        "id": "S2",
        "category": "Scheduling",
        "priority": "P1",
        "title": "Stand up a Chromium-equipped CI sanity check",
        "owner": "You",
        "estimate": "20 min",
        "context": (
            "All current passes were on a sandbox without chromium. CI runs on "
            "macOS-latest with chromium installed. Verify the suite stays "
            "green there before merging Wave 2."
        ),
        "options": [
            ("Check PR #3 macOS CI status",
             "Wait for the existing workflow to complete; read the report."),
            ("Run locally with chromium",
             "playwright install chromium && pytest tests/ — confirms 0 fail."),
        ],
        "deliverable": "Green check on PR #3",
        "blocks": ["Merging Wave 1 + 2"],
        "prompt_template": (
            "Verify the Scrapling test suite is green on macOS CI with chromium "
            "installed. If the CI run failed, summarise the failures grouped by "
            "root cause and propose fixes."
        ),
    },

    # ---------------------------------------------------------------- approvals
    {
        "id": "A1",
        "category": "Approval",
        "priority": "P0",
        "title": "Review and approve PR #3 (Waves 1 + 2 + dashboard)",
        "owner": "Maintainer",
        "estimate": "15 min review",
        "context": (
            "PR #3 ships the dashboard + conftest.py browser-binary skips + "
            "tests/requirements.txt update. Net effect: 45 failures → 0; "
            "55 informative skips on bare hosts."
        ),
        "options": [
            ("Approve as-is",
             "Ship Waves 1 + 2 and the dashboard."),
            ("Approve with follow-up issues filed",
             "Ship now; open issues for the Wave 3-5 work in the same review."),
            ("Request changes",
             "Add comments inline on what to tighten."),
        ],
        "deliverable": "PR #3 status: merged or feedback delivered",
        "blocks": ["Everything downstream"],
        "prompt_template": (
            "Review https://github.com/Azizsa8/Reconicas/pull/3. Outcome: "
            "{choice}. Walk through the dashboard, conftest changes, and the "
            "UNTOUCHED.md plan; flag anything that conflicts with project "
            "conventions in CONTRIBUTING.md."
        ),
    },
    {
        "id": "A2",
        "category": "Approval",
        "priority": "P1",
        "title": "Approve the test-dashboard as a maintained artefact",
        "owner": "Maintainer",
        "estimate": "5 min decision",
        "context": (
            "The dashboard is checked in. Decide whether contributors "
            "regenerate it (Wave 5 pre-commit hook), CI regenerates it as a "
            "build artefact, or we drop the static file and rely on a "
            "generator-on-demand command."
        ),
        "options": [
            ("Pre-commit hook (recommended)",
             "Hook fails if pytest_report.json is older than tests/. Keeps "
             "the file fresh; no CI artefact storage cost."),
            ("CI artefact only",
             "Drop the checked-in HTML; upload it from CI as a build artefact."),
            ("Status quo",
             "Manual `python test_dashboard/generate.py` after test runs."),
        ],
        "deliverable": ".pre-commit-config.yaml or CI workflow change",
        "blocks": ["Wave 5 completion"],
        "prompt_template": (
            "Implement the {choice} option for the test dashboard freshness "
            "guarantee. Update CONTRIBUTING.md with the new contributor "
            "instructions."
        ),
    },

    # ---------------------------------------------------------------- ROADMAP discussions (Wave 4)
    {
        "id": "R1",
        "category": "ROADMAP",
        "priority": "P2",
        "title": "Wave 4.1 — Auto-detect pagination URLs",
        "owner": "Design + Maintainer",
        "estimate": "Design 1 h + impl 1-2 days",
        "context": (
            "ROADMAP item. Detect 'next-page' style links on arbitrary HTML "
            "(rel=next, class hints, query-string patterns) and surface a "
            "Selector method."
        ),
        "options": [
            ("Selector.paginate()",
             "Method on Selector returning an iterator of candidate URLs."),
            ("Standalone helper",
             "scrapling.detect_pagination(html) -> list[str]."),
            ("Defer",
             "File issue, no implementation this cycle."),
        ],
        "deliverable": "Impl + tests/parser/test_pagination.py",
        "blocks": ["Wave 4 progress"],
        "prompt_template": (
            "Design and implement pagination URL detection using the "
            "{choice} shape. Cover rel=next, class-based hints "
            "(next, more, page-next), and query-string ?page=N patterns."
        ),
    },
    {
        "id": "R2",
        "category": "ROADMAP",
        "priority": "P2",
        "title": "Wave 4.2 — Auto-detect & manipulate page schemas",
        "owner": "Design + Maintainer",
        "estimate": "Design 1 h + impl 2-3 days",
        "context": (
            "Detect JSON-LD / microdata / Open Graph blocks and expose them "
            "as queryable dicts on Selector."
        ),
        "options": [
            ("Read-only API",
             "Selector.schema → dict of all detected schemas."),
            ("Read+Patch API",
             "Allows modifying and re-emitting schemas (useful for AI agents)."),
            ("Defer",
             "Issue only, no code this cycle."),
        ],
        "deliverable": "Impl + tests/parser/test_schemas.py",
        "blocks": ["Wave 4 progress"],
        "prompt_template": (
            "Implement auto-detection of page schemas using the {choice} "
            "approach. Support JSON-LD, microdata, RDFa, and Open Graph."
        ),
    },
    {
        "id": "R3",
        "category": "ROADMAP",
        "priority": "P2",
        "title": "Wave 4.3 — Page analyzer from meta-elements",
        "owner": "Design + Maintainer",
        "estimate": "Design 1 h + impl 1-2 days",
        "context": (
            "ROADMAP: 'add analyzer ability that tries to learn about the "
            "page through meta-elements and return what it learned'."
        ),
        "options": [
            ("Rule-based",
             "Walk well-known meta tags + heuristics. Deterministic, fast."),
            ("LLM-assisted",
             "Optional LLM call for ambiguity. Slower, network-bound."),
            ("Defer",
             "Issue only."),
        ],
        "deliverable": "scrapling.analyze(html) + tests",
        "blocks": ["Wave 4 progress"],
        "prompt_template": (
            "Build a page analyzer using a {choice} strategy. Return a "
            "structured report covering language, title, primary image, "
            "schema types, and detected content type."
        ),
    },
    {
        "id": "R4",
        "category": "ROADMAP",
        "priority": "P2",
        "title": "Wave 4.4 — Generate regex from a group of elements",
        "owner": "Design + Maintainer",
        "estimate": "Design 1 h + impl 1 day",
        "context": (
            "Given several selected elements (e.g. all hrefs), produce a "
            "regex that matches the structural pattern they share."
        ),
        "options": [
            ("Greedy LCS",
             "Longest-common-subsequence based — simple, works for URLs."),
            ("Template-mining",
             "Replace varying segments with character classes; more general."),
            ("Defer",
             "Issue only."),
        ],
        "deliverable": "Selectors.regex_pattern() + tests",
        "blocks": ["Wave 4 progress"],
        "prompt_template": (
            "Implement regex generation from a group of selected elements "
            "using the {choice} approach."
        ),
    },
    {
        "id": "R5",
        "category": "ROADMAP",
        "priority": "P2",
        "title": "Wave 4.5 — Scrapy plugin replacing parsel",
        "owner": "Design + Maintainer",
        "estimate": "Design 2 h + impl 2-3 days",
        "context": (
            "ROADMAP: Scrapy plugin/decorator that swaps parsel for "
            "Scrapling on the response argument."
        ),
        "options": [
            ("Middleware",
             "Drop-in Scrapy DOWNLOADER_MIDDLEWARE. Cleanest UX."),
            ("Decorator",
             "@scrapling.use on the spider parse method. Minimal Scrapy coupling."),
            ("Defer",
             "Issue only."),
        ],
        "deliverable": "scrapling.scrapy module + tests",
        "blocks": ["Wave 4 progress"],
        "prompt_template": (
            "Build the Scrapy integration using the {choice} pattern. "
            "Provide a working example spider and a smoke test."
        ),
    },

    # ---------------------------------------------------------------- external setup
    {
        "id": "E1",
        "category": "Setup",
        "priority": "P1",
        "title": "Install Chromium locally for full-fidelity dev runs",
        "owner": "You",
        "estimate": "5 min",
        "context": (
            "Without chromium, 49 tests skip locally (they pass on CI). "
            "Install once per dev machine."
        ),
        "options": [
            ("Run command", "`python -m playwright install chromium`"),
        ],
        "deliverable": "Local: 49 fewer skips",
        "blocks": ["Local full-fidelity testing"],
        "prompt_template": (
            "Run `python -m playwright install chromium` and re-run "
            "`python -m pytest tests/`. Report the new skip / fail / pass "
            "counts."
        ),
    },
    {
        "id": "E2",
        "category": "Setup",
        "priority": "P1",
        "title": "Install Camoufox locally for stealth-tests",
        "owner": "You",
        "estimate": "5 min",
        "context": (
            "Without Camoufox, the 10 stealth-related tests skip. CI has "
            "it via the [fetchers] extras; local dev needs `camoufox fetch`."
        ),
        "options": [
            ("Run command", "`python -m camoufox fetch`"),
        ],
        "deliverable": "Local: 10 fewer skips",
        "blocks": ["Local stealth coverage"],
        "prompt_template": (
            "Run `python -m camoufox fetch` and rerun the stealth tests "
            "in tests/fetchers/{sync,async}/test_stealth*.py. Summarise "
            "the result."
        ),
    },
]

CATEGORIES = ["Decision", "Scheduling", "Approval", "ROADMAP", "Setup"]
PRIORITIES = ["P0", "P1", "P2"]
PRI_COLOR = {"P0": "var(--fail)", "P1": "var(--skip)", "P2": "var(--muted)"}
CAT_COLOR = {
    "Decision": "#a371f7",
    "Scheduling": "#58a6ff",
    "Approval": "#3fb950",
    "ROADMAP": "#d29922",
    "Setup": "#8b949e",
}


CSS = """
:root{--bg:#0d1117;--panel:#151b23;--panel2:#1c232c;--text:#e6edf3;
  --muted:#8b949e;--accent:#58a6ff;--ok:#3fb950;--fail:#f85149;--skip:#d29922;
  --border:#30363d;--pill:#21262d;--mono:'JetBrains Mono','Fira Code',Menlo,Consolas,monospace}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--bg);color:var(--text);
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.5}
a{color:var(--accent);text-decoration:none}
header.top{padding:18px 28px;border-bottom:1px solid var(--border);
  display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:12px;
  position:sticky;top:0;background:var(--bg);z-index:10}
header.top h1{margin:0;font-size:22px;font-weight:600}
header.top .meta{color:var(--muted);font-size:12px}

.toolbar{padding:14px 28px;border-bottom:1px solid var(--border);background:var(--panel);
  display:flex;gap:10px;align-items:center;flex-wrap:wrap;position:sticky;top:62px;z-index:9}
.toolbar input,.toolbar select{background:var(--panel2);border:1px solid var(--border);
  color:var(--text);border-radius:6px;padding:6px 10px;font-size:13px}
.toolbar input{min-width:240px}
.toolbar button{background:var(--accent);border:none;color:#0d1117;font-weight:600;
  border-radius:6px;padding:7px 14px;cursor:pointer;font-size:13px}
.toolbar button.secondary{background:var(--pill);color:var(--text);border:1px solid var(--border)}
.toolbar button:hover{filter:brightness(1.1)}
.toolbar .count{color:var(--muted);font-size:12px;font-family:var(--mono)}

main{padding:18px 28px}
.task{background:var(--panel);border:1px solid var(--border);border-radius:10px;
  padding:16px;margin-bottom:14px;transition:border-color .15s}
.task:hover{border-color:#4a5568}
.task.selected{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.task h3{margin:0;font-size:15px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.task .title-row{display:flex;align-items:center;gap:10px;flex:1}
.task input[type=checkbox]{width:18px;height:18px;cursor:pointer;accent-color:var(--accent)}
.task .meta-row{margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;font-size:11.5px}
.pill{display:inline-block;padding:2px 8px;border-radius:999px;background:var(--pill);
  color:var(--muted);font-family:var(--mono);font-size:11px}
.pill.priority{font-weight:600}
.pill.category{font-weight:600}
.task .context{color:var(--muted);font-size:13px;margin-top:10px;line-height:1.5}
.task .options{margin-top:12px;display:grid;gap:8px}
.task .opt{display:flex;align-items:flex-start;gap:10px;padding:8px 10px;
  background:var(--panel2);border:1px solid var(--border);border-radius:6px;cursor:pointer}
.task .opt:hover{border-color:var(--accent)}
.task .opt.chosen{border-color:var(--accent);background:rgba(88,166,255,.08)}
.task .opt input[type=radio]{margin-top:3px;accent-color:var(--accent)}
.task .opt-body{flex:1}
.task .opt-label{font-weight:600;color:var(--text)}
.task .opt-desc{color:var(--muted);font-size:12.5px;margin-top:2px}
.task .deliverable{margin-top:10px;font-family:var(--mono);font-size:11.5px;color:var(--muted)}
.task .deliverable b{color:var(--text)}
.task .actions{margin-top:10px;display:flex;gap:6px}
.task .actions button{background:var(--pill);color:var(--text);border:1px solid var(--border);
  border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11.5px;font-family:var(--mono)}
.task .actions button:hover{border-color:var(--accent);color:var(--accent)}
.task .actions button.copied{border-color:var(--ok);color:var(--ok)}

.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;padding:14px 28px;
  background:var(--panel2);border-bottom:1px solid var(--border)}
.summary .box{background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:12px}
.summary .box .n{font-size:22px;font-weight:600}
.summary .box .l{color:var(--muted);font-size:11.5px;text-transform:uppercase;letter-spacing:.06em}

.modal{display:none;position:fixed;inset:0;background:rgba(5,8,12,.78);backdrop-filter:blur(3px);z-index:100}
.modal.open{display:flex;justify-content:center;align-items:flex-start;overflow:auto;padding:24px}
.modal .sheet{background:var(--panel);border:1px solid var(--border);border-radius:12px;
  max-width:900px;width:100%;padding:24px;margin:auto}
.modal h2{margin:0 0 14px;font-size:18px}
.modal pre{background:#0a0d12;border:1px solid var(--border);border-radius:6px;
  padding:14px;font-family:var(--mono);font-size:12px;color:#cdd9e5;
  white-space:pre-wrap;max-height:60vh;overflow:auto}
.modal .controls{display:flex;justify-content:space-between;gap:8px;margin-top:14px}
.modal .controls button{background:var(--accent);color:#0d1117;border:none;
  font-weight:600;border-radius:6px;padding:8px 16px;cursor:pointer}
.modal .controls button.secondary{background:var(--pill);color:var(--text);border:1px solid var(--border)}

footer{padding:14px 28px;color:var(--muted);font-size:12px;border-top:1px solid var(--border)}
"""


def render_task(t: dict) -> str:
    opts_html = ""
    for i, (label, desc) in enumerate(t["options"]):
        opts_html += (
            f'<label class="opt"><input type="radio" name="opt-{t["id"]}" value="{escape(label, quote=True)}"'
            + (' checked' if i == 0 else '')
            + f'><div class="opt-body"><div class="opt-label">{escape(label)}</div>'
            f'<div class="opt-desc">{escape(desc)}</div></div></label>'
        )
    blocks = ", ".join(t.get("blocks", [])) or "—"
    return f"""
    <article class="task" data-id="{t["id"]}" data-category="{t["category"]}"
      data-priority="{t["priority"]}">
      <h3><div class="title-row">
        <input type="checkbox" class="select" />
        <div>
          <div>{escape(t["title"])}</div>
          <div class="meta-row">
            <span class="pill priority" style="color:{PRI_COLOR[t["priority"]]}">{t["priority"]}</span>
            <span class="pill category" style="color:{CAT_COLOR[t["category"]]}">{escape(t["category"])}</span>
            <span class="pill">owner: {escape(t["owner"])}</span>
            <span class="pill">{escape(t["estimate"])}</span>
            <span class="pill" style="font-family:var(--mono);color:var(--muted)">{escape(t["id"])}</span>
          </div>
        </div></div>
      </h3>
      <div class="context">{escape(t["context"])}</div>
      <div class="options">{opts_html}</div>
      <div class="deliverable"><b>Deliverable:</b> {escape(t["deliverable"])} ·
        <b>Blocks:</b> {escape(blocks)}</div>
      <div class="actions">
        <button onclick="copyOne('{t["id"]}', this)">copy this prompt</button>
        <button class="secondary" onclick="toggleOne('{t["id"]}')">select / deselect</button>
      </div>
      <template class="prompt-template">{escape(t["prompt_template"])}</template>
    </article>
    """


def render() -> str:
    cats = {c: 0 for c in CATEGORIES}
    pris = {p: 0 for p in PRIORITIES}
    for t in TASKS:
        cats[t["category"]] += 1
        pris[t["priority"]] += 1

    summary_boxes = (
        f'<div class="box"><div class="n">{len(TASKS)}</div><div class="l">Manual tasks</div></div>'
        + "".join(
            f'<div class="box"><div class="n" style="color:{PRI_COLOR[p]}">{pris[p]}</div>'
            f'<div class="l">{p} items</div></div>' for p in PRIORITIES
        )
        + "".join(
            f'<div class="box"><div class="n" style="color:{CAT_COLOR[c]}">{cats[c]}</div>'
            f'<div class="l">{c}</div></div>' for c in CATEGORIES
        )
    )

    cat_options = "".join(f'<option value="{c}">{c}</option>' for c in CATEGORIES)
    pri_options = "".join(f'<option value="{p}">{p}</option>' for p in PRIORITIES)

    body_tasks = "\n".join(render_task(t) for t in TASKS)

    timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')

    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Scrapling — Manual Work Queue</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>{CSS}</style>
</head><body>
<header class="top">
  <div>
    <h1>Manual Work Queue</h1>
    <div class="meta">{len(TASKS)} tasks awaiting human judgement · refreshed {timestamp} ·
      <a href="dashboard.html">← back to test dashboard</a></div>
  </div>
  <div class="meta">Select tasks → click <b>Generate combined prompt</b> at top</div>
</header>

<div class="summary">{summary_boxes}</div>

<div class="toolbar">
  <input type="search" id="search" placeholder="filter by title, owner, id…" />
  <select id="cat-filter"><option value="">all categories</option>{cat_options}</select>
  <select id="pri-filter"><option value="">all priorities</option>{pri_options}</select>
  <span class="count" id="count">{len(TASKS)} shown · 0 selected</span>
  <span style="flex:1"></span>
  <button onclick="selectAllVisible()" class="secondary">select all visible</button>
  <button onclick="clearSelection()" class="secondary">clear</button>
  <button onclick="generatePrompt()">Generate combined prompt →</button>
</div>

<main id="tasks">{body_tasks}</main>

<footer>Edit <code>test_dashboard/manual.py</code> to add or change tasks · regenerate with
<code>python test_dashboard/manual.py</code></footer>

<div class="modal" id="prompt-modal">
  <div class="sheet">
    <h2>Combined prompt — paste into Claude / Claude Code</h2>
    <pre id="prompt-text"></pre>
    <div class="controls">
      <button class="secondary" onclick="closeModal()">close</button>
      <button onclick="copyPrompt()">copy to clipboard</button>
    </div>
  </div>
</div>

<script>
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const taskEls = () => $$('.task');

function updateCount(){{
  const visible = taskEls().filter(t => t.style.display !== 'none');
  const sel = taskEls().filter(t => t.querySelector('.select').checked);
  $('#count').textContent = `${{visible.length}} shown · ${{sel.length}} selected`;
}}

function applyFilters(){{
  const q = $('#search').value.toLowerCase();
  const cat = $('#cat-filter').value;
  const pri = $('#pri-filter').value;
  for(const t of taskEls()){{
    const text = t.textContent.toLowerCase();
    const matchQ = !q || text.includes(q);
    const matchC = !cat || t.dataset.category === cat;
    const matchP = !pri || t.dataset.priority === pri;
    t.style.display = (matchQ && matchC && matchP) ? '' : 'none';
  }}
  updateCount();
}}

$('#search').addEventListener('input', applyFilters);
$('#cat-filter').addEventListener('change', applyFilters);
$('#pri-filter').addEventListener('change', applyFilters);

function toggleOne(id){{
  const t = document.querySelector(`.task[data-id="${{id}}"]`);
  const cb = t.querySelector('.select');
  cb.checked = !cb.checked;
  t.classList.toggle('selected', cb.checked);
  updateCount();
}}

taskEls().forEach(t => {{
  t.querySelector('.select').addEventListener('change', e => {{
    t.classList.toggle('selected', e.target.checked);
    updateCount();
  }});
  // mark chosen radio
  t.querySelectorAll('.opt input').forEach(r => {{
    r.addEventListener('change', () => {{
      t.querySelectorAll('.opt').forEach(o => o.classList.remove('chosen'));
      r.closest('.opt').classList.add('chosen');
    }});
  }});
  // initial chosen marker
  const initial = t.querySelector('.opt input:checked');
  if(initial) initial.closest('.opt').classList.add('chosen');
}});

function selectAllVisible(){{
  for(const t of taskEls()){{
    if(t.style.display === 'none') continue;
    const cb = t.querySelector('.select');
    cb.checked = true;
    t.classList.add('selected');
  }}
  updateCount();
}}
function clearSelection(){{
  taskEls().forEach(t => {{
    t.querySelector('.select').checked = false;
    t.classList.remove('selected');
  }});
  updateCount();
}}

function promptForTask(t){{
  const template = t.querySelector('.prompt-template').innerHTML;
  const opt = t.querySelector('.opt input:checked');
  const choice = opt ? opt.value : '(unchosen)';
  const title = t.querySelector('.title-row > div > div').textContent.trim();
  const id = t.dataset.id;
  const filled = template.replace(/{{choice}}/g, choice);
  return `### [${{id}}] ${{title}}\\n` +
    `Chosen option: ${{choice}}\\n\\n${{filled}}`;
}}

function copyOne(id, btn){{
  const t = document.querySelector(`.task[data-id="${{id}}"]`);
  const text = promptForTask(t);
  navigator.clipboard.writeText(text).then(() => {{
    const orig = btn.textContent;
    btn.textContent = 'copied'; btn.classList.add('copied');
    setTimeout(() => {{ btn.textContent = orig; btn.classList.remove('copied'); }}, 1200);
  }});
}}

function generatePrompt(){{
  const selected = taskEls().filter(t => t.querySelector('.select').checked);
  if(!selected.length){{
    alert('Select at least one task first.');
    return;
  }}
  const parts = selected.map(promptForTask);
  const header = `You are helping me schedule and execute ${{selected.length}} manual ` +
    `decision(s) on the Scrapling project. Work through each numbered section, ` +
    `apply the chosen option, and report back per task with the outcome. ` +
    `If any choice still says "(unchosen)", ask me before acting on it.\\n\\n`;
  const body = header + parts.join('\\n\\n---\\n\\n');
  $('#prompt-text').textContent = body;
  $('#prompt-modal').classList.add('open');
}}

function closeModal(){{ $('#prompt-modal').classList.remove('open'); }}
function copyPrompt(){{
  navigator.clipboard.writeText($('#prompt-text').textContent);
}}
document.addEventListener('keydown', e => {{ if(e.key === 'Escape') closeModal(); }});
$('#prompt-modal').addEventListener('click', e => {{ if(e.target.id === 'prompt-modal') closeModal(); }});

updateCount();
</script>
</body></html>
"""


if __name__ == "__main__":
    OUT.write_text(render())
    print(f"wrote {OUT} ({OUT.stat().st_size/1024:.1f} kB) · {len(TASKS)} tasks")
