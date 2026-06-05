# Ingestion Pipeline

## Inputs

- title
- abstract
- content
- publication type
- publication year
- authors
- journal or publisher
- DOI or URL
- tags
- frameworks
- domains

## Steps

1. Normalize text fields.
2. Build a stable citation key.
3. Chunk the source into sentence-aware passages.
4. Generate chunk embeddings.
5. Persist document metadata.
6. Persist chunk records with citation metadata.

## Chunking strategy

- chunks target about 220 words by default
- chunks overlap by about 40 words
- headings are preserved when present
- chunk records keep offsets for traceability
