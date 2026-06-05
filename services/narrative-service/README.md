# Narrative Service

The Narrative Intelligence Engine turns accumulated memories and pattern evidence into persistent life narratives.

## Responsibilities

- construct narrative objects from accumulated evidence
- track narrative start date, confidence, support evidence, and evolution
- detect emergence, growth, decline, and completion
- generate chapters, retrieval, ranking, and monthly/quarterly/annual reports
- answer identity questions such as "who is this person becoming?"

## Run locally

```bash
npm run dev:narrative
```

If `NARRATIVE_POSTGRES_URL` or `POSTGRES_URL` is set, the service uses PostgreSQL. Otherwise it falls back to the in-memory store for development.

## Environment

- `NARRATIVE_PORT` or `PORT`
- `NARRATIVE_POSTGRES_URL` or `POSTGRES_URL`
- `NARRATIVE_MAX_SEARCH_RESULTS`
- `NARRATIVE_REPORT_LOOKBACK_MULTIPLIER`

## API

- `GET /healthz`
- `POST /v1/narratives/ingest`
- `GET /v1/narratives?userId=...`
- `GET /v1/narratives/:id?userId=...`
- `GET /v1/narratives/:id/occurrences?userId=...`
- `GET /v1/narratives/:id/evolution?userId=...`
- `GET /v1/occurrences?userId=...`
- `GET /v1/search?userId=...&q=...`
- `GET /v1/reports/monthly?userId=...`
- `GET /v1/reports/quarterly?userId=...`
- `GET /v1/reports/annual?userId=...`
- `GET /v1/identity/summary?userId=...`

## Storage

- `narratives`
- `narrative_occurrences`
- `narrative_evolution`
- `narrative_events`
