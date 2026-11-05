"""AI accuracy benchmark — precision/recall on the golden set.

Run from backend/:
    python -m bench.evaluate          # live LLM (spends tokens)
    python -m bench.evaluate --mock   # deterministic path (CI-safe)

Mirrors the /review endpoint pipeline exactly (engine + a11y + compliance),
then scores category-level micro precision/recall plus critical-catch and
clean-copy false-critical rates. This is the proposal's tracked primary
metric: report it before/after any prompt or model change."""
import json
import sys
from pathlib import Path

from app import db
from app.engine import review as engine, a11y, compliance

GOLDEN = Path(__file__).parent / "golden_set.json"
MIN_RECALL = 0.80
MIN_PRECISION = 0.75


def _pipeline(text: str, ctype: str, use_mock: bool) -> list:
    """Exactly what POST /content/{id}/review assembles."""
    findings, *_ = engine.review(text, use_mock=use_mock)
    for d in a11y.check(text):
        d.setdefault("evidence", "WCAG")
        findings.append(engine.Finding(**d))
    for d in compliance.check(text, ctype):
        d.setdefault("evidence", "compliance")
        findings.append(engine.Finding(**d))
    # dedupe like the endpoint does
    uniq, seen = [], set()
    for f in findings:
        key = (f.category, engine._norm(f.excerpt) or engine._norm(f.rule))
        if key in seen:
            continue
        seen.add(key)
        uniq.append(f)
    return uniq


def run(use_mock: bool = False) -> dict:
    db.init()
    from app import seed
    seed.seed()
    seed.ensure_users()

    data = json.loads(GOLDEN.read_text())
    tp = fp = fn = 0
    crit_hit = crit_total = 0
    clean_fp = clean_total = 0
    rows = []

    for s in data["samples"]:
        findings = _pipeline(s["text"], s["type"], use_mock)
        pred = {f.category for f in findings}
        exp = set(s["expect"])
        hit = pred & exp
        tp += len(hit)
        fp += len(pred - exp)
        fn += len(exp - pred)
        if s.get("must_critical"):
            crit_total += 1
            if any(f.severity == "critical" for f in findings):
                crit_hit += 1
        if s.get("clean"):
            clean_total += 1
            if any(f.severity == "critical" for f in findings):
                clean_fp += 1
        rows.append((s["name"], sorted(pred), sorted(exp),
                     "OK" if not (pred - exp) and not (exp - pred)
                     else "MISS" if exp - pred else "FP"))

    prec = tp / (tp + fp) if tp + fp else 1.0
    rec = tp / (tp + fn) if tp + fn else 1.0
    crit_rate = crit_hit / crit_total if crit_total else 1.0
    clean_rate = clean_fp / clean_total if clean_total else 0.0
    verdict = (rec >= MIN_RECALL and prec >= MIN_PRECISION
               and crit_rate == 1.0 and clean_rate == 0.0)

    print(f"\n{'sample':44} {'predicted':26} {'expected':20} st")
    print("-" * 100)
    for name, pred, exp, st in rows:
        print(f"{name[:43]:44} {','.join(pred)[:25]:26} "
              f"{','.join(exp)[:19]:20} {st}")
    print("-" * 100)
    mode = "mock" if use_mock else "live"
    print(f"[{mode}] precision={prec:.2f} (min {MIN_PRECISION})  "
          f"recall={rec:.2f} (min {MIN_RECALL})  "
          f"critical_catch={crit_rate:.0%}  "
          f"clean_false_criticals={clean_fp}/{clean_total}  "
          f"-> {'PASS' if verdict else 'FAIL'}")
    return {"mode": mode, "precision": round(prec, 3),
            "recall": round(rec, 3), "critical_catch": crit_rate,
            "clean_false_criticals": clean_fp, "pass": verdict,
            "samples": len(rows)}


if __name__ == "__main__":
    result = run(use_mock="--mock" in sys.argv)
    sys.exit(0 if result["pass"] else 1)
