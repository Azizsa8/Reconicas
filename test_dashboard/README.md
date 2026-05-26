# Test Dashboard

Self-contained HTML view of the test suite — what's done, what's unfinished,
and what to do next.

## Files

- `generate.py` — scans `tests/` via AST and joins the result with the
  most recent pytest-json-report run.
- `pytest_report.json` — last run produced by `pytest --json-report`.
- `dashboard.html` — single-file dashboard (open in any browser).
- `manual.py` / `manual.html` — interactive **manual work queue**:
  every decision, scheduling slot, approval, ROADMAP discussion, and
  external-setup step the dashboard surfaces. Pick the ones you want
  to act on, choose between options inline, and the page assembles a
  single Claude-ready prompt from your selection. Regenerate with
  `python test_dashboard/manual.py`.
- `UNTOUCHED.md` — Wave 3 inventory (untested source modules + plan).
- `TEST_FIXES.md` — five-wave strategy doc.

## Regenerate

```bash
pip install pytest-json-report
python -m pytest tests/ \
  --json-report --json-report-file=test_dashboard/pytest_report.json \
  -p no:cacheprovider -o addopts=""
python test_dashboard/generate.py
```

The generator does **not** need pytest installed to run; it only reads the
JSON report. If the report is missing every test is reported as `unknown`.

## What's inside

1. **Summary stats** — total / passing / failing / skipped / unfinished.
2. **Next Movements** — failures grouped by root cause (missing dep,
   browser not installed, port collision …) plus open `ROADMAP.md` items
   and source modules with no matching test file.
3. **Feature Gallery** — one card per top-level test feature
   (`parser`, `fetchers`, `spiders`, `ai`, `cli`, `core`). Click a card
   to open its screen.
4. **Per-feature screen** — every module → class → test, with outcome
   pills, error text, source snippet, and three copy-ready prompts on
   each test (`debug`, `update`, `create`). Search box + "only
   unfinished" toggle at the top of each screen.
5. **Prompt Library** — reusable Claude prompts for debugging,
   updating, and authoring tests.
