import pg from "pg";
import { average, stableHash } from "../domain/text.js";
import { calculateTrend, getResolvedState } from "../detection/trends.js";
import { computeReinforcementCount } from "./store-utils.js";

const { Pool } = pg;

function json(value) {
  return JSON.stringify(value ?? null);
}

export class PostgresPatternStore {
  constructor({ connectionString, max = 10 } = {}) {
    this.pool = connectionString ? new Pool({ connectionString, max }) : null;
  }

  static disabled() {
    return new PostgresPatternStore({ connectionString: null });
  }

  async ensureSchema() {
    if (!this.pool) return true;

    await this.pool.query(`
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

  async saveDetection(record) {
    if (!this.pool) return record;

    const current = await this.getPattern(record.userId, record.patternId);
    const occRes = await this.pool.query("SELECT * FROM pattern_occurrences WHERE user_id = $1 AND pattern_id = $2 ORDER BY occurred_at ASC", [record.userId, record.patternId]);
    const existingOccurrences = occRes.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      patternId: row.pattern_id,
      sourceType: row.source_type,
      sourceId: row.source_id,
      sourceHash: row.source_hash,
      text: row.text,
      excerpt: row.excerpt,
      occurredAt: row.occurred_at,
      intensity: row.intensity,
      confidence: row.confidence,
      keywordHits: row.keyword_hits,
      triggerSignals: row.trigger_signals,
      domains: row.domains,
      metadata: row.metadata,
    }));
    const occurrences = [...existingOccurrences, record.occurrence];
    const trend = calculateTrend(
      current || {
        lastOccurrenceAt: record.occurrence.occurredAt,
      },
      occurrences,
      new Date(record.occurrence.occurredAt),
      30,
    );
    const frequency = occurrences.length;
    const intensity = Number(average(occurrences.map((occurrence) => occurrence.intensity)).toFixed(4));
    const confidence = Number(average(occurrences.map((occurrence) => occurrence.confidence)).toFixed(4));
    const statusInfo = getResolvedState(current || record.pattern, trend, occurrences);
    const reinforcementCount = Number.isFinite(record.reinforcementCount)
      ? record.reinforcementCount
      : computeReinforcementCount(occurrences);

    const updatedPattern = {
      ...(current || record.pattern),
      id: record.patternId,
      userId: record.userId,
      key: record.pattern.key,
      label: record.pattern.label,
      family: record.pattern.family,
      kind: record.pattern.kind,
      clusterId: record.pattern.clusterId,
      canonicalKey: record.pattern.canonicalKey,
      sourceTypes: record.pattern.sourceTypes,
      domains: record.pattern.domains,
      frequency,
      intensity,
      confidence,
      firstOccurrenceAt: current?.firstOccurrenceAt || record.occurrence.occurredAt,
      lastOccurrenceAt: record.occurrence.occurredAt,
      trendDirection: trend.direction,
      trendScore: trend.score,
      reinforcementCount,
      triggerCounts: record.triggerCounts,
      topTriggers: record.topTriggers,
      status: statusInfo.status,
      resolvedAt: statusInfo.resolvedAt,
      updatedAt: record.occurrence.occurredAt,
    };

    await this.pool.query(
      `
      INSERT INTO detected_patterns (
        id, user_id, key, label, family, kind, cluster_id, canonical_key, source_types, domains,
        frequency, intensity, confidence, first_occurrence_at, last_occurrence_at, trend_direction,
        trend_score, reinforcement_count, trigger_counts, top_triggers, status, resolved_at, updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,
        $17,$18,$19,$20,$21,$22,$23
      )
      ON CONFLICT (user_id, canonical_key) DO UPDATE
      SET label = EXCLUDED.label,
          family = EXCLUDED.family,
          kind = EXCLUDED.kind,
          cluster_id = EXCLUDED.cluster_id,
          source_types = EXCLUDED.source_types,
          domains = EXCLUDED.domains,
          frequency = EXCLUDED.frequency,
          intensity = EXCLUDED.intensity,
          confidence = EXCLUDED.confidence,
          first_occurrence_at = EXCLUDED.first_occurrence_at,
          last_occurrence_at = EXCLUDED.last_occurrence_at,
          trend_direction = EXCLUDED.trend_direction,
          trend_score = EXCLUDED.trend_score,
          reinforcement_count = EXCLUDED.reinforcement_count,
          trigger_counts = EXCLUDED.trigger_counts,
          top_triggers = EXCLUDED.top_triggers,
          status = EXCLUDED.status,
          resolved_at = EXCLUDED.resolved_at,
          updated_at = EXCLUDED.updated_at
      `,
      [
        updatedPattern.id,
        record.userId,
        updatedPattern.key,
        updatedPattern.label,
        updatedPattern.family,
        updatedPattern.kind,
        updatedPattern.clusterId,
        updatedPattern.canonicalKey,
        json(updatedPattern.sourceTypes),
        json(updatedPattern.domains),
        updatedPattern.frequency,
        updatedPattern.intensity,
        updatedPattern.confidence,
        updatedPattern.firstOccurrenceAt,
        updatedPattern.lastOccurrenceAt,
        updatedPattern.trendDirection,
        updatedPattern.trendScore,
        updatedPattern.reinforcementCount,
        json(updatedPattern.triggerCounts),
        json(updatedPattern.topTriggers),
        updatedPattern.status,
        updatedPattern.resolvedAt,
        updatedPattern.updatedAt,
      ],
    );

    await this.pool.query(
      `
      INSERT INTO pattern_occurrences (
        id, user_id, pattern_id, source_type, source_id, source_hash, text, excerpt,
        occurred_at, intensity, confidence, keyword_hits, trigger_signals, domains, metadata
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      ON CONFLICT (id) DO NOTHING
      `,
      [
        record.occurrence.id,
        record.userId,
        record.patternId,
        record.occurrence.sourceType,
        record.occurrence.sourceId,
        record.occurrence.sourceHash,
        record.occurrence.text,
        record.occurrence.excerpt,
        record.occurrence.occurredAt,
        record.occurrence.intensity,
        record.occurrence.confidence,
        json(record.occurrence.keywordHits),
        json(record.occurrence.triggerSignals),
        json(record.occurrence.domains),
        json(record.occurrence.metadata),
      ],
    );

    await this.pool.query(
      `
      INSERT INTO pattern_evolution (
        id, user_id, pattern_id, occurred_at, snapshot, trend, created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (id) DO NOTHING
      `,
      [
        stableHash(`${record.patternId}:${record.occurrence.occurredAt}:${frequency}`),
        record.userId,
        record.patternId,
        record.occurrence.occurredAt,
        json(updatedPattern),
        json(trend),
        record.occurrence.occurredAt,
      ],
    );

    await this.pool.query(
      `
      INSERT INTO pattern_events (
        id, user_id, pattern_id, event_type, payload, created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (id) DO NOTHING
      `,
      [
        stableHash(`${record.patternId}:${record.occurrence.sourceId}:${record.occurrence.occurredAt}`),
        record.userId,
        record.patternId,
        "pattern_detected",
        json({
          occurrenceId: record.occurrence.id,
          sourceType: record.occurrence.sourceType,
          sourceId: record.occurrence.sourceId,
        }),
        record.occurrence.occurredAt,
      ],
    );

    return {
      pattern: updatedPattern,
      occurrence: record.occurrence,
      trend,
    };
  }

  async listPatterns(userId, filters = {}) {
    if (!this.pool) return [];

    const where = ["user_id = $1"];
    const values = [userId];
    if (filters.family) {
      values.push(filters.family);
      where.push(`family = $${values.length}`);
    }
    if (filters.status) {
      values.push(filters.status);
      where.push(`status = $${values.length}`);
    }
    if (filters.sourceType) {
      values.push(filters.sourceType);
      where.push(`source_types ? $${values.length}`);
    }

    const { rows } = await this.pool.query(`SELECT * FROM detected_patterns WHERE ${where.join(" AND ")} ORDER BY last_occurrence_at DESC`, values);
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      key: row.key,
      label: row.label,
      family: row.family,
      kind: row.kind,
      clusterId: row.cluster_id,
      canonicalKey: row.canonical_key,
      sourceTypes: row.source_types,
      domains: row.domains,
      frequency: row.frequency,
      intensity: row.intensity,
      confidence: row.confidence,
      firstOccurrenceAt: row.first_occurrence_at,
      lastOccurrenceAt: row.last_occurrence_at,
      trendDirection: row.trend_direction,
      trendScore: row.trend_score,
      reinforcementCount: row.reinforcement_count,
      triggerCounts: row.trigger_counts,
      topTriggers: row.top_triggers,
      status: row.status,
      resolvedAt: row.resolved_at,
      updatedAt: row.updated_at,
      lexicalRank: row.lexical_rank,
    }));
  }

  async getPattern(userId, patternId) {
    if (!this.pool) return null;

    const { rows } = await this.pool.query("SELECT * FROM detected_patterns WHERE user_id = $1 AND id = $2 LIMIT 1", [userId, patternId]);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      key: row.key,
      label: row.label,
      family: row.family,
      kind: row.kind,
      clusterId: row.cluster_id,
      canonicalKey: row.canonical_key,
      sourceTypes: row.source_types,
      domains: row.domains,
      frequency: row.frequency,
      intensity: row.intensity,
      confidence: row.confidence,
      firstOccurrenceAt: row.first_occurrence_at,
      lastOccurrenceAt: row.last_occurrence_at,
      trendDirection: row.trend_direction,
      trendScore: row.trend_score,
      reinforcementCount: row.reinforcement_count,
      triggerCounts: row.trigger_counts,
      topTriggers: row.top_triggers,
      status: row.status,
      resolvedAt: row.resolved_at,
      updatedAt: row.updated_at,
    };
  }

  async listOccurrences(userId, patternId = null) {
    if (!this.pool) return [];

    const values = [userId];
    let query = "SELECT * FROM pattern_occurrences WHERE user_id = $1";
    if (patternId) {
      values.push(patternId);
      query += ` AND pattern_id = $2`;
    }
    query += " ORDER BY occurred_at ASC";
    const { rows } = await this.pool.query(query, values);
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      patternId: row.pattern_id,
      sourceType: row.source_type,
      sourceId: row.source_id,
      sourceHash: row.source_hash,
      text: row.text,
      excerpt: row.excerpt,
      occurredAt: row.occurred_at,
      intensity: row.intensity,
      confidence: row.confidence,
      keywordHits: row.keyword_hits,
      triggerSignals: row.trigger_signals,
      domains: row.domains,
      metadata: row.metadata,
    }));
  }

  async listEvolution(userId, patternId) {
    if (!this.pool) return [];

    const { rows } = await this.pool.query(
      "SELECT * FROM pattern_evolution WHERE user_id = $1 AND ($2::text IS NULL OR pattern_id = $2) ORDER BY occurred_at DESC",
      [userId, patternId || null],
    );
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      patternId: row.pattern_id,
      occurredAt: row.occurred_at,
      snapshot: row.snapshot,
      trend: row.trend,
      createdAt: row.created_at,
    }));
  }

  async searchPatterns(userId, query) {
    if (!this.pool) return [];

    const normalizedQuery = String(query || "").trim();
    if (!normalizedQuery) {
      const { rows } = await this.pool.query(
        "SELECT * FROM detected_patterns WHERE user_id = $1 ORDER BY frequency DESC, last_occurrence_at DESC",
        [userId],
      );
      return rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        key: row.key,
        label: row.label,
        family: row.family,
        kind: row.kind,
        clusterId: row.cluster_id,
        canonicalKey: row.canonical_key,
        sourceTypes: row.source_types,
        domains: row.domains,
        frequency: row.frequency,
        intensity: row.intensity,
        confidence: row.confidence,
        firstOccurrenceAt: row.first_occurrence_at,
        lastOccurrenceAt: row.last_occurrence_at,
        trendDirection: row.trend_direction,
        trendScore: row.trend_score,
        reinforcementCount: row.reinforcement_count,
        triggerCounts: row.trigger_counts,
        topTriggers: row.top_triggers,
        status: row.status,
        resolvedAt: row.resolved_at,
        updatedAt: row.updated_at,
      }));
    }

    const { rows } = await this.pool.query(
      `
      SELECT *,
        ts_rank_cd(
          to_tsvector('english', coalesce(label, '') || ' ' || coalesce(key, '') || ' ' || coalesce(family, '')),
          plainto_tsquery('english', $2)
        ) AS lexical_rank
      FROM detected_patterns
      WHERE user_id = $1
        AND (
          label ILIKE '%' || $2 || '%' OR
          key ILIKE '%' || $2 || '%' OR
          family ILIKE '%' || $2 || '%'
        )
      ORDER BY lexical_rank DESC, frequency DESC
      `,
      [userId, normalizedQuery],
    );

    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      key: row.key,
      label: row.label,
      family: row.family,
      kind: row.kind,
      clusterId: row.cluster_id,
      canonicalKey: row.canonical_key,
      sourceTypes: row.source_types,
      domains: row.domains,
      frequency: row.frequency,
      intensity: row.intensity,
      confidence: row.confidence,
      firstOccurrenceAt: row.first_occurrence_at,
      lastOccurrenceAt: row.last_occurrence_at,
      trendDirection: row.trend_direction,
      trendScore: row.trend_score,
      reinforcementCount: row.reinforcement_count,
      triggerCounts: row.trigger_counts,
      topTriggers: row.top_triggers,
      status: row.status,
      resolvedAt: row.resolved_at,
      updatedAt: row.updated_at,
    }));
  }

  async getOccurrencesByRange(userId, startIso, endIso) {
    if (!this.pool) return [];

    const { rows } = await this.pool.query(
      `
      SELECT * FROM pattern_occurrences
      WHERE user_id = $1
        AND occurred_at >= $2
        AND occurred_at < $3
      ORDER BY occurred_at ASC
      `,
      [userId, startIso, endIso],
    );
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      patternId: row.pattern_id,
      sourceType: row.source_type,
      sourceId: row.source_id,
      sourceHash: row.source_hash,
      text: row.text,
      excerpt: row.excerpt,
      occurredAt: row.occurred_at,
      intensity: row.intensity,
      confidence: row.confidence,
      keywordHits: row.keyword_hits,
      triggerSignals: row.trigger_signals,
      domains: row.domains,
      metadata: row.metadata,
    }));
  }

  async appendEvent(event) {
    if (!this.pool) return event;
    await this.pool.query(
      `
      INSERT INTO pattern_events (id, user_id, pattern_id, event_type, payload, created_at)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (id) DO NOTHING
      `,
      [event.id, event.userId, event.patternId, event.eventType, json(event.payload), event.createdAt],
    );
    return event;
  }

  async close() {
    if (this.pool) await this.pool.end();
  }
}
