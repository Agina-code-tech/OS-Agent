# Pattern Detection Service

The Pattern Detection Service turns reflections, conversations, journal entries, check-ins, and voice transcripts into persistent behavioral pattern records.

## Responsibilities

- detect recurring emotional, behavioral, cognitive, and relationship patterns
- track frequency, intensity, confidence, first and last occurrence, and trend direction
- maintain pattern evolution snapshots over time
- produce weekly, monthly, and quarterly pattern reports

## Run locally

```bash
npm run dev:patterns
```

If `PATTERN_POSTGRES_URL` or `POSTGRES_URL` is set, the service uses PostgreSQL. Otherwise it falls back to the in-memory store for development.

## Environment

- `PATTERN_PORT` or `PORT`
- `PATTERN_POSTGRES_URL` or `POSTGRES_URL`
- `PATTERN_MAX_SEARCH_RESULTS`
- `PATTERN_REPORT_LOOKBACK_MULTIPLIER`

## API

- `GET /healthz`
- `POST /v1/patterns/ingest`
- `GET /v1/patterns?userId=...`
- `GET /v1/patterns/:id?userId=...`
- `GET /v1/patterns/:id/occurrences?userId=...`
- `GET /v1/patterns/:id/evolution?userId=...`
- `GET /v1/search?userId=...&q=...`
- `GET /v1/reports/weekly?userId=...`
- `GET /v1/reports/monthly?userId=...`
- `GET /v1/reports/quarterly?userId=...`

## Storage

- `detected_patterns`
- `pattern_occurrences`
- `pattern_evolution`
- `pattern_events`

The full schema is in [`sql/postgres-init.sql`](./sql/postgres-init.sql).
