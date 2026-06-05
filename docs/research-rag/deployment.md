# Deployment Guide

## Local development

```bash
npm run dev:rag
```

## PostgreSQL-backed deployment

Set:

- `RESEARCH_RAG_POSTGRES_URL`
- `RESEARCH_RAG_PORT`

Then apply [`services/research-rag-engine/sql/postgres-init.sql`](../../services/research-rag-engine/sql/postgres-init.sql).

## OpenAI embeddings

If `OPENAI_API_KEY` is present, the service uses OpenAI embeddings. Otherwise it falls back to deterministic local embeddings so local development stays offline-friendly.

## Production notes

- keep the service stateless
- store citations with every chunk and retrieval record
- guardrail the API against diagnosis and therapy requests
- use the orchestration layer to decide when to call this service versus the memory graph or narrative service
