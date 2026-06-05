# Deployment Guide

## Local development

```bash
npm run dev:patterns
```

## PostgreSQL-backed deployment

Set:

- `PATTERN_POSTGRES_URL`
- `PATTERN_PORT`

Then start the service. The schema in `sql/postgres-init.sql` can be applied before first run.

## Production notes

- use the Postgres store for durable history
- keep the service stateless
- deploy behind the orchestration layer
- scale read-heavy consumers independently from the ingest path
