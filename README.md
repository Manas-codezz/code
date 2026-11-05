# BrandGuard AI

Brand-compliance review engine: submit content → AI reviews it against brand
guidelines, glossary and fact store → findings with fixes → human approval →
team analytics. AI findings are **advisory — a human always makes the final
call**.

## Run locally

```bash
# 1. python 3.12 + deps
uv venv --python 3.12 && uv pip install -e "backend[dev]"

# 2. key (already in .env at repo root)
# LLM_PROVIDER=groq  GROQ_API_KEY=...  GROQ_MODEL=openai/gpt-oss-120b

# 3. server (from backend/)
cd backend && ../.venv/bin/uvicorn app.main:app --port 8001
# API docs: http://localhost:8001/docs
```

`LLM_PROVIDER=mock` runs the whole API with no key (tests/demo).

## Test

```bash
cd backend && ../.venv/bin/python -m pytest -q        # 60 tests
cd backend && ../.venv/bin/python -m bench.evaluate   # live accuracy gate
cd backend && ../.venv/bin/python -m bench.evaluate --mock   # offline gate
cd backend && ../.venv/bin/python -m bench.load_test --n 50  # p95 budget
```

Accuracy gates: precision ≥ 0.75, recall ≥ 0.80, critical-catch 100%,
zero false-criticals on clean copy. Latest live run: **P=0.83 R=1.00**.

## Demo logins (seeded)

| Email                       | Password    | Role     | Team      |
| --------------------------- | ----------- | -------- | --------- |
| creator@brandguard.demo     | creator123  | creator  | marketing |
| reviewer@brandguard.demo    | reviewer123 | reviewer | marketing |
| manager@brandguard.demo     | manager123  | manager  | brand     |
| admin@brandguard.demo       | admin12345  | admin    | brand     |

Roles gate routes: review→reviewer+, KB edit→manager+, analytics→manager+,
user management & KB import/export→admin.

## API (frontend contract)

| Method | Path                            | Purpose                                    |
| ------ | ------------------------------- | ------------------------------------------ |
| POST   | `/auth/login`                   | JWT access + rotating refresh token        |
| POST   | `/auth/refresh`                 | new access token                           |
| GET    | `/auth/me`                      | current user (role, team)                  |
| GET    | `/health`                       | status + AI/model disclosure               |
| POST   | `/content`                      | create content (inherits creator's team)   |
| GET    | `/content`                      | list (`?status=` filter)                   |
| GET    | `/content/{id}`                 | content + findings                         |
| POST   | `/content/{id}/review`          | run engine (`?force_mock=true` skips LLM)  |
| PATCH  | `/findings/{id}`                | `{"accepted": 0\|1\|2}`                    |
| POST   | `/content/{id}/approve`         | blocked while criticals unresolved (409)   |
| POST   | `/content/{id}/request-changes` | set status=changes                         |
| POST   | `/content/{id}/upload`          | image upload (5MB, PIL-verified)           |
| GET    | `/content/{id}/diff`            | version history + unified diff             |
| POST   | `/content/{id}/comments`        | peer-review comment threads                |
| POST   | `/content/{id}/publish`         | signed webhook out (HMAC-SHA256)           |
| GET    | `/analytics/summary`            | compliance, teams, heat map, overdue, stale|
| GET    | `/audit`                        | tamper-evident hash-chain trail            |
| CRUD   | `/kb/{guidelines,glossary,facts,colors}` | brand knowledge base (manager+)   |

Finding shape: `{id, content_id, category, severity, rule, excerpt,
suggestion, accepted, confidence, evidence}` — categories
`tone|term|claim|a11y|visual`, severities `critical|warning|suggestion`.
`evidence` cites the guideline/glossary/fact that justifies the finding.

## Architecture

- **One LLM call** (Groq `openai/gpt-oss-120b`, JSON mode) covers tone,
  terminology and claims; falls back Groq → OpenAI → deterministic-only.
- **Deterministic checks always run**: glossary regex, WCAG contrast math,
  heading/alt-text structure, reading level, disclaimer presence, competitor
  mentions, amounts-vs-Fact-Store, brand-colour distance (Pillow).
- **RAG**: BM25 retrieval over guidelines seeds the prompt; every finding
  carries `evidence` (which rule/glossary entry/fact justified it).
- **Accuracy benchmark** (`bench/`): 12-sample golden set gates every change
  on precision/recall/critical-catch; runs in CI with the mock provider.
- **Security**: content delimited as untrusted data (prompt-injection test
  passes live), excerpts must be grounded in the content (hallucination
  filter), prompt-leak filter drops system-prompt echoes, rate limit
  10/min/IP, upload PIL verification + 5MB cap, keys only in env,
  bcrypt+JWT auth, security headers, no-store on responses, generic 500s.

## Governance & audit

- **Tamper-evident audit log**: every action appends
  `(prev_hash → sha256)` chains; `/audit` exposes `verify_chain` results —
  any row edited out-of-band breaks the chain visibly.
- **Human-in-the-loop**: approve is blocked (409) while any critical finding
  is unresolved (`accepted != 1`); audit records who approved and when.
- **AI disclosure**: `/health` names the active model and states findings are
  advisory; FastAPI description repeats it; UI must show the same banner.
- **SLA**: submitting a draft stamps `sla_due_at` (+4h); the analytics
  dashboard lists overdue reviews with hours-late.
- **Fact freshness**: facts older than 90 days surface in analytics as
  `stale_facts` so legal can re-verify before claims go out.
- **Secrets**: `.env` is gitignored; CI uses a dummy `JWT_SECRET`; webhook
  signatures are HMAC-SHA256 over the raw body with a shared secret.

## Deploy (any PaaS: Render/Railway/Fly)

```bash
# build: pip install -r backend/requirements.txt
# start: uvicorn app.main:app --host 0.0.0.0 --port $PORT
# env:   GROQ_API_KEY, LLM_PROVIDER=groq, CORS_ORIGINS=https://your-frontend,
#        JWT_SECRET, WEBHOOK_SECRET, DATABASE_PATH=/data/brandguard.db
```

SQLite file lives at `DATABASE_PATH` (set it to a persistent volume path in
prod). Single instance — rate limiter is in-memory per process.

## v1.1 roadmap (deliberately not built)

Multi-tenant RBAC, white-label, Redis-backed rate limits, logo template
matching, guideline version UI, DDoS/DR, multi-LLM routing policies.
