# Narrative Schema

## `narratives`

Stores one row per narrative.

Key fields:

- `id`
- `user_id`
- `key`
- `label`
- `family`
- `kind`
- `cluster_id`
- `canonical_key`
- `summary`
- `themes`
- `supporting_memories`
- `supporting_patterns`
- `supporting_emotions`
- `supporting_goals`
- `identity_shifts`
- `belief_shifts`
- `value_shifts`
- `emotional_maturation`
- `frequency`
- `intensity`
- `confidence`
- `start_date`
- `first_occurrence_at`
- `last_occurrence_at`
- `trend_direction`
- `trend_score`
- `status`
- `completed_at`
- `current_chapter_number`
- `current_chapter_title`
- `chapters`
- `evidence_score`

## `narrative_occurrences`

Stores every narrative detection occurrence.

Key fields:

- `id`
- `user_id`
- `narrative_id`
- `source_type`
- `source_id`
- `source_hash`
- `text`
- `excerpt`
- `occurred_at`
- `intensity`
- `confidence`
- `supporting_memories`
- `supporting_patterns`
- `supporting_emotions`
- `supporting_goals`
- `identity_signals`
- `themes`
- `metadata`

## `narrative_evolution`

Stores immutable snapshots of narrative updates.

Key fields:

- `id`
- `user_id`
- `narrative_id`
- `occurred_at`
- `snapshot`
- `trend`

## `narrative_events`

Stores traceable service events.

Key fields:

- `id`
- `user_id`
- `narrative_id`
- `event_type`
- `payload`
