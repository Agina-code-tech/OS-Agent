CREATE TABLE IF NOT EXISTS reflections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  source TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memory_nodes (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  canonical_key TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  body TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding JSONB,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  version INT NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS memory_nodes_user_canonical_idx
  ON memory_nodes (user_id, canonical_key);

CREATE TABLE IF NOT EXISTS memory_edges (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  source_node_id TEXT NOT NULL,
  target_node_id TEXT NOT NULL,
  edge_type TEXT NOT NULL,
  canonical_key TEXT NOT NULL,
  strength DOUBLE PRECISION NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  version INT NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS memory_edges_user_canonical_idx
  ON memory_edges (user_id, canonical_key);

CREATE TABLE IF NOT EXISTS memory_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  reflection_id TEXT,
  entity_type TEXT,
  entity_id TEXT,
  graph_revision BIGINT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

