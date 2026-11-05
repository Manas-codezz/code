"""Mock engine for offline demo / tests. Same output shape as the LLM.

Detects known bad patterns so the demo is deterministic without a key."""
import re


def findings(text: str) -> list["Finding"]:  # noqa: F821
    from ..models import Finding
    out: list[Finding] = []
    low = text.lower()

    def add(cat, sev, rule, excerpt, fix):
        out.append(Finding(category=cat, severity=sev, rule=rule,
                           excerpt=excerpt, suggestion=fix))

    # tone
    if "!!" in text or text.count("!") > 1:
        add("tone", "warning", "Max one exclamation mark per post",
            "!", "Keep a single exclamation mark at most.")
    for w in ("hurry", "act now", "before it's gone", "free forever"):
        if w in low:
            add("tone", "critical", "Urgency / pressure tactics are off-tone",
                w, "Remove urgency; state the benefit calmly.")
    for w in ("revolutionary", "game-changing", "game changing"):
        if w in low:
            add("tone", "warning", "Hyperbole is off-tone", w,
                "Replace with a concrete, specific benefit.")

    # claims
    for w in ("guaranteed", "risk-free", "100% secure", "100% uptime",
              "always safe", "best fees", "lowest fees", "fastest",
              "100,000", "free forever"):
        if w in low:
            add("claim", "critical",
                "Absolute / unverified claim not in the Fact Store", w,
                "Cite an approved fact or remove the claim.")
    if re.search(r"\bbank\b", low) and "not a bank" not in low:
        add("claim", "critical",
            "NovaPay is not a bank — calling it one is a compliance breach",
            "bank", "Use 'financial technology company, not a bank'.")

    # money format
    if re.search(r"\$\d", text):
        m = re.search(r"\$\d[\d.]*", text)
        add("term", "critical", "Money must be currency-code-first (USD 4.99)",
            m.group(0), "Rewrite as " + m.group(0).replace("$", "USD "))
    return out
