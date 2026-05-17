"""Command-line entry point for operating Reconicas."""

from __future__ import annotations

import argparse

from . import db as _db
from .digest import deliver_digests
from .plans import PLANS
from .scheduler import schedule_scans
from .worker import run_workers


def _add_db_arg(p: argparse.ArgumentParser) -> None:
    p.add_argument("--db", default=str(_db.DEFAULT_DB_PATH), help="SQLite path")


def cmd_init_db(args) -> None:
    _db.init_db(args.db)
    print(f"Initialised database at {args.db}")


def cmd_add_customer(args) -> None:
    if args.plan not in PLANS:
        raise SystemExit(f"Unknown plan {args.plan!r}. Choose: {', '.join(PLANS)}")
    conn = _db.connect(args.db)
    try:
        cur = conn.execute(
            "INSERT INTO customers (name, email, plan, currency) VALUES (?, ?, ?, ?)",
            (args.name, args.email, args.plan, args.currency),
        )
        conn.commit()
        print(f"Customer {cur.lastrowid} created ({args.name}, plan={args.plan})")
    finally:
        conn.close()


def cmd_add_competitor(args) -> None:
    conn = _db.connect(args.db)
    try:
        cur = conn.execute(
            "INSERT INTO competitors (customer_id, label, platform, store_url) "
            "VALUES (?, ?, ?, ?)",
            (args.customer_id, args.label, args.platform, args.url),
        )
        conn.commit()
        print(f"Competitor {cur.lastrowid} added for customer {args.customer_id}")
    finally:
        conn.close()


def cmd_add_own_product(args) -> None:
    conn = _db.connect(args.db)
    try:
        cur = conn.execute(
            "INSERT INTO own_products (customer_id, sku, name, price) "
            "VALUES (?, ?, ?, ?)",
            (args.customer_id, args.sku, args.name, args.price),
        )
        conn.commit()
        print(f"Own product {cur.lastrowid} added for customer {args.customer_id}")
    finally:
        conn.close()


def cmd_schedule(args) -> None:
    conn = _db.connect(args.db)
    try:
        print(f"Enqueued {schedule_scans(conn)} scan job(s)")
    finally:
        conn.close()


def cmd_work(args) -> None:
    results = run_workers(args.db, max_workers=args.workers)
    ok = sum(1 for r in results if r["ok"])
    print(f"Processed {len(results)} job(s): {ok} ok, {len(results) - ok} failed")
    for r in results:
        if not r["ok"]:
            print(f"  job {r['job_id']} failed: {r['error']}")


def cmd_digest(args) -> None:
    conn = _db.connect(args.db)
    try:
        delivered = deliver_digests(conn)
        print(f"Delivered {len(delivered)} digest(s)")
    finally:
        conn.close()


def cmd_run_all(args) -> None:
    cmd_schedule(args)
    cmd_work(args)
    cmd_digest(args)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="reconicas", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("init-db", help="Create the database schema")
    _add_db_arg(p)
    p.set_defaults(func=cmd_init_db)

    p = sub.add_parser("add-customer", help="Register a customer")
    _add_db_arg(p)
    p.add_argument("--name", required=True)
    p.add_argument("--email", required=True)
    p.add_argument("--plan", default="free")
    p.add_argument("--currency", default="SAR")
    p.set_defaults(func=cmd_add_customer)

    p = sub.add_parser("add-competitor", help="Add a competitor to watch")
    _add_db_arg(p)
    p.add_argument("--customer-id", type=int, required=True)
    p.add_argument("--label", required=True)
    p.add_argument("--url", required=True)
    p.add_argument("--platform", default="salla")
    p.set_defaults(func=cmd_add_competitor)

    p = sub.add_parser("add-own-product", help="Add one of the customer's own products")
    _add_db_arg(p)
    p.add_argument("--customer-id", type=int, required=True)
    p.add_argument("--name", required=True)
    p.add_argument("--price", type=float, required=True)
    p.add_argument("--sku", default=None)
    p.set_defaults(func=cmd_add_own_product)

    p = sub.add_parser("schedule", help="Enqueue due scan jobs")
    _add_db_arg(p)
    p.set_defaults(func=cmd_schedule)

    p = sub.add_parser("work", help="Drain the scan queue")
    _add_db_arg(p)
    p.add_argument("--workers", type=int, default=3)
    p.set_defaults(func=cmd_work)

    p = sub.add_parser("digest", help="Build and deliver digests")
    _add_db_arg(p)
    p.set_defaults(func=cmd_digest)

    p = sub.add_parser("run-all", help="schedule + work + digest in one pass")
    _add_db_arg(p)
    p.add_argument("--workers", type=int, default=3)
    p.set_defaults(func=cmd_run_all)

    return parser


def main(argv: list[str] | None = None) -> None:
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
