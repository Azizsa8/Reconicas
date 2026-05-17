# Reconicas — Product Requirements Document

**Status:** Draft · MVP shipped
**Owner:** Azizsa8
**Last updated:** 2026-05-17
**Repo:** `azizsa8/reconicas` · package `reconicas/` (layered on the Scrapling engine)

---

## 1. Overview

**Reconicas** is a competition reconnaissance platform for online stores. It
watches competitor storefronts on a fixed schedule and reports price movements,
undercuts, and (later) inventory signals back to the store owner.

The launch wedge is **Salla store owners in Saudi Arabia**. Salla is a dominant
e-commerce SaaS in the GCC; its storefronts expose machine-readable web
standards (`sitemap.xml`, schema.org JSON-LD), which makes reliable, low-noise
extraction possible without scraping behind a login.

The MVP capability is **Price Radar**: track competitor SKU prices over time and
alert the store owner when a competitor undercuts them or moves a price.

### 1.1 One-line positioning

> Know what your competitors charge before your customers tell you.

---

## 2. Problem

Small and mid-size online store owners compete largely on price, but they have
no systematic visibility into competitor pricing:

- **Manual checking doesn't scale.** Owners eyeball a few competitor pages now
  and then. They miss price drops until sales fall.
- **Undercuts are silent.** A competitor cutting a price on a matched SKU is the
  single most actionable event, and it is exactly the one owners discover late.
- **No history.** Without a price timeline there is no way to tell a permanent
  repricing from a flash promotion.
- **Existing tools are built for Amazon/Shopify in the US/EU**, not for Salla/Zid
  storefronts, SAR pricing, or Arabic catalogs.

---

## 3. Target users

| Segment | Description | Primary need |
|---|---|---|
| **Primary** | Salla store owners in KSA, 1–3 person teams, 10–1,000 SKUs | Get told when a competitor undercuts them |
| **Secondary** | Zid store owners (next adapter) | Same, on a second platform |
| **Future** | Agencies managing several stores | Multi-store roll-up, API access |

User is **not** technical. They live in a dashboard and a messaging app
(WhatsApp), not a terminal. The CLI is an **operator** surface, not a customer
surface.

---

## 4. Goals & non-goals

### 4.1 Goals

- G1 — Detect competitor **undercuts** against the customer's own catalog and
  alert within one scan cycle.
- G2 — Maintain a **price history** per tracked competitor product.
- G3 — Deliver a periodic **digest** through plan-appropriate channels.
- G4 — Keep the system's scrape load a **constant the operator controls**, never
  a function of customer count.
- G5 — Monetize through **plan tiers** where every limit is a plan attribute.

### 4.2 Non-goals (for now)

- Not a price *optimization* / repricing engine — Reconicas reports, it does not
  reprice for the owner.
- Not a marketplace (Amazon/Noon) tracker — storefront SaaS only.
- No scraping behind authentication or of non-public data.
- No real-time / on-demand scraping triggered by user actions.
- No mobile app in the MVP (responsive web only).

---

## 5. Core design principles

These are load-bearing constraints, not preferences:

1. **Scraping never happens in response to a user action.** A scheduler enqueues
   jobs at a plan-defined cadence; a fixed-size worker pool drains the queue.
   User-facing surfaces only ever *read* pre-computed data.
2. **Concurrency is an operator constant.** Scrape parallelism is a fixed worker
   count, decoupled from how many customers exist. Growth never increases
   per-target request pressure.
3. **Extract from web standards, not layout.** Catalogs come from `sitemap.xml`;
   prices come from schema.org JSON-LD `Product` blocks. Both survive theme and
   layout changes.
4. **Public data only.** Nothing behind a login, ever.
5. **Every limit is a plan attribute.** Limits live in one place (`plans.py`) and
   are enforced at exactly two layers: the scheduler and the API/export layer.

---

## 6. System architecture

```
                    ┌──────────────┐
   plan cadence ───▶ │  scheduler   │ enqueues scan_jobs (queued)
                    └──────┬───────┘
                           │  SQLite-backed queue
                    ┌──────▼───────┐
   operator-set N ─▶│ worker pool  │ drains queue → scanner.run_scan()
                    └──────┬───────┘
                           │
        ┌──────────────────┼───────────────────┐
        ▼                  ▼                   ▼
   adapters/          detection            price_snapshots
  (Salla, Zid…)   (undercut, drop/rise)      + alerts
        │                                       │
        │                                  ┌────▼────┐
        │                                  │ digest  │ plan-gated channels
        │                                  └────┬────┘
        │                            email / dashboard / whatsapp
        ▼
   competitor storefronts (sitemap.xml + JSON-LD)

   dashboard ──reads──▶ pre-computed data (never scrapes)
```

### 6.1 Modules (`reconicas/`)

| Module | Responsibility |
|---|---|
| `db.py` | SQLite schema + connection. SQLite doubles as the persistent job queue. |
| `plans.py` | Plan tier definitions; the single source of all customer limits. |
| `adapters/base.py` | `ProductData` shape + adapter interface. |
| `adapters/salla.py` | Salla adapter: sitemap discovery + JSON-LD price extraction. |
| `scanner.py` | Runs one competitor scan: fetch → upsert products → snapshot prices → raise alerts. Pure orchestration. |
| `detection.py` | Pure logic: price-movement and undercut alerts, own-product matching. No I/O. |
| `scheduler.py` | Enqueues due scan jobs. Enforces competitor-count and cadence limits. |
| `worker.py` | Fixed-size pool that drains the `scan_jobs` queue. |
| `digest.py` | Builds text digests from pending alerts; plan-gated delivery. |
| `dashboard.py` | Read-only web surface (stdlib `http.server`). Plan-gated. |
| `cli.py` | Operator CLI entry point. |

---

## 7. Data model

SQLite (`reconicas.db`), WAL mode, foreign keys on. SQLite is intentional for the
MVP — it is also the job queue, so no Redis/broker is needed.

| Table | Purpose | Key columns |
|---|---|---|
| `customers` | The store owner (the paying user) | `name`, `email`, `plan`, `currency` |
| `competitors` | A competitor storefront a customer watches | `customer_id`, `label`, `platform`, `store_url` |
| `products` | A tracked competitor product | `competitor_id`, `external_id`, `sku`, `name`, `url`, `first/last_seen_at` |
| `price_snapshots` | One observed price at one point in time | `product_id`, `price`, `currency`, `availability`, `scanned_at` |
| `own_products` | The customer's own catalog (undercut basis) | `customer_id`, `sku`, `name`, `price` |
| `scan_jobs` | Persistent scan queue | `competitor_id`, `status` (`queued→running→done\|failed`), timestamps, `error` |
| `alerts` | A detected event for a customer | `kind`, `message`, `old_price`, `new_price`, `delivered` |

Indexes: snapshots by `(product_id, scanned_at)`, jobs by `status`, alerts by
`(customer_id, delivered)`.

---

## 8. Plan tiers

All limits are attributes of `Plan` in `plans.py`.

| Attribute | Free | Starter | Pro |
|---|---|---|---|
| Max competitors | 1 | 3 | 10 |
| Max products / competitor | 10 | 200 | unlimited |
| Scan cadence | weekly (168h) | daily (24h) | twice daily (12h) |
| Delivery channels | email | email, dashboard | email, dashboard, whatsapp |
| Export row cap | 0 | 500 | unlimited |
| API access | no | no | yes |

**Enforcement points (only two):**
- *Scheduler* — competitor count (`LIMIT max_competitors`) and cadence
  (`scan_interval_hours`).
- *API / export layer* — row caps and API access. (Export/API surfaces are
  roadmap, not yet built.)

The Salla adapter additionally honors `max_products` as a scan `limit`.

---

## 9. Features

### 9.1 Price Radar (MVP — shipped)

The end-to-end pipeline: `schedule → work → digest`.

- **Catalog discovery** — Salla adapter reads `sitemap.xml` to enumerate product
  URLs.
- **Price extraction** — reads schema.org JSON-LD `Product` blocks for price,
  currency, availability, SKU.
- **Snapshotting** — every scan writes a `price_snapshots` row, building history.
- **Detection** (`detection.py`, pure):
  - `price_drop` / `price_rise` — competitor price moved between scans, with %.
  - `undercut` — a competitor product **matched to the customer's own product**
    is priced below the customer's price.
  - Own-product matching: exact SKU match preferred; normalized name match as
    fallback. Undercut is only re-evaluated on first sighting or a price change,
    so the digest does not repeat the same alert every cycle.

### 9.2 Digest delivery (MVP — partial)

- `build_digest()` renders a grouped text report of *undelivered* alerts.
- `deliver_digests()` walks every customer, sends through the channels their plan
  allows, and marks alerts delivered.
- **Channel send functions are stubs today** (`print`-based). Channel-gating and
  the alert lifecycle are real. Wiring real SMTP and the WhatsApp Business API is
  a roadmap milestone.

### 9.3 Web dashboard (shipped — PR #2)

Read-only, dependency-free (stdlib `http.server`), consistent with principle #1.

| Route | Shows |
|---|---|
| `/` | Customer index — competitor count, pending-alert count |
| `/customer/<id>` | Overview — competitors, recent alerts, own catalog |
| `/competitor/<id>` | Tracked products with latest observed price |
| `/product/<id>` | Full price-snapshot history |

- The data layer (`*_view` functions) is pure (connection in, dicts out) and
  unit-tested without HTTP.
- **Plan-gated**: a customer whose plan lacks the `dashboard` channel sees an
  upgrade prompt instead of the overview.
- All output HTML-escaped.
- Served via `reconicas dashboard --db <path> --host <host> --port <port>`.

### 9.4 Operator CLI (MVP — shipped)

`init-db`, `add-customer`, `add-competitor`, `add-own-product`, `schedule`,
`work`, `digest`, `run-all`, `dashboard`.

---

## 10. User flows

### 10.1 Onboarding (operator-assisted in MVP)

1. Operator registers the customer (`add-customer`, with a plan).
2. Customer's competitors are added (`add-competitor`), capped by plan.
3. Customer's own catalog is loaded (`add-own-product`) — the undercut basis.

### 10.2 Steady state (automated)

1. `scheduler` enqueues due scans per plan cadence.
2. `worker` pool drains the queue; `scanner` fetches, snapshots, detects.
3. `digest` builds and delivers reports through plan channels.
4. Customer reads the dashboard / receives the digest.

---

## 11. Success metrics

| Metric | Target (first 90 days post-launch) |
|---|---|
| Activation — customers with ≥1 competitor and own catalog loaded | ≥ 70% of signups |
| Time-to-first-alert | within one scan cycle of the plan |
| Alert precision — undercut alerts judged correct by the owner | ≥ 90% |
| Digest engagement — digests opened / dashboard visits per week | ≥ 2 per active customer |
| Free → paid conversion | ≥ 8% within 30 days |
| Scrape reliability — scan jobs finishing `done` not `failed` | ≥ 95% |

---

## 12. Quality & non-functional requirements

- **Extraction robustness** — survives storefront theme changes (web-standard
  sources only).
- **Politeness** — fixed worker concurrency; per-target request pressure is
  bounded regardless of customer growth.
- **Data integrity** — foreign keys enforced; scan jobs have an explicit
  `queued→running→done|failed` lifecycle with error capture.
- **Security** — public data only; no credentials stored for competitor sites;
  all dashboard output HTML-escaped; SQL strictly parameterized.
- **Testability** — detection and dashboard data layers are pure and unit-tested
  (27 tests in `tests/reconicas/`); the full pipeline has integration tests.
- **Localization-ready** — currency is per-customer; Arabic/RTL is a roadmap item.

---

## 13. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Salla storefront stops exposing clean JSON-LD | Extraction breaks | Web-standard sources are widely used; adapter is isolated; validate against real stores before scaling |
| Competitor blocks scraping | Missed scans | Fixed low concurrency; Scrapling's undetectable fetchers; back off on failure |
| Name-based own-product matching is fuzzy | False/missed undercut alerts | Prefer exact SKU match; encourage owners to load SKUs; tune normalization |
| SQLite as queue under load | Contention at scale | Acceptable for MVP scale; migrate queue to a broker if worker pool must grow |
| Stub delivery channels | No real alerts reach customers | Tracked as the next milestone (real SMTP + WhatsApp Business API) |

---

## 14. Roadmap

| Milestone | Status |
|---|---|
| Price Radar pipeline (Salla) | ✅ Shipped (PR #1) |
| Operator CLI | ✅ Shipped |
| Read-only web dashboard | ✅ Shipped (PR #2) |
| Validate against real Salla storefronts | ⏳ Next |
| Real delivery — SMTP email + WhatsApp Business API | ⏳ Next |
| Zid platform adapter | Planned |
| Arabic / RTL localization | Planned |
| Customer self-service onboarding (replace operator CLI) | Planned |
| CSV export + public API (Pro plan) | Planned |
| Bestseller inference via stock-depletion velocity | Exploration |

---

## 15. Open questions

- Self-service signup & billing: which payment provider for KSA (Moyasar / Tap)?
- Authentication model for the customer-facing dashboard (currently operator-run,
  no auth).
- Own-catalog sync — manual entry vs. importing the customer's own Salla store.
- Digest cadence: fixed to plan, or customer-configurable within plan bounds?
- WhatsApp Business API: template approval and opt-in handling in KSA.
