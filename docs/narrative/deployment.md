# Deployment Guide

## Local development

```bash
npm run dev:narrative
```

## PostgreSQL-backed deployment

Set:

- `NARRATIVE_POSTGRES_URL`
- `NARRATIVE_PORT`

Apply the schema in [`services/narrative-service/sql/postgres-init.sql`](../../services/narrative-service/sql/postgres-init.sql) before first run.

## Production notes

- keep the service stateless
- use PostgreSQL for durable history
- deploy behind the orchestration layer
- scale search and reporting readers separately from ingest
