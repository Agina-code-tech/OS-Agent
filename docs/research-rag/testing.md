# Testing Strategy

## Coverage goals

- document ingestion and chunking
- embedding fallback behavior
- BM25 and vector scoring
- hybrid reranking
- context compression
- citation and source attribution
- safety refusal for diagnosis/therapy queries
- HTTP smoke coverage

## Test layers

1. Unit tests for scoring and compression.
2. Engine tests for ingestion and retrieval.
3. HTTP smoke tests for endpoints.

## What to verify

- documents can be ingested without OpenAI credentials
- retrieval returns source, confidence, publication type, publication year, and supporting evidence
- evaluation metrics are computed and stored
- unsafe requests are refused
