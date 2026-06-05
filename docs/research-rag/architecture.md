# Research RAG Architecture

## Purpose

The Research RAG Engine is the educational evidence layer of the platform. It retrieves research-backed psychological and developmental knowledge, compresses it into usable context, and returns source-level citations. It never diagnoses and never provides therapy.

## Pipeline

1. Normalize and validate a research document.
2. Chunk the document into retrievable passages.
3. Generate embeddings for each chunk.
4. Persist the source document and chunk records.
5. At query time, build a query embedding.
6. Retrieve candidate chunks with hybrid lexical/vector scoring.
7. Rerank by relevance, source quality, and evidence fit.
8. Compress the selected evidence into an answerable context.
9. Return citations, publication metadata, and confidence.

## Core Components

- `src/ingestion/chunking.js`
  - sentence-aware chunking with overlap
- `src/embeddings/provider.js`
  - OpenAI embeddings when configured, local deterministic embeddings otherwise
- `src/retrieval/bm25.js`
  - lexical retrieval and BM25 scoring
- `src/retrieval/rerank.js`
  - hybrid reranking and confidence calculation
- `src/retrieval/compression.js`
  - evidence extraction and context compression
- `src/stores/memory-store.js`
  - in-memory development store
- `src/stores/postgres-store.js`
  - durable PostgreSQL store
- `src/pipeline/engine.js`
  - ingestion, retrieval, evaluation, and guardrails

## Design Notes

- Source attribution is first-class and stored with every result.
- Retrieval results are document-centric and show supporting evidence for each source.
- The service can run without OpenAI credentials by falling back to deterministic local embeddings.
- The service is explicit about educational scope and refuses diagnosis or therapy requests.
