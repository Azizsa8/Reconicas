"""Subscription plan tiers.

Every customer limit lives here as a plan attribute. Limits are enforced in
two places only: the scheduler (competitor count, scan cadence) and the
API/export layer (row caps, API access). There is no live-traffic throttling
because users never trigger scrapes directly.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# Scan cadence expressed as the minimum number of hours between scans.
FREQUENCY_HOURS = {
    "weekly": 168,
    "daily": 24,
    "twice_daily": 12,
}


@dataclass(frozen=True)
class Plan:
    key: str
    name: str
    max_competitors: int
    # None means unlimited products tracked per competitor.
    max_products: int | None
    scan_frequency: str
    channels: frozenset[str]
    # None means unlimited export rows.
    export_rows: int | None
    api_access: bool

    @property
    def scan_interval_hours(self) -> int:
        return FREQUENCY_HOURS[self.scan_frequency]


PLANS: dict[str, Plan] = {
    "free": Plan(
        key="free",
        name="Free",
        max_competitors=1,
        max_products=10,
        scan_frequency="weekly",
        channels=frozenset({"email"}),
        export_rows=0,
        api_access=False,
    ),
    "starter": Plan(
        key="starter",
        name="Starter",
        max_competitors=3,
        max_products=200,
        scan_frequency="daily",
        channels=frozenset({"email", "dashboard"}),
        export_rows=500,
        api_access=False,
    ),
    "pro": Plan(
        key="pro",
        name="Pro",
        max_competitors=10,
        max_products=None,
        scan_frequency="twice_daily",
        channels=frozenset({"email", "dashboard", "whatsapp"}),
        export_rows=None,
        api_access=True,
    ),
}

DEFAULT_PLAN = "free"


def get_plan(key: str) -> Plan:
    try:
        return PLANS[key]
    except KeyError:
        raise ValueError(
            f"Unknown plan {key!r}. Valid plans: {', '.join(PLANS)}"
        ) from None
