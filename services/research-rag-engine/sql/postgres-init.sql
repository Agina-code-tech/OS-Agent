CREATE TABLE IF NOT EXISTS research_documents (
  id TEXT PRIMARY KEY,
  collection TEXT NOT NULL DEFAULT 'default',
  title TEXT NOT NULL,
  abstract TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  publication_type TEXT NOT NULL,
  publication_year INT,
  authors JSONB NOT NULL DEFAULT '[]'::jsonb,
  publisher TEXT,
  journal TEXT,
  doi TEXT,
  source_url TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  frameworks JSONB NOT NULL DEFAULT '[]'::jsonb,
  domains JSONB NOT NULL DEFAULT '[]'::jsonb,
  citation_key TEXT NOT NULL,
  citation_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS research_documents_citation_idx
  ON research_documents (citation_key);

CREATE INDEX IF NOT EXISTS research_documents_type_year_idx
  ON research_documents (publication_type, publication_year DESC);

CREATE TABLE IF NOT EXISTS research_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  chunk_index INT NOT NULL,
  heading TEXT,
  text TEXT NOT NULL,
  token_count INT NOT NULL DEFAULT 0,
  start_char INT NOT NULL DEFAULT 0,
  end_char INT NOT NULL DEFAULT 0,
  page_number INT,
  embedding JSONB NOT NULL DEFAULT '[]'::jsonb,
  citation_key TEXT NOT NULL,
  publication_type TEXT NOT NULL,
  publication_year INT,
  authors JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_url TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  frameworks JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS research_chunks_document_idx
  ON research_chunks (document_id, chunk_index);

CREATE INDEX IF NOT EXISTS research_chunks_type_year_idx
  ON research_chunks (publication_type, publication_year DESC);

CREATE INDEX IF NOT EXISTS research_chunks_fts_idx
  ON research_chunks USING GIN (
    to_tsvector('english', coalesce(text, '') || ' ' || coalesce(heading, '') || ' ' || coalesce(citation_key, ''))
  );

CREATE TABLE IF NOT EXISTS research_retrievals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'global',
  query TEXT NOT NULL,
  query_hash TEXT NOT NULL,
  query_embedding JSONB NOT NULL DEFAULT '[]'::jsonb,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  results JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS research_retrievals_user_idx
  ON research_retrievals (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS research_evaluations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
