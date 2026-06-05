# Pattern Detection Database Schema

## `detected_patterns`

Stores one row per persistent pattern.

Key fields:

- `id`
- `user_id`
- `key`
- `label`
- `family`
- `kind`
- `cluster_id`
- `canonical_key`
- `frequency`
- `intensity`
- `confidence`
- `first_occurrence_at`
- `last_occurrence_at`
- `trend_direction`
- `trend_score`
- `reinforcement_count`
- `trigger_counts`
- `top_triggers`
- `status`
- `resolved_at`

## `pattern_occurrences`

Stores every detected occurrence for a user-pattern pair.

Key fields:

- `id`
- `user_id`
- `pattern_id`
- `source_type`
- `source_id`
- `source_hash`
- `text`
- `excerpt`
- `occurred_at`
- `intensity`
- `confidence`
- `keyword_hits`
- `trigger_signals`
- `domains`
- `metadata`

## `pattern_evolution`

Stores immutable snapshots of each update.

Key fields:

- `id`
- `user_id`
- `pattern_id`
- `occurred_at`
- `snapshot`
- `trend`

## `pattern_events`

Stores service events for traceability and downstream orchestration.

Key fields:

- `id`
- `user_id`
- `pattern_id`
- `event_type`
- `payload`

## Indexing strategy

- unique user + canonical key on `detected_patterns`
- pattern/time access path on `pattern_occurrences`
- user/pattern evolution history on `pattern_evolution`
- user timeline on `pattern_events`
- text search index on `detected_patterns`
