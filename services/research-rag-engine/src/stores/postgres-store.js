import pg from "pg";
import { average, stableHash } from "../domain/text.js";
import { buildCitationKey, buildCitationText, buildChunkId, buildDocumentId } from "./store-utils.js";
import { buildCorpusStats, bm25Score, lexicalOverlapScore } from "../retrieval/bm25.js";

const { Pool } = pg;

function json(value) {
  return JSON.stringify(value ?? null);
}

function mapDocumentRow(row) {
  return {
    id: row.id,
    collection: row.collection,
    title: row.title,
    abstract: row.abstract,
    content: row.content,
    summary: row.summary,
    publicationType: row.publication_type,
    publicationYear: row.publication_year,
    authors: row.authors,
    publisher: row.publisher,
    journal: row.journal,
    doi: row.doi,
    sourceUrl: row.source_url,
    tags: row.tags,
    frameworks: row.frameworks,
    domains: row.domains,
    citationKey: row.citation_key,
    citationText: row.citation_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapChunkRow(row) {
  return {
    id: row.id,
    documentId: row.document_id,
    chunkIndex: row.chunk_index,
    heading: row.heading,
    text: row.text,
    tokenCount: row.token_count,
    startChar: row.start_char,
    endChar: row.end_char,
    pageNumber: row.page_number,
    embedding: row.embedding,
    createdAt: row.created_at,
    bm25Score: row.bm25_score,
    lexicalScore: row.lexical_score,
  };
}

export class PostgresResearchStore {
  constructor({ connectionString, max = 10 } = {}) {
    this.pool = connectionString ? new Pool({ connectionString, max }) : null;
  }

  static disabled() {
    return new PostgresResearchStore({ connectionString: null });
  }

  async ensureSchema() {
    if (!this.pool) return true;

    await this.pool.query(`
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
    `);
    return true;
  }

  async healthCheck() {
    if (!this.pool) {
      return { ok: false, provider: "postgres", reason: "disabled" };
    }
    await this.pool.query("SELECT 1");
    return { ok: true, provider: "postgres" };
  }

  async upsertDocument(document) {
    if (!this.pool) return document;

    const id = document.id || buildDocumentId(document);
    const citationKey = document.citationKey || buildCitationKey(document);
    const citationText = document.citationText || buildCitationText(document);
    const record = {
      ...document,
      id,
      citationKey,
      citationText,
      updatedAt: new Date().toISOString(),
    };

    await this.pool.query(
      `
      INSERT INTO research_documents (
        id, collection, title, abstract, content, summary, publication_type, publication_year,
        authors, publisher, journal, doi, source_url, tags, frameworks, domains, citation_key,
        citation_text, created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      ON CONFLICT (citation_key) DO UPDATE
      SET collection = EXCLUDED.collection,
          title = EXCLUDED.title,
          abstract = EXCLUDED.abstract,
          content = EXCLUDED.content,
          summary = EXCLUDED.summary,
          publication_type = EXCLUDED.publication_type,
          publication_year = EXCLUDED.publication_year,
          authors = EXCLUDED.authors,
          publisher = EXCLUDED.publisher,
          journal = EXCLUDED.journal,
          doi = EXCLUDED.doi,
          source_url = EXCLUDED.source_url,
          tags = EXCLUDED.tags,
          frameworks = EXCLUDED.frameworks,
          domains = EXCLUDED.domains,
          citation_text = EXCLUDED.citation_text,
          updated_at = EXCLUDED.updated_at
      `,
      [
        record.id,
        record.collection || "default",
        record.title,
        record.abstract || "",
        record.content || "",
        record.summary || "",
        record.publicationType,
        record.publicationYear || null,
        json(record.authors || []),
        record.publisher || null,
        record.journal || null,
        record.doi || null,
        record.sourceUrl || null,
        json(record.tags || []),
        json(record.frameworks || []),
        json(record.domains || []),
        record.citationKey,
        record.citationText,
        record.createdAt || record.updatedAt,
        record.updatedAt,
      ],
    );

    return record;
  }

  async upsertChunks(documentId, chunks, embeddings = [], document = {}) {
    if (!this.pool) return chunks;

    const inserted = [];
    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const record = {
        id: chunk.id || buildChunkId(documentId, chunk.chunkIndex ?? index, chunk.text),
        documentId,
        chunkIndex: chunk.chunkIndex ?? index,
        heading: chunk.heading || null,
        text: chunk.text,
        tokenCount: chunk.tokenCount || 0,
        startChar: chunk.startChar || 0,
        endChar: chunk.endChar || chunk.text.length,
        pageNumber: chunk.pageNumber || null,
        embedding: embeddings[index] || chunk.embedding || [],
        citationKey: document.citationKey || buildCitationKey(document),
        publicationType: document.publicationType,
        publicationYear: document.publicationYear || null,
        authors: document.authors || [],
        sourceUrl: document.sourceUrl || null,
        tags: document.tags || [],
        frameworks: document.frameworks || [],
      };

      await this.pool.query(
        `
        INSERT INTO research_chunks (
          id, document_id, chunk_index, heading, text, token_count, start_char, end_char,
          page_number, embedding, citation_key, publication_type, publication_year, authors,
          source_url, tags, frameworks, created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        ON CONFLICT (id) DO UPDATE
        SET heading = EXCLUDED.heading,
            text = EXCLUDED.text,
            token_count = EXCLUDED.token_count,
            start_char = EXCLUDED.start_char,
            end_char = EXCLUDED.end_char,
            page_number = EXCLUDED.page_number,
            embedding = EXCLUDED.embedding,
            citation_key = EXCLUDED.citation_key,
            publication_type = EXCLUDED.publication_type,
            publication_year = EXCLUDED.publication_year,
            authors = EXCLUDED.authors,
            source_url = EXCLUDED.source_url,
            tags = EXCLUDED.tags,
            frameworks = EXCLUDED.frameworks
        `,
        [
          record.id,
          record.documentId,
          record.chunkIndex,
          record.heading,
          record.text,
          record.tokenCount,
          record.startChar,
          record.endChar,
          record.pageNumber,
          json(record.embedding),
          record.citationKey,
          record.publicationType,
          record.publicationYear,
          json(record.authors),
          record.sourceUrl,
          json(record.tags),
          json(record.frameworks),
          new Date().toISOString(),
        ],
      );
      inserted.push(record);
    }
    return inserted;
  }

  async ingestDocument(document) {
    const stored = await this.upsertDocument(document);
    const chunks = await this.upsertChunks(stored.id, document.chunks || [], document.embeddings || [], stored);
    return { document: stored, chunks };
  }

  async listDocuments(filters = {}) {
    if (!this.pool) return [];
    const where = [];
    const values = [];
    if (filters.publicationType) {
      values.push(filters.publicationType);
      where.push(`publication_type = $${values.length}`);
    }
    if (filters.collection) {
      values.push(filters.collection);
      where.push(`collection = $${values.length}`);
    }
    if (filters.framework) {
      values.push(filters.framework);
      where.push(`frameworks ? $${values.length}`);
    }
    if (Array.isArray(filters.frameworks) && filters.frameworks.length) {
      values.push(filters.frameworks);
      where.push(`frameworks ?| $${values.length}`);
    }
    const query = `SELECT * FROM research_documents${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY updated_at DESC`;
    const { rows } = await this.pool.query(query, values);
    return rows.map(mapDocumentRow);
  }

  async getDocument(documentId) {
    if (!this.pool) return null;
    const { rows } = await this.pool.query("SELECT * FROM research_documents WHERE id = $1 LIMIT 1", [documentId]);
    return rows[0] ? mapDocumentRow(rows[0]) : null;
  }

  async getChunk(chunkId) {
    if (!this.pool) return null;
    const { rows } = await this.pool.query("SELECT * FROM research_chunks WHERE id = $1 LIMIT 1", [chunkId]);
    return rows[0] ? mapChunkRow(rows[0]) : null;
  }

  async listChunks(filters = {}) {
    if (!this.pool) return [];
    const where = [];
    const values = [];
    if (filters.documentId) {
      values.push(filters.documentId);
      where.push(`document_id = $${values.length}`);
    }
    if (filters.documentIds && filters.documentIds.length) {
      values.push(filters.documentIds);
      where.push(`document_id = ANY($${values.length})`);
    }
    const query = `SELECT * FROM research_chunks${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY document_id, chunk_index`;
    const { rows } = await this.pool.query(query, values);
    return rows.map(mapChunkRow);
  }

  async searchCandidates(query, options = {}) {
    if (!this.pool) return [];
    const values = [query];
    const where = [];
    if (options.publicationType) {
      values.push(options.publicationType);
      where.push(`publication_type = $${values.length}`);
    }
    if (options.collection) {
      values.push(options.collection);
      where.push(`EXISTS (SELECT 1 FROM research_documents d WHERE d.id = research_chunks.document_id AND d.collection = $${values.length})`);
    }
    if (options.framework) {
      values.push(options.framework);
      where.push(`frameworks ? $${values.length}`);
    }
    if (Array.isArray(options.frameworks) && options.frameworks.length) {
      values.push(options.frameworks);
      where.push(`frameworks ?| $${values.length}`);
    }

    const sql = `
      SELECT *,
        ts_rank_cd(
          to_tsvector('english', coalesce(text, '') || ' ' || coalesce(heading, '') || ' ' || coalesce(citation_key, '')),
          plainto_tsquery('english', $1)
        ) AS bm25_score,
        ts_rank_cd(
          to_tsvector('english', coalesce(text, '') || ' ' || coalesce(heading, '') || ' ' || coalesce(citation_key, '')),
          plainto_tsquery('english', $1)
        ) AS lexical_score
      FROM research_chunks
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY bm25_score DESC, lexical_score DESC, publication_year DESC
      LIMIT 250
    `;

    const { rows } = await this.pool.query(sql, values);
    return rows.map(mapChunkRow);
  }

  async saveRetrieval(retrieval) {
    if (!this.pool) return retrieval;
    await this.pool.query(
      `
      INSERT INTO research_retrievals (
        id, user_id, query, query_hash, query_embedding, context, results, created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (id) DO NOTHING
      `,
      [
        retrieval.id,
        retrieval.userId || "global",
        retrieval.query,
        retrieval.queryHash,
        json(retrieval.queryEmbedding || []),
        json(retrieval.context || {}),
        json(retrieval.results || []),
        retrieval.createdAt || new Date().toISOString(),
      ],
    );
    return retrieval;
  }

  async listRetrievals(userId = "global") {
    if (!this.pool) return [];
    const { rows } = await this.pool.query(
      "SELECT * FROM research_retrievals WHERE user_id = $1 ORDER BY created_at DESC",
      [userId],
    );
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      query: row.query,
      queryHash: row.query_hash,
      queryEmbedding: row.query_embedding,
      context: row.context,
      results: row.results,
      createdAt: row.created_at,
    }));
  }

  async saveEvaluation(evaluation) {
    if (!this.pool) return evaluation;
    await this.pool.query(
      `
      INSERT INTO research_evaluations (id, name, metrics, details, created_at)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (id) DO NOTHING
      `,
      [
        evaluation.id,
        evaluation.name,
        json(evaluation.metrics || {}),
        json(evaluation.details || {}),
        evaluation.createdAt || new Date().toISOString(),
      ],
    );
    return evaluation;
  }

  async listEvaluations() {
    if (!this.pool) return [];
    const { rows } = await this.pool.query("SELECT * FROM research_evaluations ORDER BY created_at DESC");
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      metrics: row.metrics,
      details: row.details,
      createdAt: row.created_at,
    }));
  }

  async close() {
    if (this.pool) await this.pool.end();
  }
}
