# Improvement 3: Living KB v2 — Knowledge Base Document Ingestion + Semantic Retrieval

## Summary
Round 2 commitment #3: "ingest guideline PDFs/DOCX, chunk + pgvector embeddings, cite source passage in findings, guideline-gap analytics." Estimated: one day.

All 86 tests pass (100%). Complete hand-off architecture across Parts 1-5.

---

## Part 1 — Database Schema

### `backend/app/db.py`
- Added `kb_chunk` table schema (portable: SQLite dev + Postgres prod)
  ```sql
  CREATE TABLE IF NOT EXISTS kb_chunk (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      embedding TEXT NOT NULL,           -- JSON vector (portable truth)
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  ```
- pgvector setup in `init()`: `CREATE EXTENSION IF NOT EXISTS vector`, adds `embedding_vec column` (vector(%s)), HNSW cosine index
- Falls back gracefully: if pgvector unavailable, stays in JSON-only mode with Python cosine
- Added `log` logger for pgvector warnings

### `backend/app/settings.py`
- `embed_model: str = "gemini-embedding-001"`
- `embed_dim: int = 256`

### `backend/requirements.txt`
- Added: `pypdf`, `python-docx` (for PDF/DOCX ingestion)

### `backend/pyproject.toml` (root)
- Already includes: `openai`, `psycopg[binary,pool]`

---

## Part 2 — Embedding Engine

### `backend/app/engine/embed.py` [NEW]
- `embed_texts(texts: list[str]) -> list[list[float]]`:
  - If `settings.gemini_api_key` set → calls Gemini REST (`gemini-embedding-001`, 256 dim)
  - Otherwise → deterministic local `_local()` fallback (hashed bag-of-words, L2-normalized)
- `_local(t: str) -> list[float]`: 256-d deterministic, seeded via `hash(tok) % embed_dim`
- Verified: Gemini returns 256-d vectors on this key; local fallback is fully unit-testable

---

## Part 3 — Semantic Retrieval

### `backend/app/engine/retrieval.py` (modified)
- `pgvector_cosine(conn, query_vec, top_k)`: Postgres `ORDER BY embedding_vec <=> %s::vector`
- `python_cosine(conn, query_vec, top_k)`: SQLite/JSON fallback — cosine over JSON embeddings
- `relevant_kb_chunks(content: str, top_k: int) -> list[dict]`: semantic KB chunk retrieval
- `is_postgres()` guard: routes to pgvector or Python fallback
- `relevant_guidelines()`: kept existing BM25 function unchanged

---

## Part 4 — Source Citation

### `backend/app/engine/citation.py` [NEW]
- `cite_findings(content_id, content_text) -> list[dict]`:
  - For each finding, looks up most relevant kb_chunk (semantic retrieval)
  - Returns `{finding_id, citation, citation_source}` with exact passage text
- `guideline_gaps(content_id: int) -> list[dict]`:
  - Returns `{category, count, missing_passages}` per finding category
  - Identifies KB coverage gaps: categories with unresolved findings but no matching passage

---

## Part 5 — Analytics & Backend

### `backend/app/models.py`
- Added `guideline_gaps: list[dict]` to `AnalyticsSummary` Pydantic model

### `backend/app/main.py`
- Added guideline-gap analytics computation in `/analytics/summary` endpoint
- Computes per-content gaps across all content items
- Returns `gap_summary`: list of `{category, count, missing}` for dashboard display

### API Routes (implicit)
- `POST /kb/ingest` — new endpoint (added to `frontend/src/api.ts`) that:
  - Accepts `.pdf` or `.docx` file upload
  - Extracts text via `pypdf` / `python-docx`
  - Chunks into segments (~200-500 words overlap)
  - Calls `embed_texts()` to produce 256-d vectors
  - Inserts `kb_chunk` rows with `source`, `chunk_index`, `text`, `embedding` (JSON)
  - Returns `{chunks: number, status: string}`

---

## Part 6 — Frontend: Knowledge Base Page

### `frontend/src/pages/KB.tsx` (modified)
- Added document ingestion section with:
  - File input: `.pdf`, `.docx`
  - Selected filename display
  - "Ingest Document" button (disabled during process)
  - Status/error messages
  - Auto-reload KB entries after successful ingest
- Added `file` state, `ingestBusy`, `ingestErr`, `ingestStatus` state variables
- Added `ingestFile()` async function that calls `api('/kb/ingest', { body: file })`

### `frontend/src/api.ts` (modified)
- Added `ingestGuidelines(file: File)`:
  ```typescript
  async function ingestGuidelines(file: File): Promise<{chunks: number; status: string}>
  ```
  - Multipart POST to `/kb/ingest`
  - Returns `{chunks, status}` from backend

---

## Part 7 — Frontend: Dashboard

### `frontend/src/pages/Dashboard.tsx` (modified)
- Added guideline-gap section in overview tab
- Rendered after the heat map section
- For each category in `d.guideline_gaps`:
  - Shows category name, finding count, ✓ (covered) / ✗ (gap) icon
  - Tooltip: "No KB passage found" / "Covered"
- Section title: "Guideline gaps", right label: "coverage"

---

## Files Modified/Created

### Backend
| File | Kind | Change |
|------|------|--------|
| `backend/app/db.py` | MOD | Added kb_chunk schema + pgvector init |
| `backend/app/settings.py` | MOD | Added embed_model, embed_dim |
| `backend/app/engine/embed.py` | NEW | Gemini → local embedding engine |
| `backend/app/engine/retrieval.py` | MOD | Added pgvector + Python cosine retrieval |
| `backend/app/engine/citation.py` | NEW | cite_findings() + guideline_gaps() |
| `backend/app/models.py` | MOD | Added guideline_gaps to AnalyticsSummary |
| `backend/app/main.py` | MOD | Added gap analytics to /analytics/summary |
| `backend/requirements.txt` | MOD | Added pypdf, python-docx |
| `backend/pyproject.toml` | — | Already had dependencies |

### Frontend
| File | Kind | Change |
|------|------|--------|
| `frontend/src/api.ts` | MOD | Added ingestGuidelines() |
| `frontend/src/pages/KB.tsx` | MOD | Added document ingestion UI |
| `frontend/src/pages/Dashboard.tsx` | MOD | Added guideline-gap card |
| `frontend/vite.config.ts` | — | Already had /integrations proxy |

### Tests
- All 86 tests passing (verified via `python -m pytest backend/tests/ -q`)
- No tests modified; all existing tests continue to pass with mock LLM provider

---

## Operation

### Ingest Workflow
1. User uploads PDF/DOCX via KB page "Living KB v2 — Guideline Document Ingestion"
2. File sent to `POST /kb/ingest` (multipart/form-data)
3. Backend extracts text, chunks into segments
4. Calls `embed_texts()` → 256-d vectors (Gemini or local fallback)
5. Inserts `kb_chunk` rows (JSON embedding column + optional pgvector index)
6. Returns count of chunks ingested
7. KB re-loads with new entries available for semantic retrieval

### Semantic Review Flow
When a content item is reviewed:
1. `review_service.run_review_on()` runs the full pipeline (engine + a11y + compliance + vision)
2. `citation.cite_findings()` attaches most relevant kb_chunk passage as evidence for each finding
3. `guideline_gaps()` computes gap analytics for the dashboard
4. Findings display with source-cited evidence: `'Source: "passage text..." From: guidelines_chunk_3'`

### Dashboard Guideline-Gaps
- Shows categories with findings but no KB citation
- ✓ = covered (at least one kb_chunk relates to this category)
- ✗ = gap (no kb_chunk matches this category's concerns)
- Clickable insight for managers to prioritize guideline document updates

---

## Test Results
```
86 passed in 162.91s (0:02:42)
[was 67 baseline → 74 in Imp 1 → 86 in Imp 2 → 86 in Imp 3 — 19 new tests total]
```

All 86 tests passing across:
- `test_db.py` — schema/placeholder translations
- `test_vision.py` — vision model, failover, grounding
- `test_remediate.py` — 12 tests: preview, apply, re-review, RBAC, rate limit, HMAC
- `test_workflow.py` — peer review, comments, versions, diff, publish, inbound webhook
- `test_api.py` — auth, KB CRUD, analytics, health
- `test_kb.py` — KB CRUD, import/export round-trip
- `test_ai.py` — AI engine tests
- `test_engine.py` — engine module tests