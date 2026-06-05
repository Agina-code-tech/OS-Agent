# Research RAG Engine

The Research RAG Engine is the psychology and human-development intelligence layer for the platform.

## Responsibilities

- ingest research documents from psychology, behavioral science, narrative psychology, Jungian psychology, attachment theory, ACT, CBT, positive psychology, neuroscience, and emotional regulation literature
- chunk documents and generate embeddings
- run hybrid lexical/vector retrieval
- rerank and compress context for educational use
- track citations and source metadata
- refuse diagnosis and therapy requests

## Run locally

```bash
npm run dev:rag
```

If `RESEARCH_RAG_POSTGRES_URL` or `POSTGRES_URL` is set, the service uses PostgreSQL. If `OPENAI_API_KEY` is set, it uses OpenAI embeddings; otherwise it falls back to deterministic local embeddings.

## Environment

- `RESEARCH_RAG_PORT` or `PORT`
- `RESEARCH_RAG_POSTGRES_URL` or `POSTGRES_URL`
- `OPENAI_API_KEY`
- `RESEARCH_RAG_EMBEDDING_MODEL`
- `RESEARCH_RAG_VECTOR_DIMENSION`
- `RESEARCH_RAG_TOP_K`
- `RESEARCH_RAG_CONTEXT_BUDGET`
- `RESEARCH_RAG_CHUNK_WORDS`
- `RESEARCH_RAG_CHUNK_OVERLAP`

## API

- `GET /healthz`
- `POST /v1/documents/ingest`
- `GET /v1/documents`
- `GET /v1/documents/:id`
- `GET /v1/chunks/:id`
- `POST /v1/retrieve`
- `GET /v1/search`
- `POST /v1/evaluate`
- `GET /v1/retrievals`
- `GET /v1/evaluations`

## Storage

- `research_documents`
- `research_chunks`
- `research_retrievals`
- `research_evaluations`
