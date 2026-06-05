import pg from "pg";
import { createHashEmbedding } from "../embeddings/hash-vector.js";
import { scoreMemoryNode } from "./scoring.js";

const { Pool } = pg;

function json(value) {
  return JSON.stringify(value ?? null);
}

export class PostgresMemoryBackupStore {
  constructor({ connectionString, max = 10 } = {}) {
    this.pool = connectionString ? new Pool({ connectionString, max }) : null;
  }

  static disabled() {
    return new PostgresMemoryBackupStore({ connectionString: null });
  }

  async ensureSchema() {
    if (!this.pool) return true;

    await this.pool.query(`
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

      CREATE INDEX IF NOT EXISTS memory_events_user_idx ON memory_events (user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS memory_nodes_user_last_seen_idx ON memory_nodes (user_id, last_seen_at DESC);
      CREATE INDEX IF NOT EXISTS memory_nodes_user_title_idx ON memory_nodes (user_id, title);
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

  async saveReflection(record) {
    if (!this.pool) return record;

    const existing = await this.pool.query("SELECT COALESCE(MAX(graph_revision), 0) + 1 AS revision FROM memory_events WHERE user_id = $1", [record.userId]);
    const graphRevision = Number(existing.rows[0]?.revision || 1);

    await this.pool.query(
      `
      INSERT INTO reflections (id, user_id, raw_text, normalized_text, source, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE
      SET raw_text = EXCLUDED.raw_text,
          normalized_text = EXCLUDED.normalized_text,
          source = EXCLUDED.source,
          metadata = EXCLUDED.metadata
      `,
      [
        record.reflectionId,
        record.userId,
        record.rawText,
        record.normalizedText,
        record.source,
        json(record.metadata),
        record.occurredAt,
      ],
    );

    return { ...record, graphRevision };
  }

  async upsertNodes(userId, reflectionId, nodes, capturedAt) {
    if (!this.pool) return nodes;

    for (const node of nodes) {
      await this.pool.query(
        `
        INSERT INTO memory_nodes (
          id, user_id, node_type, canonical_key, title, summary, body, content_hash,
          properties, embedding, first_seen_at, last_seen_at, version
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,1)
        ON CONFLICT (user_id, canonical_key) DO UPDATE
        SET title = EXCLUDED.title,
            summary = EXCLUDED.summary,
            body = EXCLUDED.body,
            properties = EXCLUDED.properties,
            embedding = EXCLUDED.embedding,
            last_seen_at = EXCLUDED.last_seen_at,
            version = memory_nodes.version + 1
        `,
        [
          node.id,
          userId,
          node.type,
          node.canonicalKey,
          node.title,
          node.summary,
          node.body,
          node.contentHash,
          json(node.properties),
          json(node.embedding),
          node.firstSeenAt || capturedAt,
          capturedAt,
        ],
      );
    }

    return nodes;
  }

  async upsertEdges(userId, reflectionId, edges, capturedAt) {
    if (!this.pool) return edges;

    for (const edge of edges) {
      await this.pool.query(
        `
        INSERT INTO memory_edges (
          id, user_id, source_node_id, target_node_id, edge_type, canonical_key, strength, confidence,
          evidence, properties, first_seen_at, last_seen_at, version
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,1)
        ON CONFLICT (user_id, canonical_key) DO UPDATE
        SET strength = EXCLUDED.strength,
            confidence = EXCLUDED.confidence,
            evidence = EXCLUDED.evidence,
            properties = EXCLUDED.properties,
            last_seen_at = EXCLUDED.last_seen_at,
            version = memory_edges.version + 1
        `,
        [
          edge.id,
          userId,
          edge.sourceId,
          edge.targetId,
          edge.type,
          edge.canonicalKey,
          edge.strength,
          edge.confidence,
          json(edge.evidence),
          json(edge.properties),
          edge.firstSeenAt || capturedAt,
          capturedAt,
        ],
      );
    }

    return edges;
  }

  async appendEvent(event) {
    if (!this.pool) return event;

    await this.pool.query(
      `
      INSERT INTO memory_events (
        id, user_id, event_type, reflection_id, entity_type, entity_id, graph_revision, payload, created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (id) DO NOTHING
      `,
      [
        event.id,
        event.userId,
        event.eventType,
        event.reflectionId || null,
        event.entityType || null,
        event.entityId || null,
        event.graphRevision,
        json(event.payload),
        event.createdAt,
      ],
    );

    return event;
  }

  async getMemoryById(userId, id) {
    if (!this.pool) return null;

    const { rows } = await this.pool.query("SELECT * FROM memory_nodes WHERE user_id = $1 AND id = $2 LIMIT 1", [userId, id]);
    return rows[0] || null;
  }

  async searchNodes({ userId, query, topK = 10, domains = [] }) {
    if (!this.pool) return [];

    const normalizedQuery = String(query).trim();
    const { rows } = await this.pool.query(
      `
      SELECT *,
        ts_rank_cd(
          to_tsvector('english', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(body, '')),
          plainto_tsquery('english', $2)
        ) AS lexical_rank
      FROM memory_nodes
      WHERE user_id = $1
        AND (
          title ILIKE '%' || $2 || '%' OR
          summary ILIKE '%' || $2 || '%' OR
          body ILIKE '%' || $2 || '%' OR
          to_tsvector('english', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(body, '')) @@ plainto_tsquery('english', $2)
        )
      ORDER BY lexical_rank DESC, last_seen_at DESC
      LIMIT $3
      `,
      [userId, normalizedQuery, topK * 2],
    );

    const queryEmbedding = createHashEmbedding(normalizedQuery);
    const ranked = rows
      .map((row) => {
        const node = {
          id: row.id,
          userId: row.user_id,
          type: row.node_type,
          title: row.title,
          summary: row.summary,
          body: row.body,
          properties: row.properties,
          embedding: row.embedding,
          lifeDomains: row.properties?.lifeDomains || [],
          firstSeenAt: row.first_seen_at,
          lastSeenAt: row.last_seen_at,
          version: row.version,
          salience: row.properties?.salience,
          centrality: row.properties?.centrality,
          goalAlignment: row.properties?.goalAlignment,
          contentHash: row.content_hash,
        };
        return { ...node, score: scoreMemoryNode(node, { queryEmbedding, domain: domains.join(" ") }) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return ranked;
  }

  async listEvolution(userId, nodeId) {
    if (!this.pool) return [];

    const { rows } = await this.pool.query(
      `
      SELECT * FROM memory_events
      WHERE user_id = $1
        AND ($2::text IS NULL OR entity_id = $2 OR reflection_id = $2)
      ORDER BY created_at DESC
      `,
      [userId, nodeId || null],
    );

    return rows;
  }

  async close() {
    if (this.pool) await this.pool.end();
  }
}

