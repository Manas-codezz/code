"""Explicit content state machine.

The legal status graph and the minimum role for each edge live here, in one
auditable table — endpoints call require_transition() instead of scattering
`if status == ...: raise 409` guards. Any move not in this table is illegal.

    draft ──review──► review ──peer approve──► peer_review ──approve──► approved ──publish──► published
      ▲                 │  │                        │                     │
      │                 │  └──peer reject──► changes │                     └──(terminal)
      │                 └──manager approve──► approved
      └──────────── edit / remediate ────── changes ◄──manager request-changes──┘
"""
from fastapi import HTTPException

_ROLE_RANK = {"creator": 0, "reviewer": 1, "manager": 2, "admin": 3}

# Statuses a piece of content can never leave (locked for edits/re-review).
LOCKED = frozenset({"approved", "published"})

# from-status -> {to-status: minimum role allowed to make that move}
TRANSITIONS: dict[str, dict[str, str]] = {
    "draft": {
        "draft": "creator",          # edit (self-loop, no status change)
        "review": "creator",         # submit for AI review
        "changes": "manager",        # manager sends a raw draft back
    },
    "review": {
        "review": "creator",         # re-run review (status unchanged)
        "peer_review": "reviewer",   # peer approves
        "changes": "reviewer",       # peer rejects
        "approved": "manager",       # manager approves
        "draft": "creator",          # edit invalidates findings
    },
    "peer_review": {
        "approved": "manager",
        "changes": "manager",
        "draft": "creator",
    },
    "changes": {
        "draft": "creator",          # edit / remediate
        "review": "creator",         # remediate re-review
    },
    "approved": {
        "published": "manager",
    },
    "published": {},                 # terminal
}


def can_transition(frm: str, to: str, role: str) -> bool:
    """True when `role` may move content from `frm` to `to`."""
    need = TRANSITIONS.get(frm, {}).get(to)
    if need is None:
        return False
    return _ROLE_RANK.get(role, -1) >= _ROLE_RANK[need]


def require_transition(frm: str, to: str, role: str) -> None:
    """Raise 409 unless `role` may move content from `frm` to `to`."""
    if not can_transition(frm, to, role):
        raise HTTPException(
            409, f"illegal transition '{frm}' -> '{to}' for role '{role}'")


if __name__ == "__main__":  # ponytail: one runnable check for the graph
    assert can_transition("draft", "review", "creator")
    assert can_transition("review", "approved", "manager")
    assert can_transition("review", "approved", "admin")       # admin >= manager
    assert not can_transition("review", "approved", "reviewer")  # role too low
    assert can_transition("review", "peer_review", "reviewer")
    assert can_transition("peer_review", "changes", "manager")
    assert can_transition("changes", "review", "creator")      # remediate
    assert can_transition("approved", "published", "manager")
    assert not can_transition("published", "published", "admin")  # terminal
    assert not can_transition("draft", "approved", "manager")     # must review first
    assert not can_transition("approved", "changes", "manager")   # can't un-approve
    assert "approved" in LOCKED and "published" in LOCKED
    print("state machine graph OK")
