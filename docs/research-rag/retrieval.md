# Retrieval Pipeline

## Query handling

- normalize the query
- extract framework hints such as attachment theory, ACT, CBT, Jungian psychology, narrative psychology, neuroscience, and emotional regulation research
- refuse diagnosis or therapy requests

## Hybrid search

- lexical retrieval uses BM25 plus token overlap
- vector retrieval uses cosine similarity over query and chunk embeddings
- reranking combines relevance with publication quality, recency, and framework match

## Output fields

Each result returns:

- `source`
- `confidence`
- `publicationType`
- `publicationYear`
- `supportingEvidence`
- `citation`

## Context compression

- top passages are compressed to the most relevant sentences
- the final context stays within a configurable character budget
- citations are preserved alongside the compressed text
