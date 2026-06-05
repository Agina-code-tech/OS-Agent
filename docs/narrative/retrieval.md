# Narrative Retrieval Logic

## Ranking inputs

Retrieval order is driven by:

- narrative frequency
- narrative confidence
- recent activity
- support depth
- lexical match to the query
- active lifecycle status

## Retrieval paths

- `GET /v1/narratives`
  - list view, filterable by family, theme, status, and source type
- `GET /v1/search`
  - query-oriented retrieval
- `GET /v1/identity/summary`
  - identity-centered retrieval for "who is this person becoming?"

## What the engine returns

- the narrative label and summary
- the current chapter
- support evidence counts
- identity shifts
- belief changes
- value shifts
- emotional maturation evidence

## Operational note

The service keeps retrieval read-friendly by ranking off stored narrative rows rather than recomputing the entire history on every request.
