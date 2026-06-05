# Vector Schema

## `research_documents`

Stores canonical source metadata and citation data.

Important fields:

- `id`
- `citation_key`
- `citation_text`
- `publication_type`
- `publication_year`
- `authors`
- `source_url`
- `doi`
- `frameworks`
- `domains`

## `research_chunks`

Stores the retrievable passages and their embeddings.

Important fields:

- `id`
- `document_id`
- `chunk_index`
- `heading`
- `text`
- `token_count`
- `embedding`
- `citation_key`
- `publication_type`
- `publication_year`
- `frameworks`

## `research_retrievals`

Stores retrieval logs for debugging and evaluation.

Important fields:

- `id`
- `query`
- `query_hash`
- `query_embedding`
- `context`
- `results`

## `research_evaluations`

Stores benchmark metrics.

Important fields:

- `id`
- `name`
- `metrics`
- `details`

## Indexing strategy

- document citation keys are unique
- chunk text uses full-text search indexes
- publication year and type are indexed for filtering
- retrieval logs are indexed by user and timestamp
