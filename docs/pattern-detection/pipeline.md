# Detection Pipeline

## Stage 1: Normalization

- collapse whitespace
- standardize source type
- capture timestamps and metadata

## Stage 2: Signal extraction

- match known behavioral and emotional language
- extract triggers
- score intensity and confidence

## Stage 3: Clustering

- compare incoming signals against a user's existing patterns
- reuse the same pattern when similarity exceeds the semantic threshold
- create a new pattern when no cluster matches

## Stage 4: Persistence

- write the current occurrence
- update aggregate pattern fields
- append an evolution snapshot
- write a service event

## Stage 5: Reporting

- compute current vs previous window counts
- classify emerging, strengthening, weakening, resolved, and stable patterns
- summarize trigger loops and dominant themes
