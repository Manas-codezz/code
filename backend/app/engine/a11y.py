"""Deterministic accessibility checks — WCAG 2.1 contrast math + structure.

Pure stdlib: relative-luminance / contrast-ratio from the WCAG spec. No LLM,
so these always fire and are unit-testable against known values."""
import re


# --- contrast math ---------------------------------------------------------
def _srgb(c: float) -> float:
    c /= 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminance(hex_color: str) -> float:
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * _srgb(r) + 0.7152 * _srgb(g) + 0.0722 * _srgb(b)


def contrast_ratio(fg: str, bg: str) -> float:
    l1, l2 = luminance(fg), luminance(bg)
    lighter, darker = max(l1, l2), min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


# --- checks ----------------------------------------------------------------
def check_contrast(pairs: list[tuple[str, str, str]]) -> list[dict]:
    """pairs: [(fg_hex, bg_hex, label)]. Returns findings for AA failures."""
    out = []
    for fg, bg, label in pairs:
        try:
            ratio = contrast_ratio(fg, bg)
        except (ValueError, IndexError):
            continue
        if ratio < 4.5:
            out.append({
                "category": "a11y",
                "severity": "critical" if ratio < 3.0 else "warning",
                "rule": f"WCAG AA contrast {ratio:.2f}:1 < 4.5:1 ({label})",
                "excerpt": f"{fg} on {bg}",
                "suggestion": (f"Darken/lighten to reach ≥4.5:1; "
                               f"e.g. #0F172A on #FFFFFF gives 16.5:1."),
            })
    return out


def check_structure(text: str) -> list[dict]:
    """Alt-text / heading / link-text checks for HTML or markdown copy."""
    out = []
    if not text.strip():
        return out

    # images must have alt text
    for m in re.finditer(r"<img[^>]*>", text, re.IGNORECASE):
        tag = m.group(0)
        if not re.search(r'alt\s*=\s*"[^"]+"', tag, re.IGNORECASE):
            out.append({
                "category": "a11y", "severity": "critical",
                "rule": "Image missing descriptive alt text",
                "excerpt": tag[:80],
                "suggestion": 'Add alt="…" describing the image '
                              '(or alt="" if decorative).',
            })

    # heading hierarchy: no skipped levels
    levels = [int(h) for h in re.findall(r"<h([1-6])", text, re.IGNORECASE)]
    for a, b in zip(levels, levels[1:]):
        if b > a + 1:
            out.append({
                "category": "a11y", "severity": "warning",
                "rule": f"Heading level skipped H{a} → H{b}",
                "excerpt": f"<h{a}>…<h{b}>",
                "suggestion": "Use sequential headings (H1→H2→H3).",
            })

    # non-descriptive link text
    for m in re.finditer(r"<a[^>]*>(.*?)</a>", text,
                         re.IGNORECASE | re.DOTALL):
        anchor = re.sub(r"<[^>]+>", "", m.group(1)).strip()
        if anchor.lower() in ("click here", "here", "read more", "more"):
            out.append({
                "category": "a11y", "severity": "warning",
                "rule": "Non-descriptive link text",
                "excerpt": anchor,
                "suggestion": "Use descriptive anchor text "
                              "(e.g. 'View pricing plans').",
            })
    return out


def check_reading(text: str) -> list[dict]:
    """Flesch-Kincaid grade level — flag marketing copy above grade 10."""
    sentences = re.split(r"[.!?]+", text)
    sentences = [s for s in sentences if s.strip()]
    words = re.findall(r"[A-Za-z']+", text)
    if len(sentences) < 2 or len(words) < 20:
        return []

    def syllables(w: str) -> int:
        w = w.lower().strip("'")
        w = re.sub(r"[^a-z]", "", w)
        if not w:
            return 0
        groups = re.findall(r"[aeiouy]+", w)
        n = len(groups)
        if w.endswith("e") and n > 1 and not w.endswith(("le", "ee", "ye")):
            n -= 1
        return max(1, n)

    syl = sum(syllables(w) for w in words)
    grade = (0.39 * (len(words) / len(sentences))
             + 11.8 * (syl / len(words)) - 15.59)
    if grade > 10:
        return [{
            "category": "a11y", "severity": "suggestion",
            "rule": f"Reading level grade {grade:.1f} > grade 10 "
                    "(marketing target: 8–10)",
            "excerpt": " ".join(words[:12]) + "…",
            "suggestion": "Shorten sentences and use plainer words.",
        }]
    return []


def check(text: str, image: bool = False) -> list[dict]:
    out = check_structure(text) + check_reading(text)
    if image and not text.strip():
        out.append({
            "category": "a11y", "severity": "critical",
            "rule": "Uploaded image has no alt text / description",
            "excerpt": "",
            "suggestion": "Provide alt text describing the image content.",
        })
    return out
