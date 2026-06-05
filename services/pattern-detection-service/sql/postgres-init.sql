CREATE TABLE IF NOT EXISTS detected_patterns (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  family TEXT NOT NULL,
  kind TEXT NOT NULL,
  cluster_id TEXT NOT NULL,
  canonical_key TEXT NOT NULL,
  source_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  domains JSONB NOT NULL DEFAULT '[]'::jsonb,
  frequency INT NOT NULL DEFAULT 0,
  intensity DOUBLE PRECISION NOT NULL DEFAULT 0,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
  first_occurrence_at TIMESTAMPTZ NOT NULL,
  last_occurrence_at TIMESTAMPTZ NOT NULL,
  trend_direction TEXT NOT NULL DEFAULT 'stable',
  trend_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  reinforcement_count INT NOT NULL DEFAULT 0,
  trigger_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  top_triggers JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS detected_patterns_user_canonical_idx
  ON detected_patterns (user_id, canonical_key);

CREATE INDEX IF NOT EXISTS detected_patterns_user_family_idx
  ON detected_patterns (user_id, family, status, last_occurrence_at DESC);

CREATE INDEX IF NOT EXISTS detected_patterns_user_frequency_idx
  ON detected_patterns (user_id, frequency DESC, last_occurrence_at DESC);

CREATE INDEX IF NOT EXISTS detected_patterns_search_idx
  ON detected_patterns USING GIN (
    to_tsvector(
      'english',
      coalesce(label, '') || ' ' || coalesce(key, '') || ' ' || coalesce(family, '')
    )
  );

CREATE TABLE IF NOT EXISTS pattern_occurrences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  pattern_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  source_hash TEXT NOT NULL,
  text TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  intensity DOUBLE PRECISION NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  keyword_hits JSONB NOT NULL DEFAULT '[]'::jsonb,
  trigger_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  domains JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pattern_occurrences_user_pattern_idx
  ON pattern_occurrences (user_id, pattern_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS pattern_occurrences_user_time_idx
  ON pattern_occurrences (user_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS pattern_evolution (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  pattern_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  snapshot JSONB NOT NULL,
  trend JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pattern_evolution_user_pattern_idx
  ON pattern_evolution (user_id, pattern_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS pattern_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  pattern_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pattern_events_user_idx
  ON pattern_events (user_id, created_at DESC);
