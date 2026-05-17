"""Reconicas — competition reconnaissance for online stores.

A subscription platform that watches competitor storefronts (Salla first,
Zid next) on a fixed schedule and reports price movements to the store owner.

Design principle: scraping never happens in response to a user action.
A scheduler enqueues scan jobs at a plan-defined cadence, and a fixed-size
worker pool drains the queue. User-facing surfaces only read pre-computed
data, so the system's concurrency is a constant the operator sets — not a
function of how many customers exist.
"""

__version__ = "0.1.0"
