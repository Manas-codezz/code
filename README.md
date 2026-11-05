# BrandGuard AI

Brand-compliance review engine: submit content → AI reviews it against brand
guidelines, glossary and fact store → findings with fixes → human approval →
analytics. AI findings are **advisory — a human always makes the final call**.

## Run locally

```bash
# 1. python 3.12 + deps
uv venv --python 3.12 && uv pip install -r backend/requirements.txt

# 2. key (already in .env at repo root)
cp backend/.env.example .env   # if needed
# LLM_PROVIDER=groq  GROQ_API_KEY=...  GROQ_MODEL=openai/gpt-oss-120b

# 3. server (from backend/)
cd backend && ../.venv/bin/uvicorn app.main:app --port 8001
# API docs: http://localhost:8001/docs
```

`LLM_PROVIDER=mock` runs the whole API with no key (tests/demo).

## Test

```bash
cd backend && ../.venv/bin/python -m pytest -q   # 31 tests
```

## API (frontend contract)

| Method | Path                            | Purpose                                    |
| ------ | ------------------------------- | ------------------------------------------ |
| GET    | `/health`                       | status + AI/model disclosure               |
| POST   | `/content`                      | create content                             |
| GET    | `/content`                      | list (`?status=` filter)                   |
| GET    | `/content/{id}`                 | content + findings                         |
| POST   | `/content/{id}/review`          | run engine (`?force_mock=true` skips LLM)  |
| PATCH  | `/findings/{id}`                | `{"accepted": 0\|1\|2}`                    |
| POST   | `/content/{id}/approve`         | blocked while criticals unresolved (409)   |
| POST   | `/content/{id}/request-changes` | set status=changes                         |
| POST   | `/content/{id}/upload`          | image upload (5MB, PIL-verified)           |
| GET    | `/analytics/summary`            | compliance, categories, LLM token spend    |
| GET    | `/audit`                        | tamper-evident-style trail of every action |

Finding shape: `{id, content_id, category, severity, rule, excerpt, suggestion, accepted, confidence}` — categories `tone|term|claim|a11y|visual`,
severities `critical|warning|suggestion`.

## Architecture

- **One LLM call** (Groq `openai/gpt-oss-120b`, JSON mode) covers tone,
  terminology and claims; falls back Groq → OpenAI → deterministic-only.
- **Deterministic checks always run**: glossary regex, WCAG contrast math,
  heading/alt-text structure, reading level, disclaimer presence, competitor
  mentions, brand-colour distance (Pillow).
- **Security**: content delimited as untrusted data (prompt-injection test
  passes live), excerpts must be grounded in the content (hallucination
  filter), rate limit 10 reviews/min/IP, upload PIL verification + 5MB cap,
  keys only in env, enum-validated outputs.
- **Config** from env (`.env`), deploy-safe paths, CORS configurable.

## Deploy (any PaaS: Render/Railway/Fly)

```bash
# build: pip install -r backend/requirements.txt
# start: uvicorn app.main:app --host 0.0.0.0 --port $PORT
# env:   GROQ_API_KEY, LLM_PROVIDER=groq, CORS_ORIGINS=https://your-frontend
```

SQLite file lives at `DATABASE_PATH` (set it to a persistent volume path in
prod). Single instance — rate limiter is in-memory per process.

## v1.1 roadmap (deliberately not built)

Multi-tenant RBAC, white-label, Redis-backed rate limits, logo template
matching, guideline version UI, DDoS/DR, multi-LLM routing policies.
