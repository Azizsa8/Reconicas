#!/usr/bin/env python3
"""
Test-Dashboard generator.

Reads tests/ via AST and a pytest-json-report run and emits a single
self-contained HTML dashboard at test_dashboard/dashboard.html.

Run:
    python -m pytest tests/ \
        --json-report --json-report-file=test_dashboard/pytest_report.json \
        -p no:cacheprovider -o addopts=""
    python test_dashboard/generate.py
"""

from __future__ import annotations

import ast
import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TESTS = ROOT / "tests"
REPORT = Path(__file__).resolve().parent / "pytest_report.json"
ROADMAP = ROOT / "ROADMAP.md"
OUT = Path(__file__).resolve().parent / "dashboard.html"

FEATURE_DESCRIPTIONS = {
    "parser": (
        "Selector and AttributesHandler — CSS/XPath traversal, filters, "
        "ancestor navigation, find_similar, adaptive matching."
    ),
    "fetchers": (
        "Synchronous and asynchronous fetchers — requests, dynamic Playwright "
        "browser, stealth Camoufox, sessions, proxy rotation."
    ),
    "spiders": (
        "Spider engine, scheduler, robots.txt, sitemap parsing, link "
        "extraction, response cache, checkpoints, CrawlSpider templates."
    ),
    "ai": (
        "MCP server exposing Scrapling tools to AI agents (ai/test_ai_mcp.py)."
    ),
    "cli": (
        "Interactive `scrapling` CLI and shell-mode functionality."
    ),
    "core": (
        "Shell utilities and storage layer used across the library."
    ),
}


# ---------- AST scan ----------------------------------------------------------

def _is_test_func(node: ast.AST) -> bool:
    return (
        isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        and node.name.startswith("test_")
    )


def _decorator_label(dec: ast.expr) -> str:
    try:
        return ast.unparse(dec)
    except Exception:
        return "<dec>"


def _has_skip(decorators: list[ast.expr]) -> bool:
    for d in decorators:
        s = _decorator_label(d)
        if "pytest.mark.skip" in s or "pytest.mark.xfail" in s or "unittest.skip" in s:
            return True
    return False


def _body_snippet(node: ast.AST, source_lines: list[str], limit: int = 8) -> str:
    end = getattr(node, "end_lineno", node.lineno + 2)
    snippet = source_lines[node.lineno - 1: min(end, node.lineno - 1 + limit)]
    return "".join(snippet).rstrip()


def scan_tests() -> dict:
    """Walk tests/ with AST. Returns nested dict feature->module->classes/funcs."""
    features: dict = defaultdict(lambda: {"modules": {}})
    for path in sorted(TESTS.rglob("test_*.py")):
        rel = path.relative_to(ROOT)
        # feature is first dir under tests/
        parts = rel.parts
        feature = parts[1] if len(parts) > 2 else "_root"
        # sub-feature for fetchers/{sync,async}
        sub = parts[2] if (feature == "fetchers" and len(parts) > 3 and parts[2] in {"sync", "async"}) else None

        try:
            source = path.read_text()
        except Exception as exc:
            continue
        try:
            tree = ast.parse(source, filename=str(path))
        except SyntaxError:
            continue
        source_lines = source.splitlines(keepends=True)

        module_doc = ast.get_docstring(tree) or ""
        mod_entry = {
            "path": str(rel).replace(os.sep, "/"),
            "subfeature": sub,
            "doc": module_doc.strip().splitlines()[0] if module_doc else "",
            "classes": [],
            "functions": [],
        }

        for node in tree.body:
            if isinstance(node, ast.ClassDef) and node.name.startswith("Test"):
                cls_entry = {
                    "name": node.name,
                    "lineno": node.lineno,
                    "doc": (ast.get_docstring(node) or "").strip().splitlines()[0] if ast.get_docstring(node) else "",
                    "tests": [],
                }
                for sub_node in node.body:
                    if _is_test_func(sub_node):
                        cls_entry["tests"].append({
                            "name": sub_node.name,
                            "lineno": sub_node.lineno,
                            "is_async": isinstance(sub_node, ast.AsyncFunctionDef),
                            "doc": (ast.get_docstring(sub_node) or "").strip().splitlines()[0] if ast.get_docstring(sub_node) else "",
                            "skipped_marker": _has_skip(sub_node.decorator_list),
                            "snippet": _body_snippet(sub_node, source_lines),
                        })
                mod_entry["classes"].append(cls_entry)
            elif _is_test_func(node):
                mod_entry["functions"].append({
                    "name": node.name,
                    "lineno": node.lineno,
                    "is_async": isinstance(node, ast.AsyncFunctionDef),
                    "doc": (ast.get_docstring(node) or "").strip().splitlines()[0] if ast.get_docstring(node) else "",
                    "skipped_marker": _has_skip(node.decorator_list),
                    "snippet": _body_snippet(node, source_lines),
                })

        features[feature]["modules"][mod_entry["path"]] = mod_entry

    return dict(features)


# ---------- pytest report join -----------------------------------------------

def load_report() -> dict:
    if not REPORT.exists():
        return {"tests": [], "summary": {}, "missing_report": True}
    with REPORT.open() as fh:
        return json.load(fh)


def index_outcomes(report: dict) -> dict[str, dict]:
    """nodeid -> outcome details (cleaned of huge log payloads)."""
    out: dict[str, dict] = {}
    for t in report.get("tests", []):
        call = t.get("call", {}) or {}
        crash = call.get("crash") or {}
        out[t["nodeid"]] = {
            "outcome": t.get("outcome"),
            "duration": (call.get("duration") or 0) + (t.get("setup", {}).get("duration") or 0),
            "message": crash.get("message", ""),
            "crash_path": crash.get("path", ""),
            "crash_line": crash.get("lineno", 0),
            "longrepr": (call.get("longrepr") or "")[:4000],
            "stderr": (call.get("stderr") or "")[-1200:],
        }
    return out


def derive_node_key(rel_path: str, cls: str | None, func: str) -> str:
    if cls:
        return f"{rel_path}::{cls}::{func}"
    return f"{rel_path}::{func}"


# ---------- next movements ---------------------------------------------------

ROOT_CAUSE_PATTERNS = [
    (re.compile(r"No module named '([\w\.\-]+)'"), "Missing dependency: {0} — `pip install {0}`."),
    (re.compile(r"Address already in use"), "Port collision in httpbin / local server — restart test or stagger ports."),
    (re.compile(r"Permission denied"), "Filesystem permission denied — check tmpdir / sandbox."),
    (re.compile(r"BrowserType\.launch.*Executable doesn't exist"), "Run `playwright install` (or `camoufox fetch`) — browser binary missing."),
    (re.compile(r"Connection refused"), "Service not reachable — start the test fixture / server first."),
    (re.compile(r"Timeout"), "Operation timed out — investigate slow fixture or network."),
]


def derive_next_movements(outcomes: dict[str, dict], features: dict) -> list[dict]:
    movements: list[dict] = []
    causes: dict[str, list[str]] = defaultdict(list)
    for nid, info in outcomes.items():
        if info["outcome"] not in {"failed", "error"}:
            continue
        msg = info["message"] or ""
        labelled = None
        for pat, template in ROOT_CAUSE_PATTERNS:
            m = pat.search(msg)
            if m:
                labelled = template.format(*m.groups())
                break
        labelled = labelled or msg.splitlines()[0][:160] if msg else "Unknown failure"
        causes[labelled].append(nid)

    for cause, nids in sorted(causes.items(), key=lambda kv: -len(kv[1])):
        movements.append({
            "headline": cause,
            "count": len(nids),
            "examples": nids[:4],
        })

    # roadmap-derived next moves
    if ROADMAP.exists():
        rd = ROADMAP.read_text().splitlines()
        roadmap_open = [
            re.sub(r"^\s*-\s*\[\s*\]\s*", "", line).strip()
            for line in rd
            if re.match(r"^\s*-\s*\[\s*\]\s*", line)
        ]
        for item in roadmap_open:
            movements.append({"headline": f"ROADMAP: {item}", "count": 0, "examples": []})

    # untested source modules
    src_root = ROOT / "scrapling"
    tested_modules: set[str] = set()
    for f, payload in features.items():
        for mod in payload["modules"]:
            tested_modules.add(Path(mod).stem.removeprefix("test_"))
    untested = []
    for src in src_root.rglob("*.py"):
        stem = src.stem
        if stem.startswith("_") or stem == "__init__":
            continue
        if stem not in tested_modules:
            untested.append(str(src.relative_to(ROOT)))
    if untested:
        movements.append({
            "headline": f"Source modules without a matching test file ({len(untested)})",
            "count": len(untested),
            "examples": untested[:8],
        })

    return movements


# ---------- HTML render -------------------------------------------------------

CSS = """
:root{
  --bg:#0d1117;--panel:#151b23;--panel2:#1c232c;--text:#e6edf3;--muted:#8b949e;
  --accent:#58a6ff;--ok:#3fb950;--fail:#f85149;--skip:#d29922;--border:#30363d;
  --pill:#21262d;--mono:'JetBrains Mono','Fira Code',Menlo,Consolas,monospace;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--bg);color:var(--text);
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.45}
a{color:var(--accent);text-decoration:none}
header.top{padding:18px 28px;border-bottom:1px solid var(--border);
  display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:12px}
header.top h1{margin:0;font-size:22px;font-weight:600}
header.top .meta{color:var(--muted);font-size:12px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;padding:18px 28px}
.stat{background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:14px}
.stat .n{font-size:26px;font-weight:600}
.stat .l{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.06em}
.stat.fail .n{color:var(--fail)}.stat.ok .n{color:var(--ok)}.stat.skip .n{color:var(--skip)}

section{padding:18px 28px;border-top:1px solid var(--border)}
section h2{margin:0 0 14px;font-size:16px;font-weight:600;letter-spacing:.02em}
section h2 small{color:var(--muted);font-weight:400;margin-left:8px;font-size:12px}

.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.card{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:14px;cursor:pointer;
  transition:border-color .15s,transform .15s}
.card:hover{border-color:var(--accent);transform:translateY(-1px)}
.card h3{margin:0 0 6px;font-size:15px;display:flex;justify-content:space-between;align-items:center}
.card .desc{color:var(--muted);font-size:12.5px;min-height:46px;margin-bottom:8px}
.card .bar{height:8px;border-radius:4px;background:var(--panel2);overflow:hidden;display:flex}
.card .bar span{display:block;height:100%}
.bar .ok{background:var(--ok)}.bar .fail{background:var(--fail)}.bar .skip{background:var(--skip)}
.card .nums{font-family:var(--mono);font-size:11.5px;color:var(--muted);margin-top:6px;display:flex;gap:10px}
.card .nums b{color:var(--text)}

.modal{display:none;position:fixed;inset:0;background:rgba(5,8,12,0.72);backdrop-filter:blur(3px);z-index:50}
.modal.open{display:flex;justify-content:center;align-items:flex-start;overflow:auto;padding:24px}
.modal .sheet{background:var(--panel);border:1px solid var(--border);border-radius:12px;
  max-width:1100px;width:100%;padding:24px;margin:auto}
.modal .sheet header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:14px}
.modal .sheet .close{background:none;color:var(--muted);border:none;font-size:22px;cursor:pointer}
.modal .sheet .close:hover{color:var(--text)}

.mod-pill{display:inline-block;padding:2px 8px;border-radius:999px;background:var(--pill);color:var(--muted);
  font-size:11px;margin-right:4px;font-family:var(--mono)}
.outcome{display:inline-block;padding:1px 7px;border-radius:4px;font-size:11px;font-family:var(--mono);text-transform:uppercase}
.outcome.failed{background:rgba(248,81,73,.15);color:var(--fail)}
.outcome.passed{background:rgba(63,185,80,.15);color:var(--ok)}
.outcome.skipped{background:rgba(210,153,34,.15);color:var(--skip)}
.outcome.error{background:rgba(248,81,73,.15);color:var(--fail)}
.outcome.unknown{background:var(--pill);color:var(--muted)}

details.module{background:var(--panel2);border:1px solid var(--border);border-radius:8px;margin-bottom:10px;padding:10px 14px}
details.module>summary{cursor:pointer;list-style:none;font-family:var(--mono);font-size:13px;display:flex;justify-content:space-between;align-items:center;gap:8px}
details.module>summary::-webkit-details-marker{display:none}
details.module[open]>summary{margin-bottom:8px}
details.cls{margin:6px 0 6px 12px}
details.cls>summary{cursor:pointer;font-weight:600;list-style:none}
.tests{margin:6px 0 4px 14px;padding:0;list-style:none}
.tests li{padding:6px 8px;border-left:2px solid var(--border);margin-bottom:4px}
.tests li.failed{border-left-color:var(--fail);background:rgba(248,81,73,.05)}
.tests li.skipped{border-left-color:var(--skip)}
.tests li.passed{border-left-color:var(--ok)}
.tests .row1{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
.tests .name{font-family:var(--mono);font-size:12.5px}
.tests .doc{color:var(--muted);font-size:12px;margin:2px 0 4px}
.tests .err{font-family:var(--mono);font-size:11.5px;background:#0a0d12;padding:8px;border-radius:6px;
  border:1px solid var(--border);color:#ffb4af;white-space:pre-wrap;overflow:auto;max-height:220px;margin-top:6px}
.tests .snip{font-family:var(--mono);font-size:11.5px;background:#0a0d12;padding:8px;border-radius:6px;
  border:1px solid var(--border);color:#b6c1cc;white-space:pre;overflow:auto;max-height:140px;margin-top:6px}
.actions{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}
.actions button{background:var(--pill);color:var(--text);border:1px solid var(--border);border-radius:6px;
  padding:3px 8px;font-size:11.5px;cursor:pointer;font-family:var(--mono)}
.actions button:hover{border-color:var(--accent);color:var(--accent)}
.actions button.copied{border-color:var(--ok);color:var(--ok)}

.movements{display:grid;grid-template-columns:1fr;gap:8px}
.mv{background:var(--panel);border:1px solid var(--border);border-left:4px solid var(--accent);
  border-radius:6px;padding:10px 14px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.mv h4{margin:0;font-size:13.5px;font-weight:600}
.mv .count{font-family:var(--mono);color:var(--muted);font-size:12px;white-space:nowrap}
.mv ul{margin:4px 0 0;padding-left:18px;color:var(--muted);font-family:var(--mono);font-size:11.5px}
.controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px}
.controls input{background:var(--panel);border:1px solid var(--border);color:var(--text);
  border-radius:6px;padding:6px 10px;font-size:13px;min-width:240px}
.controls label{font-size:12px;color:var(--muted);user-select:none}
.controls input[type=checkbox]{vertical-align:middle;margin-right:4px}

.prompt-library{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px}
.prompt-card{background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:14px}
.prompt-card h4{margin:0 0 6px;font-size:13.5px}
.prompt-card pre{margin:0;background:#0a0d12;border:1px solid var(--border);border-radius:6px;
  padding:10px;font-family:var(--mono);font-size:11.5px;color:#cdd9e5;white-space:pre-wrap;overflow:auto;max-height:200px}
.regen-cmd{font-family:var(--mono);background:#0a0d12;border:1px solid var(--border);padding:10px;
  border-radius:6px;font-size:12px;color:#c8d3de;white-space:pre-wrap}
footer{padding:18px 28px;color:var(--muted);font-size:12px;border-top:1px solid var(--border)}
"""

JS = r"""
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

function openFeature(id){
  const m = $('#modal-' + id);
  if(m){ m.classList.add('open'); document.body.style.overflow='hidden'; }
}
function closeAll(){
  $$('.modal').forEach(m => m.classList.remove('open'));
  document.body.style.overflow='';
}
document.addEventListener('click', e => {
  if(e.target.classList.contains('modal') || e.target.dataset.close === '1') closeAll();
});
document.addEventListener('keydown', e => { if(e.key === 'Escape') closeAll(); });

function copyToClipboard(text, btn){
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'copied';
    btn.classList.add('copied');
    setTimeout(()=>{ btn.textContent=orig; btn.classList.remove('copied'); }, 1200);
  }).catch(() => {
    btn.textContent = 'select+copy';
  });
}
function copyPrompt(btn){
  const text = btn.dataset.prompt;
  copyToClipboard(text, btn);
}

function filterModal(modalId, query, onlyUnfinished){
  const m = $('#' + modalId);
  if(!m) return;
  const q = (query || '').toLowerCase();
  $$('details.module', m).forEach(mod => {
    let modHits = 0;
    $$('li[data-name]', mod).forEach(li => {
      const name = li.dataset.name.toLowerCase();
      const out = li.dataset.outcome;
      const matchQ = !q || name.includes(q) || (li.dataset.err || '').toLowerCase().includes(q);
      const matchU = !onlyUnfinished || (out === 'failed' || out === 'error' || out === 'skipped' || out === 'unknown');
      const visible = matchQ && matchU;
      li.style.display = visible ? '' : 'none';
      if(visible) modHits++;
    });
    mod.style.display = modHits ? '' : 'none';
    if(modHits && q) mod.open = true;
  });
}

function setupModalControls(modalId){
  const m = $('#' + modalId);
  if(!m) return;
  const search = $('input[type=search]', m);
  const toggle = $('input[type=checkbox]', m);
  const apply = () => filterModal(modalId, search.value, toggle.checked);
  search.addEventListener('input', apply);
  toggle.addEventListener('change', apply);
  apply();
}
window.addEventListener('DOMContentLoaded', () => {
  $$('.modal').forEach(m => setupModalControls(m.id));
});
"""


def short(s: str, n: int = 140) -> str:
    s = s.replace("\n", " ")
    return s if len(s) <= n else s[: n - 1] + "…"


def render() -> str:
    features = scan_tests()
    report = load_report()
    outcomes = index_outcomes(report)
    movements = derive_next_movements(outcomes, features)
    summary = report.get("summary", {})

    # tally per feature
    feature_stats: dict[str, dict] = {}
    for fname, payload in features.items():
        s = {"passed": 0, "failed": 0, "error": 0, "skipped": 0, "unknown": 0, "total": 0}
        for path, mod in payload["modules"].items():
            for cls in mod["classes"]:
                for t in cls["tests"]:
                    s["total"] += 1
                    key_prefix = f"{path}::{cls['name']}::{t['name']}"
                    matched = next(
                        (info for nid, info in outcomes.items() if nid.startswith(key_prefix)),
                        None,
                    )
                    outcome = matched["outcome"] if matched else "unknown"
                    s[outcome if outcome in s else "unknown"] += 1
            for t in mod["functions"]:
                s["total"] += 1
                key_prefix = f"{path}::{t['name']}"
                matched = next(
                    (info for nid, info in outcomes.items() if nid.startswith(key_prefix)),
                    None,
                )
                outcome = matched["outcome"] if matched else "unknown"
                s[outcome if outcome in s else "unknown"] += 1
        feature_stats[fname] = s

    total_tests = sum(s["total"] for s in feature_stats.values())
    total_pass = sum(s["passed"] for s in feature_stats.values())
    total_fail = sum(s["failed"] + s["error"] for s in feature_stats.values())
    total_skip = sum(s["skipped"] for s in feature_stats.values())
    unfinished = sum(
        s["failed"] + s["error"] + s["skipped"] + s["unknown"]
        for s in feature_stats.values()
    )
    pct_done = (total_pass / total_tests * 100) if total_tests else 0

    # render
    def stat_card(klass: str, n: int, l: str) -> str:
        return f'<div class="stat {klass}"><div class="n">{n}</div><div class="l">{escape(l)}</div></div>'

    head = f"""
    <header class="top">
      <div>
        <h1>Scrapling — Unfinished Tests Dashboard</h1>
        <div class="meta">Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} ·
          pytest exit {report.get('exitcode', '?')} ·
          {summary.get('total', total_tests)} tests collected ·
          {summary.get('passed', total_pass)} passed / {summary.get('failed', total_fail)} failed</div>
      </div>
      <div class="meta">Run on commit <span style="font-family:var(--mono)">{escape(os.popen('git rev-parse --short HEAD').read().strip()[:12] or 'n/a')}</span> · <a href="manual.html" style="color:var(--accent)">→ manual work queue</a></div>
    </header>
    """

    stats_html = f"""
    <div class="stats">
      {stat_card("", total_tests, "Total tests")}
      {stat_card("ok", total_pass, "Passing")}
      {stat_card("fail", total_fail, "Failing/Errored")}
      {stat_card("skip", total_skip, "Skipped")}
      {stat_card("fail" if unfinished else "ok", unfinished, "Unfinished subtests")}
      {stat_card("", f"{pct_done:.1f}%", "Coverage of expectations")}
    </div>
    """

    mv_html = ['<section><h2>Next Movements <small>actionable, sorted by impact</small></h2><div class="movements">']
    for m in movements:
        examples = "".join(f"<li>{escape(e)}</li>" for e in m["examples"])
        mv_html.append(
            f'<div class="mv"><div><h4>{escape(m["headline"])}</h4>'
            + (f"<ul>{examples}</ul>" if examples else "")
            + f'</div><div class="count">{m["count"]} hit(s)</div></div>'
        )
    mv_html.append("</div></section>")
    movements_html = "\n".join(mv_html)

    progress_html = render_progress(feature_stats, total_tests, total_pass, total_fail, total_skip)
    untouched_html = render_untouched()

    # Gallery + modals
    gallery_cards = []
    modals = []
    feature_order = ["parser", "fetchers", "spiders", "ai", "cli", "core", "_root"]
    feature_order += [f for f in features if f not in feature_order]
    for fname in feature_order:
        if fname not in features:
            continue
        s = feature_stats[fname]
        total = max(s["total"], 1)
        ok_pct = s["passed"] / total * 100
        fail_pct = (s["failed"] + s["error"]) / total * 100
        skip_pct = (s["skipped"] + s["unknown"]) / total * 100
        desc = FEATURE_DESCRIPTIONS.get(fname, "—")
        gallery_cards.append(f"""
        <div class="card" onclick="openFeature('{fname}')">
          <h3>{escape(fname)} <span class="mod-pill">{len(features[fname]['modules'])} modules</span></h3>
          <div class="desc">{escape(desc)}</div>
          <div class="bar">
            <span class="ok" style="width:{ok_pct:.1f}%"></span>
            <span class="fail" style="width:{fail_pct:.1f}%"></span>
            <span class="skip" style="width:{skip_pct:.1f}%"></span>
          </div>
          <div class="nums">
            <span>tests <b>{s['total']}</b></span>
            <span style="color:var(--ok)">✓ {s['passed']}</span>
            <span style="color:var(--fail)">✗ {s['failed']+s['error']}</span>
            <span style="color:var(--skip)">⊘ {s['skipped']+s['unknown']}</span>
          </div>
        </div>
        """)

        # modal content — build one details.module per test file
        modal_modules: list[str] = []
        for path, mod in sorted(features[fname]["modules"].items()):
            inner_blocks: list[str] = []
            mod_unfinished = 0
            mod_total = 0

            for cls in mod["classes"]:
                cls_lis = []
                cls_unfinished = 0
                for t in cls["tests"]:
                    mod_total += 1
                    li = render_test_li(path, cls["name"], t, outcomes)
                    cls_lis.append(li["html"])
                    if li["unfinished"]:
                        mod_unfinished += 1
                        cls_unfinished += 1
                if cls_lis:
                    cls_badge = (
                        f' <span class="outcome failed">{cls_unfinished} unfinished</span>'
                        if cls_unfinished else ' <span class="outcome passed">green</span>'
                    )
                    inner_blocks.append(
                        f'<details class="cls" open><summary>{escape(cls["name"])}'
                        + (f' <span style="color:var(--muted);font-weight:400">— {escape(cls["doc"])}</span>' if cls["doc"] else "")
                        + f' <span class="mod-pill">{len(cls_lis)} subtests</span>{cls_badge}</summary>'
                        f'<ul class="tests">{"".join(cls_lis)}</ul></details>'
                    )

            fn_lis = []
            for t in mod["functions"]:
                mod_total += 1
                li = render_test_li(path, None, t, outcomes)
                fn_lis.append(li["html"])
                if li["unfinished"]:
                    mod_unfinished += 1
            if fn_lis:
                inner_blocks.append(
                    '<details class="cls" open><summary><em>module-level functions</em>'
                    f' <span class="mod-pill">{len(fn_lis)} subtests</span></summary>'
                    f'<ul class="tests">{"".join(fn_lis)}</ul></details>'
                )

            badge = (
                f' <span class="outcome failed">{mod_unfinished} unfinished</span>'
                if mod_unfinished else ' <span class="outcome passed">all green</span>'
            )
            modal_modules.append(
                f'<details class="module"{" open" if mod_unfinished else ""}>'
                f'<summary><span>{escape(path)}'
                + (f' <span style="color:var(--muted);font-weight:400">— {escape(mod["doc"])}</span>' if mod["doc"] else "")
                + f' <span class="mod-pill">{mod_total} subtests</span></span>{badge}</summary>'
                + "".join(inner_blocks)
                + "</details>"
            )

        modal_inner = (
            f'<div class="controls">'
            f'<input type="search" placeholder="filter by name, error, file…" />'
            f'<label><input type="checkbox" checked /> only unfinished</label>'
            f'<span style="color:var(--muted);font-family:var(--mono);font-size:12px">'
            f'tests {s["total"]} · ✓ {s["passed"]} · ✗ {s["failed"] + s["error"]} · ⊘ {s["skipped"] + s["unknown"]}</span>'
            f'</div>'
            + "\n".join(modal_modules)
        )

        modals.append(f"""
        <div class="modal" id="modal-{fname}">
          <div class="sheet">
            <header>
              <div>
                <div style="font-size:18px;font-weight:600">{escape(fname)} <span class="mod-pill">screen</span></div>
                <div style="color:var(--muted);font-size:12.5px;margin-top:4px">{escape(FEATURE_DESCRIPTIONS.get(fname,'—'))}</div>
              </div>
              <button class="close" data-close="1">×</button>
            </header>
            {modal_inner}
          </div>
        </div>
        """)

    gallery_html = (
        '<section><h2>Feature Gallery <small>one screen per feature — click to inspect</small></h2>'
        + '<div class="gallery">'
        + "\n".join(gallery_cards)
        + "</div></section>"
    )

    prompt_lib = render_prompt_library()
    regen = """python -m pytest tests/ \\
  --json-report --json-report-file=test_dashboard/pytest_report.json \\
  -p no:cacheprovider -o addopts=""
python test_dashboard/generate.py"""

    body = f"""
    {head}
    {stats_html}
    {progress_html}
    {untouched_html}
    {movements_html}
    {gallery_html}
    <section><h2>Prompt Library <small>copy → paste into Claude / Claude Code</small></h2>{prompt_lib}</section>
    <section><h2>Regenerate</h2>
      <div class="regen-cmd">{escape(regen)}</div>
      <p style="color:var(--muted);margin-top:8px">The dashboard reads <code>test_dashboard/pytest_report.json</code> and re-scans <code>tests/</code> via AST.</p>
    </section>
    {"".join(modals)}
    <footer>Scrapling test dashboard · {len(features)} features · {sum(len(p['modules']) for p in features.values())} modules · {total_tests} subtests.</footer>
    """

    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Scrapling Test Dashboard</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>{CSS}</style>
</head><body>{body}<script>{JS}</script></body></html>
"""


WAVES = [
    {
        "id": 1,
        "name": "Wave 1 — graceful skips & test deps",
        "status": "done",
        "items": [
            ("tests/conftest.py with SKIP_REAL_CHROME marker", True),
            ("Wrap real_chrome=True params in sync & async dynamic tests", True),
            ("Add markdownify + IPython to tests/requirements.txt", True),
            ("Regenerate dashboard with current state", True),
        ],
    },
    {
        "id": 2,
        "name": "Wave 2 — defensive skips for missing browser binaries",
        "status": "done",
        "items": [
            ("Add CHROMIUM_AVAILABLE probe to conftest.py (via Playwright API)", True),
            ("Add CAMOUFOX_AVAILABLE probe to conftest.py", True),
            ("Auto-skip 45 browser-dependent tests with a clear hint", True),
            ("Fine-grained skipping in test_ai_mcp.py (keeps unit tests alive)", True),
            ("pytest_report_header surfaces detection state", True),
        ],
    },
    {
        "id": 3,
        "name": "Wave 3 — coverage gaps for untested source modules",
        "status": "in_progress",
        "items": [
            ("Inventory untouched modules (test_dashboard/UNTOUCHED.md)", True),
            ("Classify by priority (P0/P1/P2) and indirect coverage", True),
            ("Estimate work per missing test file", True),
            ("Author P0 tests — translator.py, mixins.py", False),
            ("Author P1 tests — static.py, custom_types.py, convertor.py, custom.py, fingerprints.py", False),
            ("Author P2 unit test for fetchers/chrome.py", False),
        ],
    },
    {
        "id": 4,
        "name": "Wave 4 — ROADMAP follow-throughs",
        "status": "todo",
        "items": [
            ("Auto-detect pagination URLs (impl + test)", False),
            ("Auto-detect & manipulate page schemas (impl + test)", False),
            ("Page analyzer from meta-elements (impl + test)", False),
            ("Generate regex from a group of elements (impl + test)", False),
            ("Scrapy plugin/decorator replacing parsel (impl + test)", False),
        ],
    },
    {
        "id": 5,
        "name": "Wave 5 — keep the dashboard honest",
        "status": "todo",
        "items": [
            ("Pre-commit hook: fail if pytest_report.json older than tests/", False),
            ("CI step that uploads dashboard.html as artifact per run", False),
        ],
    },
]


UNTOUCHED_MODULES = [
    {"path": "scrapling/core/translator.py", "loc": 134, "priority": "P0",
     "indirect": 0, "proposal": "tests/parser/test_translator.py",
     "est": "30 min", "rationale": "CSS-to-XPath translator — foundation under every CSS selector."},
    {"path": "scrapling/core/mixins.py", "loc": 90, "priority": "P0",
     "indirect": 0, "proposal": "tests/parser/test_selectors_generation.py",
     "est": "45 min", "rationale": "SelectorsGeneration — powers AI / similarity workflows."},
    {"path": "scrapling/engines/static.py", "loc": 783, "priority": "P1",
     "indirect": 4, "proposal": "tests/fetchers/test_static_internals.py",
     "est": "3 h", "rationale": "Largest file in the package; default user path. Internals untested."},
    {"path": "scrapling/core/custom_types.py", "loc": 345, "priority": "P1",
     "indirect": 1, "proposal": "tests/parser/test_text_handlers.py",
     "est": "1 h", "rationale": "TextHandler / AttributesHandler shims used everywhere."},
    {"path": "scrapling/engines/toolbelt/convertor.py", "loc": 323, "priority": "P1",
     "indirect": 1, "proposal": "tests/fetchers/test_response_factory.py",
     "est": "1.5 h", "rationale": "Playwright → Response conversion. Bugs surface as wrong status codes / cookies."},
    {"path": "scrapling/engines/toolbelt/custom.py", "loc": 307, "priority": "P1",
     "indirect": 1, "proposal": "tests/fetchers/test_response_model.py",
     "est": "1 h", "rationale": "Response / BaseFetcher — attribute coercion, follow(), cookie handling."},
    {"path": "scrapling/engines/toolbelt/fingerprints.py", "loc": 59, "priority": "P1",
     "indirect": 1, "proposal": "tests/fetchers/test_fingerprints.py",
     "est": "20 min", "rationale": "Header / UA generation; OS-detection branches untested."},
    {"path": "scrapling/fetchers/chrome.py", "loc": 97, "priority": "P2",
     "indirect": 4, "proposal": "tests/fetchers/test_dynamic_fetcher_unit.py",
     "est": "30 min", "rationale": "Argument-validation branches reachable without launching a browser."},
    {"path": "scrapling/spiders/templates/crawler.py", "loc": 72, "priority": "P2",
     "indirect": 1, "proposal": "—", "est": "—",
     "rationale": "Already exercised via test_templates.py — no new file needed."},
]


def render_untouched():
    rows = []
    for m in UNTOUCHED_MODULES:
        prio_color = {"P0": "var(--fail)", "P1": "var(--skip)", "P2": "var(--muted)"}[m["priority"]]
        rows.append(
            f'<tr>'
            f'<td><span class="mod-pill" style="background:rgba(248,81,73,.15);color:{prio_color}">{m["priority"]}</span> '
            f'<span style="font-family:var(--mono);font-size:12px">{escape(m["path"])}</span></td>'
            f'<td style="text-align:right;font-family:var(--mono);font-size:12px">{m["loc"]} loc</td>'
            f'<td style="text-align:right;font-family:var(--mono);font-size:12px">{m["indirect"]} refs</td>'
            f'<td style="font-family:var(--mono);font-size:12px;color:var(--accent)">{escape(m["proposal"])}</td>'
            f'<td style="text-align:right;font-family:var(--mono);font-size:12px;color:var(--muted)">{escape(m["est"])}</td>'
            f'<td style="color:var(--muted);font-size:12.5px">{escape(m["rationale"])}</td>'
            f'</tr>'
        )
    total_loc = sum(m["loc"] for m in UNTOUCHED_MODULES)
    n_p0 = sum(1 for m in UNTOUCHED_MODULES if m["priority"] == "P0")
    n_p1 = sum(1 for m in UNTOUCHED_MODULES if m["priority"] == "P1")
    n_p2 = sum(1 for m in UNTOUCHED_MODULES if m["priority"] == "P2")

    return (
        '<section><h2>Untouched modules report '
        f'<small>{len(UNTOUCHED_MODULES)} modules · {total_loc} LOC · '
        f'{n_p0} P0 + {n_p1} P1 + {n_p2} P2 · see test_dashboard/UNTOUCHED.md for the full plan</small></h2>'
        '<table style="width:100%;border-collapse:collapse;font-size:13px">'
        '<thead><tr style="color:var(--muted);text-align:left;border-bottom:1px solid var(--border)">'
        '<th style="padding:6px 4px">Module</th>'
        '<th style="text-align:right;padding:6px 4px">Size</th>'
        '<th style="text-align:right;padding:6px 4px">Indirect</th>'
        '<th style="padding:6px 4px">Proposed test file</th>'
        '<th style="text-align:right;padding:6px 4px">Est.</th>'
        '<th style="padding:6px 4px">Why</th></tr></thead>'
        f'<tbody>{"".join(rows)}</tbody></table>'
        '</section>'
    )


def render_progress(feature_stats, total_tests, total_pass, total_fail, total_skip):
    overall_pct = (total_pass / total_tests * 100) if total_tests else 0
    active = total_tests - total_skip
    healthy_pct = (total_pass / active * 100) if active else 0

    # per-feature progress
    feature_rows = []
    for fname, s in feature_stats.items():
        total = s["total"] or 1
        pct = s["passed"] / total * 100
        bar = (
            f'<div class="bar" style="height:10px"><span class="ok" style="width:{pct:.1f}%"></span>'
            f'<span class="fail" style="width:{(s["failed"]+s["error"])/total*100:.1f}%"></span>'
            f'<span class="skip" style="width:{(s["skipped"]+s["unknown"])/total*100:.1f}%"></span></div>'
        )
        feature_rows.append(
            f'<tr><td><b>{escape(fname)}</b></td>'
            f'<td style="width:50%">{bar}</td>'
            f'<td style="text-align:right;font-family:var(--mono)">{pct:.1f}%</td>'
            f'<td style="text-align:right;color:var(--ok);font-family:var(--mono)">{s["passed"]}/{s["total"]}</td>'
            f'<td style="text-align:right;color:var(--fail);font-family:var(--mono)">{s["failed"]+s["error"]}</td>'
            f'<td style="text-align:right;color:var(--skip);font-family:var(--mono)">{s["skipped"]+s["unknown"]}</td></tr>'
        )

    # waves
    total_steps = sum(len(w["items"]) for w in WAVES)
    done_steps = sum(1 for w in WAVES for _, d in w["items"] if d)
    plan_pct = done_steps / total_steps * 100 if total_steps else 0

    wave_cards = []
    for w in WAVES:
        done = sum(1 for _, d in w["items"] if d)
        total = len(w["items"])
        pct = done / total * 100 if total else 0
        badge = (
            f'<span class="outcome passed">{done}/{total}</span>' if done == total
            else f'<span class="outcome failed">{done}/{total}</span>' if done == 0
            else f'<span class="outcome skipped">{done}/{total}</span>'
        )
        items_html = "".join(
            f'<li style="list-style:none;padding:2px 0">'
            f'<span style="font-family:var(--mono);color:{"var(--ok)" if d else "var(--muted)"}">'
            f'{"✓" if d else "○"}</span> '
            f'<span style="color:{"var(--text)" if d else "var(--muted)"};'
            f'text-decoration:{"line-through" if d else "none"}">{escape(label)}</span></li>'
            for label, d in w["items"]
        )
        wave_cards.append(
            f'<div class="prompt-card">'
            f'<h4>{escape(w["name"])} {badge}</h4>'
            f'<div class="bar" style="height:6px;margin-bottom:8px">'
            f'<span class="ok" style="width:{pct:.1f}%"></span></div>'
            f'<ul style="padding:0;margin:0">{items_html}</ul></div>'
        )

    headline = f"""
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:18px">
      <div class="stat ok"><div class="n">{overall_pct:.1f}%</div>
        <div class="l">Passing of total (incl. skipped)</div></div>
      <div class="stat ok"><div class="n">{healthy_pct:.1f}%</div>
        <div class="l">Passing of runnable ({active} active)</div></div>
      <div class="stat fail"><div class="n">{total_fail}</div>
        <div class="l">Remaining failures</div></div>
      <div class="stat"><div class="n">{plan_pct:.0f}%</div>
        <div class="l">Fix plan complete ({done_steps}/{total_steps} steps)</div></div>
    </div>
    """

    table = (
        '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:18px">'
        '<thead><tr style="color:var(--muted);text-align:left;border-bottom:1px solid var(--border)">'
        '<th style="padding:6px 4px">Feature</th>'
        '<th style="padding:6px 4px">Progress</th>'
        '<th style="text-align:right;padding:6px 4px">%</th>'
        '<th style="text-align:right;padding:6px 4px">passed</th>'
        '<th style="text-align:right;padding:6px 4px">failed</th>'
        '<th style="text-align:right;padding:6px 4px">skipped</th></tr></thead>'
        f'<tbody>{"".join(feature_rows)}</tbody></table>'
    )

    waves_html = f'<div class="prompt-library">{"".join(wave_cards)}</div>'

    return (
        '<section><h2>Project Progress '
        '<small>where we are, what\'s missing, what\'s left in %</small></h2>'
        + headline
        + '<h3 style="margin:18px 0 8px;font-size:14px;color:var(--muted);'
        'text-transform:uppercase;letter-spacing:.06em">By feature</h3>'
        + table
        + '<h3 style="margin:18px 0 8px;font-size:14px;color:var(--muted);'
        'text-transform:uppercase;letter-spacing:.06em">Fix plan — wave checklist</h3>'
        + waves_html
        + '</section>'
    )


def render_prompt_library() -> str:
    prompts = [
        ("Debug a specific failing test",
         "I have a failing pytest test: `{NODEID}`.\n\n"
         "Failure:\n```\n{ERROR}\n```\n\n"
         "Source snippet:\n```python\n{SNIPPET}\n```\n\n"
         "Please:\n"
         "1. Pinpoint the root cause (env, dep, logic, fixture).\n"
         "2. Propose the smallest change to make it pass without weakening the assertion.\n"
         "3. If env/dep, list exact install commands.\n"
         "4. Implement the fix and re-run only this test."),
        ("Update an out-of-date test",
         "Update the test `{NODEID}` at `{PATH}:{LINE}` to match the current "
         "implementation in `scrapling/`.\n\nDo not loosen invariants — if the "
         "behaviour genuinely changed, update the test; if the behaviour drifted "
         "unintentionally, fix the source instead and explain which you picked."),
        ("Create a missing test",
         "Add a new pytest case for `{FEATURE}` covering the gap described "
         "below.\n\nGap: <describe what is uncovered>\n\nFollow the existing "
         "style in `tests/{FEATURE}/` (class layout, fixtures, pytest-asyncio "
         "markers). Include at least one happy path and one boundary case."),
        ("Investigate an unfinished module",
         "Investigate why `{MODULE}` is unfinished (tests collected but never "
         "run, or marked skipped). Either bring it back to green or document "
         "in ROADMAP.md why it is intentionally deferred."),
        ("Improve coverage for a feature screen",
         "Look at the gallery card for `{FEATURE}` in this dashboard. Identify "
         "tests with no docstring, missing async coverage, or missing "
         "parameterized variants. Add them while keeping each test focused."),
        ("Triage all next-movements at once",
         "Walk the Next Movements list and group the failures by cause. For "
         "each group, propose either: (a) a single fix that closes the group, "
         "or (b) an explicit dependency / setup step to add to "
         "tests/requirements.txt."),
    ]
    cards = []
    for title, body in prompts:
        cards.append(
            f'<div class="prompt-card"><h4>{escape(title)} '
            f'<button class="actions copy" style="float:right;background:var(--pill);'
            f'color:var(--text);border:1px solid var(--border);border-radius:6px;padding:2px 8px;'
            f'font-size:11px;cursor:pointer;font-family:var(--mono)" '
            f'data-prompt="{escape(body, quote=True)}" onclick="copyPrompt(this)">copy</button></h4>'
            f'<pre>{escape(body)}</pre></div>'
        )
    return f'<div class="prompt-library">{"".join(cards)}</div>'


def render_test_li(path: str, cls: str | None, t: dict, outcomes: dict) -> dict:
    key_prefix = f"{path}::{cls}::{t['name']}" if cls else f"{path}::{t['name']}"
    matched_nid, matched = None, None
    for nid, info in outcomes.items():
        if nid.startswith(key_prefix):
            matched_nid, matched = nid, info
            break
    outcome = matched["outcome"] if matched else ("skipped" if t["skipped_marker"] else "unknown")
    unfinished = outcome in {"failed", "error", "skipped", "unknown"}
    duration = f'{matched["duration"]*1000:.0f}ms' if matched and matched.get("duration") else ''
    err_html = ""
    if matched and matched["outcome"] in {"failed", "error"}:
        msg = matched["message"] or "(no message)"
        err_html = f'<div class="err">{escape(short(msg, 600))}</div>'
    snippet_html = f'<div class="snip">{escape(t["snippet"][:800])}</div>'
    doc_html = f'<div class="doc">{escape(t["doc"])}</div>' if t["doc"] else ""
    flags = ' <span class="mod-pill">async</span>' if t["is_async"] else ""
    if t["skipped_marker"]:
        flags += ' <span class="mod-pill">@skip</span>'
    name = t["name"]
    nid_for_prompt = matched_nid or key_prefix

    debug_prompt = (
        f"Debug failing pytest: {nid_for_prompt}\n\n"
        f"Error:\n{(matched['message'] if matched else '(not run)')[:1200]}\n\n"
        f"Source ({path}:{t['lineno']}):\n{t['snippet'][:800]}\n\n"
        "Root-cause and fix it minimally."
    )
    update_prompt = (
        f"Update test {nid_for_prompt} at {path}:{t['lineno']} to match the "
        "current scrapling implementation. Keep invariants strict."
    )
    create_prompt = (
        f"Add a sibling test next to {nid_for_prompt} that covers the missing "
        "boundary case (empty input, malformed selector, async cancellation — "
        "pick whichever applies). Match local style."
    )

    actions = (
        '<div class="actions">'
        f'<button data-prompt="{escape(debug_prompt, quote=True)}" onclick="copyPrompt(this)">debug</button>'
        f'<button data-prompt="{escape(update_prompt, quote=True)}" onclick="copyPrompt(this)">update</button>'
        f'<button data-prompt="{escape(create_prompt, quote=True)}" onclick="copyPrompt(this)">create</button>'
        f'<button data-prompt="{escape(nid_for_prompt, quote=True)}" onclick="copyPrompt(this)">copy id</button>'
        '</div>'
    )
    err_marker = ""
    if matched:
        err_marker = (matched.get("message") or "")[:160]
    li = (
        f'<li class="{outcome}" data-name="{escape(name, quote=True)}" '
        f'data-outcome="{outcome}" data-err="{escape(err_marker, quote=True)}">'
        f'<div class="row1">'
        f'<span class="name">{escape(name)}{flags}</span>'
        f'<span><span class="outcome {outcome}">{outcome}</span>'
        + (f' <span class="mod-pill">{duration}</span>' if duration else '')
        + '</span></div>'
        + doc_html
        + err_html
        + snippet_html
        + actions
        + '</li>'
    )
    return {"html": li, "unfinished": unfinished}


if __name__ == "__main__":
    html = render()
    OUT.write_text(html)
    size = OUT.stat().st_size
    print(f"wrote {OUT} ({size/1024:.1f} kB)")
