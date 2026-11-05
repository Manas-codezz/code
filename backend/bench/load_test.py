"""Concurrency smoke: N parallel mock reviews through the real ASGI app.

Run:  python -m bench.load_test --n 50
Fails if any request errors or p95 latency exceeds the budget.
"""
import argparse
import statistics
import sys
import time
from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient

from app import db, seed
from app.main import app

p95_budget_ms = 3000   # mock path — no network; generous for CI runners


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=50)
    args = ap.parse_args()

    db.init()
    seed.seed()
    seed.ensure_users()
    from app.settings import settings
    settings.review_rate_per_min = 10_000   # we're the load generator

    client = TestClient(app)
    tok = client.post("/auth/login", json={
        "email": "creator@brandguard.demo",
        "password": "creator123"}).json()["access_token"]
    h = {"Authorization": f"Bearer {tok}"}
    cid = client.post("/content", headers=h, json={
        "type": "text", "title": "load", "text": "Act now, guaranteed $1.00",
        "channel": "web"}).json()["id"]

    def one(_: int) -> tuple[float, int]:
        t0 = time.perf_counter()
        r = client.post(f"/content/{cid}/review?force_mock=true", headers=h)
        return (time.perf_counter() - t0) * 1000, r.status_code

    with ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(one, range(args.n)))

    lat = sorted(ms for ms, _ in results)
    bad = [c for _, c in results if c >= 500]
    p95 = lat[int(len(lat) * 0.95) - 1]
    print(f"n={args.n}  errors={len(bad)}  "
          f"p50={statistics.median(lat):.0f}ms  p95={p95:.0f}ms  "
          f"max={lat[-1]:.0f}ms")
    if bad or p95 > p95_budget_ms:
        print(f"FAIL (errors={len(bad)}, p95 budget {p95_budget_ms}ms)")
        return 1
    print("PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
