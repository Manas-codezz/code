"""Seed realistic brand guidelines + sample content for demo.

Re-runnable: clears and reloads brand tables; keeps user content untouched
unless reset=True (tests / fresh demo).
"""
from . import db

GUIDELINES = [
    ("Tone of Voice",
     "NovaPay speaks with confident, plain-spoken expertise. We are a trusted "
     "financial partner, never a hype machine.\n"
     "DO: use short sentences, active voice, second person ('you'), concrete "
     "numbers, and warm-but-professional reassurance.\n"
     "DON'T: use fear tactics, urgency countdowns, exclamation marks (max 1 per "
     "post), slang, emoji in body copy, hyperbole ('revolutionary', 'game-"
     "changing'), or informal contractions in legal-adjacent text.\n"
     "Reading level: grade 8-10 for marketing, grade 12+ for legal/disclaimer "
     "text. Address the reader as 'you', never 'the customer' or 'users'."),
    ("Terminology & Product Names",
     "Product names are 'NovaPay Wallet', 'NovaPay Business', and 'NovaPay "
     "Insights'. Never abbreviate to 'NP', 'Nova', or 'the app'.\n"
     "Competitors may not be named in marketing copy. Use 'other providers' "
     "if comparison is unavoidable.\n"
     "Money is written as 'USD 4.99' (currency code first), never '$4.99'. "
     "Percentages always include the percent sign: '2.4%'."),
    ("Claims & Compliance",
     "Any claim about fees, rates, uptime, user counts, or regulatory status "
     "must be traceable to an approved fact in the Fact Store.\n"
     "Prohibited absolute claims: 'guaranteed', 'risk-free', '100% secure', "
     "'always works', 'best in class'.\n"
     "Every promotional page must carry the disclaimer: 'NovaPay is a "
     "financial technology company, not a bank. Banking services provided by "
     "partner institutions, Members FDIC.'\n"
     "Never imply FDIC insurance covers investment products or crypto assets."),
    ("Visual Identity",
     "Primary brand color is Nova Blue #1B4DFF. Secondary is Ink #0F172A. "
     "Accent is Signal Green #10B981 (use sparingly, max 10% of canvas).\n"
     "Backgrounds must be Ink #0F172A, white #FFFFFF, or Nova Blue tint at "
     "≤8% opacity. Never use pure black #000000.\n"
     "Logo clear space equals the height of the Nova glyph on all sides. "
     "Never stretch, recolor outside palette, or add drop shadows to the logo.\n"
     "Approved font families: Inter (UI/marketing), IBM Plex Mono (data "
     "tables). Never use Comic Sans, Papyrus, or system default serif."),
    ("Accessibility",
     "All body text must meet WCAG 2.1 AA: contrast ratio ≥ 4.5:1 for normal "
     "text, ≥ 3:1 for large text (≥24px or ≥18.66px bold).\n"
     "Every image must have descriptive alt text; decorative images use "
     "alt=\"\". Links must use descriptive anchor text ('View pricing "
     "plans'), never 'click here'.\n"
     "Headings must follow a logical H1→H2→H3 hierarchy with no skipped "
     "levels. Minimum tap target 44×44px on mobile."),
]

GLOSSARY = [
    # (term, kind, note)
    ("NovaPay Wallet", "approved", "Primary consumer product name"),
    ("NovaPay Business", "approved", "SMB product name"),
    ("NovaPay Insights", "approved", "Analytics product name"),
    ("you", "approved", "Address the reader directly"),
    ("USD 4.99", "approved", "Currency-code-first money format"),
    ("partner institutions", "approved", "Correct term for issuing banks"),
    ("the app", "prohibited", "Never — use full product name"),
    ("NP Wallet", "prohibited", "No abbreviations of product names"),
    ("Nova", "prohibited", "No shorthand brand references"),
    ("guaranteed", "prohibited", "Absolute claim — legally unsafe"),
    ("risk-free", "prohibited", "Absolute claim — legally unsafe"),
    ("100% secure", "prohibited", "Absolute claim — cannot substantiate"),
    ("revolutionary", "prohibited", "Hyperbole — off-tone"),
    ("game-changing", "prohibited", "Hyperbole — off-tone"),
    ("act now", "prohibited", "Urgency tactic — off-tone"),
    ("hurry", "prohibited", "Urgency tactic — off-tone"),
    ("click here", "prohibited", "Accessibility — non-descriptive link text"),
    ("bank", "prohibited", "Do not call NovaPay a bank (unlicensed)"),
    ("users", "prohibited", "Address 'you', not third-person 'users'"),
    ("cheapest", "prohibited", "Unsubstantiated superlative"),
    ("fastest", "prohibited", "Unsubstantiated superlative"),
    ("best", "prohibited", "Unsubstantiated superlative"),
    ("$4.99", "prohibited", "Use USD 4.99 format"),
    # competitor names — enforced by engine/compliance.py
    ("Zenith Pay", "competitor", "Never name competitors — say 'other providers'"),
    ("SwiftWallet", "competitor", "Never name competitors — say 'other providers'"),
    ("PayCore", "competitor", "Never name competitors — say 'other providers'"),
    ("e.g.", "preferred", "Write 'for example' in marketing copy"),
    ("utilize", "preferred", "Write 'use' — plainer language"),
    ("commence", "preferred", "Write 'start'"),
    ("demonstrate", "preferred", "Write 'show'"),
]

FACTS = [
    ("NovaPay charges USD 4.99/month for the Wallet standard plan.", "Pricing page v12, 2026-10-01"),
    ("NovaPay Business has 42,000 active subscribers as of Q3 2026.", "Q3 2026 board report"),
    ("NovaPay platform uptime was 99.97% over the last 12 months.", "Status page, rolling 12-mo"),
    ("NovaPay is not a bank; banking services are provided by partner institutions, Members FDIC.", "Legal review 2026-09-15"),
    ("NovaPay Insights starts at USD 29/month.", "Pricing page v12, 2026-10-01"),
    ("Transfers between NovaPay Wallets settle instantly.", "Product spec v4.2"),
    ("NovaPay supports 34 countries for cross-border transfers.", "Coverage doc, 2026-10-20"),
]

COLORS = [
    ("#1B4DFF", "Nova Blue (primary)"),
    ("#0F172A", "Ink (secondary)"),
    ("#10B981", "Signal Green (accent)"),
    ("#FFFFFF", "White"),
]

SAMPLE_CONTENT = [
    # clean — should produce ~0 findings (carries the required disclaimer)
    ("Clean marketing blurb", "text",
     "Take control of your money with NovaPay Wallet. See every transaction "
     "in one place, set simple savings goals, and get real-time alerts. "
     "Standard plan is USD 4.99/month. View pricing plans to learn more. "
     "NovaPay is a financial technology company, not a bank. Banking "
     "services provided by partner institutions, Members FDIC.",
     "web"),
    # off-brand — many findings across categories
    ("Off-brand promo blast", "email",
     "HURRY!!! Act now and get the REVOLUTIONARY Nova app — the FASTEST, "
     "100% SECURE, RISK-FREE way to move money! Guaranteed returns for all "
     "our users! Click here to claim your free trial before it's gone!!! "
     "NovaPay is a bank backed by the government, so your money is always "
     "safe. Best fees anywhere at just $4.99.",
     "email"),
    # claims-heavy social post — includes an unverified count + competitor
    ("Unverified claims post", "social",
     "NovaPay Business now serves 100,000 subscribers with 100% uptime and "
     "the lowest fees in the industry — better than Zenith Pay and "
     "SwiftWallet. Our revolutionary Insights tool is game-changing. "
     "Try it free forever.",
     "social"),
]


def seed(reset: bool = False) -> dict:
    with db.get() as conn:
        if reset:
            for t in ("audit", "finding", "content", "guideline",
                      "glossary", "fact", "brand_color"):
                conn.execute(f"DELETE FROM {t}")
        if conn.execute("SELECT COUNT(*) c FROM guideline").fetchone()["c"]:
            return {"skipped": True}

        conn.executemany("INSERT INTO guideline (title, body) VALUES (?, ?)",
                         GUIDELINES)
        conn.executemany(
            "INSERT INTO glossary (term, kind, note) VALUES (?, ?, ?)",
            GLOSSARY)
        conn.executemany("INSERT INTO fact (claim, source) VALUES (?, ?)",
                         FACTS)
        conn.executemany("INSERT INTO brand_color (hex, name) VALUES (?, ?)",
                         COLORS)

        if reset or conn.execute("SELECT COUNT(*) c FROM content"
                                 ).fetchone()["c"] == 0:
            for title, typ, text, channel in SAMPLE_CONTENT:
                conn.execute(
                    "INSERT INTO content (type, title, text, channel, status,"
                    " created_by) VALUES (?,?,?,?, 'draft', 'creator')",
                    (typ, title, text, channel))
        conn.commit()

    return {"skipped": False,
            "guidelines": len(GUIDELINES), "glossary": len(GLOSSARY),
            "facts": len(FACTS), "colors": len(COLORS),
            "samples": len(SAMPLE_CONTENT)}


if __name__ == "__main__":
    db.init()
    print(seed(reset=True))
