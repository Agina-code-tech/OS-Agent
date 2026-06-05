# Narrative Generation Pipeline

## Stage 1: Evidence normalization

- normalize text
- normalize memory, pattern, emotion, and goal references
- build a combined context string

## Stage 2: Signal extraction

- match narrative definitions
- extract belief shifts, value shifts, identity statements, and emotional maturation cues
- score each candidate by text evidence and support evidence

## Stage 3: Clustering

- match the signal to an existing narrative when the family and semantics align
- create a new narrative when no stable cluster exists

## Stage 4: Update and persistence

- update frequency, confidence, and support lists
- append the new occurrence
- write the evolution snapshot
- emit a narrative event

## Stage 5: Chapter generation

- assign the current chapter from Recognizing the Pattern through Integration
- mark earlier chapters as completed and later chapters as pending

## Stage 6: Reporting and retrieval

- rank narratives by support and recency
- generate monthly, quarterly, and annual reports
- answer identity queries such as who the user is becoming
