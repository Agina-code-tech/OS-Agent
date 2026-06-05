# Database Schema

## Neo4j graph schema

### Node labels

- `Memory`
- `Emotion`
- `Belief`
- `Value`
- `Goal`
- `Narrative`
- `Pattern`
- `Relationship`
- `LifeEvent`
- `Person`
- `Project`

### Relationship types

- `causes`
- `reinforces`
- `contradicts`
- `supports`
- `associated_with`
- `triggered_by`
- `evolved_into`
- `part_of`
- `related_to`
- `resolved_by`
- `blocks`
- `strengthens`

### Core node properties

- `id`
- `userId`
- `label`
- `title`
- `summary`
- `body`
- `sourceReflectionId`
- `contentHash`
- `confidence`
- `importance`
- `salience`
- `firstSeenAt`
- `lastSeenAt`
- `version`
- `temporalState`
- `tags`
- `embedding`

### Core relationship properties

- `id`
- `userId`
- `type`
- `strength`
- `confidence`
- `evidence`
- `sourceReflectionId`
- `firstSeenAt`
- `lastSeenAt`
- `validFrom`
- `validTo`
- `version`

## PostgreSQL backup schema

### `reflections`

- `id`
- `user_id`
- `raw_text`
- `normalized_text`
- `source`
- `metadata` JSONB
- `created_at`

### `memory_nodes`

- `id`
- `user_id`
- `node_type`
- `title`
- `summary`
- `body`
- `content_hash`
- `properties` JSONB
- `embedding` JSONB
- `first_seen_at`
- `last_seen_at`
- `version`

### `memory_edges`

- `id`
- `user_id`
- `source_node_id`
- `target_node_id`
- `edge_type`
- `strength`
- `confidence`
- `evidence` JSONB
- `properties` JSONB
- `first_seen_at`
- `last_seen_at`
- `version`

### `memory_events`

- `id`
- `user_id`
- `event_type`
- `reflection_id`
- `entity_type`
- `entity_id`
- `payload` JSONB
- `created_at`

### Indexing strategy

- Unique indexes on `(user_id, id)` for node and edge records.
- B-tree index on `user_id`, `created_at`, and `last_seen_at`.
- Full-text search on `title`, `summary`, and `body`.
- Optional `pgvector` column can be added later for embedding indexing.

