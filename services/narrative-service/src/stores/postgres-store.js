import pg from "pg";
import { average, stableHash } from "../domain/text.js";
import { buildNarrativeChapters, currentChapterFromChapters } from "../detection/chapters.js";
import { calculateTrend, getNarrativeState } from "../detection/trends.js";
import { buildOccurrenceId, computeSupportDepth, uniqueSupportCollection } from "./store-utils.js";

const { Pool } = pg;

function json(value) {
  return JSON.stringify(value ?? null);
}

function mapNarrativeRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    key: row.key,
    label: row.label,
    family: row.family,
    kind: row.kind,
    clusterId: row.cluster_id,
    canonicalKey: row.canonical_key,
    summary: row.summary,
    themes: row.themes,
    supportingMemories: row.supporting_memories,
    supportingPatterns: row.supporting_patterns,
    supportingEmotions: row.supporting_emotions,
    supportingGoals: row.supporting_goals,
    identityShifts: row.identity_shifts,
    beliefShifts: row.belief_shifts,
    valueShifts: row.value_shifts,
    emotionalMaturation: row.emotional_maturation,
    frequency: row.frequency,
    intensity: row.intensity,
    confidence: row.confidence,
    startDate: row.start_date,
    firstOccurrenceAt: row.first_occurrence_at,
    lastOccurrenceAt: row.last_occurrence_at,
    trendDirection: row.trend_direction,
    trendScore: row.trend_score,
    status: row.status,
    completedAt: row.completed_at,
    currentChapterNumber: row.current_chapter_number,
    currentChapterTitle: row.current_chapter_title,
    chapters: row.chapters,
    evidenceScore: row.evidence_score,
    updatedAt: row.updated_at,
    sourceTypes: row.source_types,
    lexicalRank: row.lexical_rank,
  };
}

function mapOccurrenceRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    narrativeId: row.narrative_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourceHash: row.source_hash,
    text: row.text,
    excerpt: row.excerpt,
    occurredAt: row.occurred_at,
    intensity: row.intensity,
    confidence: row.confidence,
    supportingMemories: row.supporting_memories,
    supportingPatterns: row.supporting_patterns,
    supportingEmotions: row.supporting_emotions,
    supportingGoals: row.supporting_goals,
    identitySignals: row.identity_signals,
    themes: row.themes,
    metadata: row.metadata,
  };
}

export class PostgresNarrativeStore {
  constructor({ connectionString, max = 10 } = {}) {
    this.pool = connectionString ? new Pool({ connectionString, max }) : null;
  }

  static disabled() {
    return new PostgresNarrativeStore({ connectionString: null });
  }

  async ensureSchema() {
    if (!this.pool) return true;

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS narratives (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        key TEXT NOT NULL,
        label TEXT NOT NULL,
        family TEXT NOT NULL,
        kind TEXT NOT NULL,
        cluster_id TEXT NOT NULL,
        canonical_key TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        themes JSONB NOT NULL DEFAULT '[]'::jsonb,
        supporting_memories JSONB NOT NULL DEFAULT '[]'::jsonb,
        supporting_patterns JSONB NOT NULL DEFAULT '[]'::jsonb,
        supporting_emotions JSONB NOT NULL DEFAULT '[]'::jsonb,
        supporting_goals JSONB NOT NULL DEFAULT '[]'::jsonb,
        identity_shifts JSONB NOT NULL DEFAULT '[]'::jsonb,
        belief_shifts JSONB NOT NULL DEFAULT '[]'::jsonb,
        value_shifts JSONB NOT NULL DEFAULT '[]'::jsonb,
        emotional_maturation JSONB NOT NULL DEFAULT '[]'::jsonb,
        source_types JSONB NOT NULL DEFAULT '[]'::jsonb,
        frequency INT NOT NULL DEFAULT 0,
        intensity DOUBLE PRECISION NOT NULL DEFAULT 0,
        confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
        start_date TIMESTAMPTZ NOT NULL,
        first_occurrence_at TIMESTAMPTZ NOT NULL,
        last_occurrence_at TIMESTAMPTZ NOT NULL,
        trend_direction TEXT NOT NULL DEFAULT 'stable',
        trend_score DOUBLE PRECISION NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        completed_at TIMESTAMPTZ,
        current_chapter_number INT NOT NULL DEFAULT 1,
        current_chapter_title TEXT NOT NULL DEFAULT 'Recognizing the Pattern',
        chapters JSONB NOT NULL DEFAULT '[]'::jsonb,
        evidence_score DOUBLE PRECISION NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS narratives_user_canonical_idx
        ON narratives (user_id, canonical_key);

      CREATE INDEX IF NOT EXISTS narratives_user_status_idx
        ON narratives (user_id, status, last_occurrence_at DESC);

      CREATE INDEX IF NOT EXISTS narratives_user_frequency_idx
        ON narratives (user_id, frequency DESC, last_occurrence_at DESC);

      CREATE TABLE IF NOT EXISTS narrative_occurrences (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        narrative_id TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_id TEXT,
        source_hash TEXT NOT NULL,
        text TEXT NOT NULL,
        excerpt TEXT NOT NULL,
        occurred_at TIMESTAMPTZ NOT NULL,
        intensity DOUBLE PRECISION NOT NULL,
        confidence DOUBLE PRECISION NOT NULL,
        supporting_memories JSONB NOT NULL DEFAULT '[]'::jsonb,
        supporting_patterns JSONB NOT NULL DEFAULT '[]'::jsonb,
        supporting_emotions JSONB NOT NULL DEFAULT '[]'::jsonb,
        supporting_goals JSONB NOT NULL DEFAULT '[]'::jsonb,
        identity_signals JSONB NOT NULL DEFAULT '{}'::jsonb,
        themes JSONB NOT NULL DEFAULT '[]'::jsonb,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS narrative_occurrences_user_narrative_idx
        ON narrative_occurrences (user_id, narrative_id, occurred_at DESC);

      CREATE INDEX IF NOT EXISTS narrative_occurrences_user_time_idx
        ON narrative_occurrences (user_id, occurred_at DESC);

      CREATE TABLE IF NOT EXISTS narrative_evolution (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        narrative_id TEXT NOT NULL,
        occurred_at TIMESTAMPTZ NOT NULL,
        snapshot JSONB NOT NULL,
        trend JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS narrative_evolution_user_narrative_idx
        ON narrative_evolution (user_id, narrative_id, occurred_at DESC);

      CREATE TABLE IF NOT EXISTS narrative_events (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        narrative_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS narrative_events_user_idx
        ON narrative_events (user_id, created_at DESC);
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

    const current = await this.getNarrative(record.userId, record.narrativeId);
    const occRes = await this.pool.query(
      "SELECT * FROM narrative_occurrences WHERE user_id = $1 AND narrative_id = $2 ORDER BY occurred_at ASC",
      [record.userId, record.narrativeId],
    );
    const existingOccurrences = occRes.rows.map(mapOccurrenceRow);
    const occurrences = [...existingOccurrences, record.occurrence];
    const trend = calculateTrend(
      current || {
        lastOccurrenceAt: record.occurrence.occurredAt,
      },
      occurrences,
      new Date(record.occurrence.occurredAt),
      90,
    );

    const frequency = occurrences.length;
    const intensity = Number(average(occurrences.map((occurrence) => occurrence.intensity)).toFixed(4));
    const confidence = Number(average(occurrences.map((occurrence) => occurrence.confidence)).toFixed(4));
    const chapters = buildNarrativeChapters(current || record.narrative, occurrences, record.identitySignals);
    const currentChapter = currentChapterFromChapters(chapters);
    const stateInfo = getNarrativeState(current || record.narrative, trend, occurrences);
    const supportDepth = computeSupportDepth(record.narrative || record.occurrence);

    const updatedNarrative = {
      ...(current || record.narrative),
      id: record.narrativeId,
      userId: record.userId,
      key: record.narrative.key,
      label: record.narrative.label,
      family: record.narrative.family,
      kind: record.narrative.kind,
      clusterId: record.narrative.clusterId,
      canonicalKey: record.narrative.canonicalKey,
      summary: record.narrative.summary,
      themes: record.narrative.themes,
      supportingMemories: uniqueSupportCollection([...(current?.supportingMemories || []), ...(record.narrative.supportingMemories || [])]),
      supportingPatterns: uniqueSupportCollection([...(current?.supportingPatterns || []), ...(record.narrative.supportingPatterns || [])]),
      supportingEmotions: uniqueSupportCollection([...(current?.supportingEmotions || []), ...(record.narrative.supportingEmotions || [])]),
      supportingGoals: uniqueSupportCollection([...(current?.supportingGoals || []), ...(record.narrative.supportingGoals || [])]),
      identityShifts: uniqueSupportCollection([...(current?.identityShifts || []), ...(record.identitySignals?.identityStatements || [])]),
      beliefShifts: uniqueSupportCollection([...(current?.beliefShifts || []), ...(record.identitySignals?.beliefChanges || [])]),
      valueShifts: uniqueSupportCollection([...(current?.valueShifts || []), ...(record.identitySignals?.valueShifts || [])]),
      emotionalMaturation: uniqueSupportCollection([...(current?.emotionalMaturation || []), ...(record.identitySignals?.emotionalMaturation || [])]),
      sourceTypes: uniqueSupportCollection([...(current?.sourceTypes || []), ...(record.narrative.sourceTypes || [])]),
      frequency,
      intensity,
      confidence,
      startDate: current?.startDate || record.occurrence.occurredAt,
      firstOccurrenceAt: current?.firstOccurrenceAt || record.occurrence.occurredAt,
      lastOccurrenceAt: record.occurrence.occurredAt,
      trendDirection: trend.direction,
      trendScore: trend.score,
      status: stateInfo.status,
      completedAt: stateInfo.completedAt,
      currentChapterNumber: currentChapter?.number || 1,
      currentChapterTitle: currentChapter?.title || "Recognizing the Pattern",
      chapters,
      evidenceScore: Number((supportDepth + frequency * 0.1).toFixed(4)),
      updatedAt: record.occurrence.occurredAt,
    };

    await this.pool.query(
      `
      INSERT INTO narratives (
        id, user_id, key, label, family, kind, cluster_id, canonical_key, summary, themes,
        supporting_memories, supporting_patterns, supporting_emotions, supporting_goals,
        identity_shifts, belief_shifts, value_shifts, emotional_maturation, source_types,
        frequency, intensity, confidence, start_date, first_occurrence_at, last_occurrence_at,
        trend_direction, trend_score, status, completed_at, current_chapter_number,
        current_chapter_title, chapters, evidence_score, updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,
        $20,$21,$22,$23,$24,$25,
        $26,$27,$28,$29,$30,
        $31,$32,$33,$34
      )
      ON CONFLICT (user_id, canonical_key) DO UPDATE
      SET label = EXCLUDED.label,
          family = EXCLUDED.family,
          kind = EXCLUDED.kind,
          cluster_id = EXCLUDED.cluster_id,
          summary = EXCLUDED.summary,
          themes = EXCLUDED.themes,
          supporting_memories = EXCLUDED.supporting_memories,
          supporting_patterns = EXCLUDED.supporting_patterns,
          supporting_emotions = EXCLUDED.supporting_emotions,
          supporting_goals = EXCLUDED.supporting_goals,
          identity_shifts = EXCLUDED.identity_shifts,
          belief_shifts = EXCLUDED.belief_shifts,
          value_shifts = EXCLUDED.value_shifts,
          emotional_maturation = EXCLUDED.emotional_maturation,
          source_types = EXCLUDED.source_types,
          frequency = EXCLUDED.frequency,
          intensity = EXCLUDED.intensity,
          confidence = EXCLUDED.confidence,
          start_date = EXCLUDED.start_date,
          first_occurrence_at = EXCLUDED.first_occurrence_at,
          last_occurrence_at = EXCLUDED.last_occurrence_at,
          trend_direction = EXCLUDED.trend_direction,
          trend_score = EXCLUDED.trend_score,
          status = EXCLUDED.status,
          completed_at = EXCLUDED.completed_at,
          current_chapter_number = EXCLUDED.current_chapter_number,
          current_chapter_title = EXCLUDED.current_chapter_title,
          chapters = EXCLUDED.chapters,
          evidence_score = EXCLUDED.evidence_score,
          updated_at = EXCLUDED.updated_at
      `,
      [
        updatedNarrative.id,
        record.userId,
        updatedNarrative.key,
        updatedNarrative.label,
        updatedNarrative.family,
        updatedNarrative.kind,
        updatedNarrative.clusterId,
        updatedNarrative.canonicalKey,
        updatedNarrative.summary,
        json(updatedNarrative.themes),
        json(updatedNarrative.supportingMemories),
        json(updatedNarrative.supportingPatterns),
        json(updatedNarrative.supportingEmotions),
        json(updatedNarrative.supportingGoals),
        json(updatedNarrative.identityShifts),
        json(updatedNarrative.beliefShifts),
        json(updatedNarrative.valueShifts),
        json(updatedNarrative.emotionalMaturation),
        json(updatedNarrative.sourceTypes),
        updatedNarrative.frequency,
        updatedNarrative.intensity,
        updatedNarrative.confidence,
        updatedNarrative.startDate,
        updatedNarrative.firstOccurrenceAt,
        updatedNarrative.lastOccurrenceAt,
        updatedNarrative.trendDirection,
        updatedNarrative.trendScore,
        updatedNarrative.status,
        updatedNarrative.completedAt,
        updatedNarrative.currentChapterNumber,
        updatedNarrative.currentChapterTitle,
        json(updatedNarrative.chapters),
        updatedNarrative.evidenceScore,
        updatedNarrative.updatedAt,
      ],
    );

    await this.pool.query(
      `
      INSERT INTO narrative_occurrences (
        id, user_id, narrative_id, source_type, source_id, source_hash, text, excerpt,
        occurred_at, intensity, confidence, supporting_memories, supporting_patterns,
        supporting_emotions, supporting_goals, identity_signals, themes, metadata
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT (id) DO NOTHING
      `,
      [
        record.occurrence.id,
        record.userId,
        record.narrativeId,
        record.occurrence.sourceType,
        record.occurrence.sourceId,
        record.occurrence.sourceHash,
        record.occurrence.text,
        record.occurrence.excerpt,
        record.occurrence.occurredAt,
        record.occurrence.intensity,
        record.occurrence.confidence,
        json(record.occurrence.supportingMemories),
        json(record.occurrence.supportingPatterns),
        json(record.occurrence.supportingEmotions),
        json(record.occurrence.supportingGoals),
        json(record.identitySignals),
        json(record.occurrence.themes),
        json(record.occurrence.metadata),
      ],
    );

    await this.pool.query(
      `
      INSERT INTO narrative_evolution (
        id, user_id, narrative_id, occurred_at, snapshot, trend, created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (id) DO NOTHING
      `,
      [
        stableHash(`${record.narrativeId}:${record.occurrence.occurredAt}:${frequency}`),
        record.userId,
        record.narrativeId,
        record.occurrence.occurredAt,
        json(updatedNarrative),
        json(trend),
        record.occurrence.occurredAt,
      ],
    );

    await this.pool.query(
      `
      INSERT INTO narrative_events (
        id, user_id, narrative_id, event_type, payload, created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (id) DO NOTHING
      `,
      [
        stableHash(`${record.narrativeId}:${record.occurrence.sourceId}:${record.occurrence.occurredAt}`),
        record.userId,
        record.narrativeId,
        "narrative_detected",
        json({
          occurrenceId: record.occurrence.id,
          sourceType: record.occurrence.sourceType,
          sourceId: record.occurrence.sourceId,
        }),
        record.occurrence.occurredAt,
      ],
    );

    return {
      narrative: updatedNarrative,
      occurrence: record.occurrence,
      trend,
    };
  }

  async listNarratives(userId, filters = {}) {
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
    if (filters.theme) {
      values.push(filters.theme);
      where.push(`themes ? $${values.length}`);
    }
    if (filters.sourceType) {
      values.push(filters.sourceType);
      where.push(`source_types ? $${values.length}`);
    }

    const { rows } = await this.pool.query(
      `SELECT * FROM narratives WHERE ${where.join(" AND ")} ORDER BY last_occurrence_at DESC`,
      values,
    );
    return rows.map(mapNarrativeRow);
  }

  async getNarrative(userId, narrativeId) {
    if (!this.pool) return null;

    const { rows } = await this.pool.query(
      "SELECT * FROM narratives WHERE user_id = $1 AND id = $2 LIMIT 1",
      [userId, narrativeId],
    );
    const row = rows[0];
    return row ? mapNarrativeRow(row) : null;
  }

  async listOccurrences(userId, narrativeId = null) {
    if (!this.pool) return [];

    const values = [userId];
    let query = "SELECT * FROM narrative_occurrences WHERE user_id = $1";
    if (narrativeId) {
      values.push(narrativeId);
      query += ` AND narrative_id = $2`;
    }
    query += " ORDER BY occurred_at ASC";
    const { rows } = await this.pool.query(query, values);
    return rows.map(mapOccurrenceRow);
  }

  async listEvolution(userId, narrativeId) {
    if (!this.pool) return [];

    const { rows } = await this.pool.query(
      "SELECT * FROM narrative_evolution WHERE user_id = $1 AND ($2::text IS NULL OR narrative_id = $2) ORDER BY occurred_at DESC",
      [userId, narrativeId || null],
    );
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      narrativeId: row.narrative_id,
      occurredAt: row.occurred_at,
      snapshot: row.snapshot,
      trend: row.trend,
      createdAt: row.created_at,
    }));
  }

  async searchNarratives(userId, query) {
    if (!this.pool) return [];

    const normalizedQuery = String(query || "").trim();
    if (!normalizedQuery) {
      const { rows } = await this.pool.query(
        "SELECT * FROM narratives WHERE user_id = $1 ORDER BY frequency DESC, last_occurrence_at DESC",
        [userId],
      );
      return rows.map(mapNarrativeRow);
    }

    const { rows } = await this.pool.query(
      `
      SELECT *,
        ts_rank_cd(
          to_tsvector('english', coalesce(label, '') || ' ' || coalesce(key, '') || ' ' || coalesce(family, '') || ' ' || coalesce(summary, '')),
          plainto_tsquery('english', $2)
        ) AS lexical_rank
      FROM narratives
      WHERE user_id = $1
        AND (
          label ILIKE '%' || $2 || '%' OR
          key ILIKE '%' || $2 || '%' OR
          family ILIKE '%' || $2 || '%' OR
          summary ILIKE '%' || $2 || '%'
        )
      ORDER BY lexical_rank DESC, frequency DESC
      `,
      [userId, normalizedQuery],
    );
    return rows.map(mapNarrativeRow);
  }

  async getOccurrencesByRange(userId, startIso, endIso) {
    if (!this.pool) return [];

    const { rows } = await this.pool.query(
      `
      SELECT * FROM narrative_occurrences
      WHERE user_id = $1
        AND occurred_at >= $2
        AND occurred_at < $3
      ORDER BY occurred_at ASC
      `,
      [userId, startIso, endIso],
    );
    return rows.map(mapOccurrenceRow);
  }

  async appendEvent(event) {
    if (!this.pool) return event;
    await this.pool.query(
      `
      INSERT INTO narrative_events (id, user_id, narrative_id, event_type, payload, created_at)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (id) DO NOTHING
      `,
      [event.id, event.userId, event.narrativeId, event.eventType, json(event.payload), event.createdAt],
    );
    return event;
  }

  async close() {
    if (this.pool) await this.pool.end();
  }
}
