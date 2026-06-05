# Research RAG API

## `GET /healthz`

Returns store and service health.

## `POST /v1/documents/ingest`

Ingests one document or a batch of documents.

Input fields:

- `title`
- `abstract`
- `content`
- `publicationType`
- `publicationYear`
- `authors`
- `publisher`
- `journal`
- `doi`
- `sourceUrl`
- `tags`
- `frameworks`
- `domains`
- `collection`

## `GET /v1/documents`

Lists stored documents with optional filters:

- `publicationType`
- `collection`
- `framework`

## `GET /v1/documents/:id`

Returns one source document.

## `GET /v1/chunks/:id`

Returns one chunk record.

## `POST /v1/retrieve`

Runs hybrid retrieval and returns ranked sources with supporting evidence.

## `GET /v1/search?q=...`

Runs retrieval via querystring for simple clients.

## `POST /v1/evaluate`

Runs an evaluation benchmark and stores the resulting metrics.

## `GET /v1/retrievals`

Returns retrieval logs.

## `GET /v1/evaluations`

Returns stored benchmark runs.
