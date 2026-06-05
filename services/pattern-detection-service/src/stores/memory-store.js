import { average, stableHash, uniqueBy } from "../domain/text.js";
import { calculateTrend, getResolvedState } from "../detection/trends.js";
import { computeReinforcementCount } from "./store-utils.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class InMemoryPatternStore {
  constructor() {
    this.patterns = new Map();
    this.occurrences = [];
    this.evolutions = [];
    this.events = [];
  }

  async ensureSchema() {
    return true;
  }

  async healthCheck() {
    return { ok: true, provider: "in-memory" };
  }

  async saveDetection(record) {
    const current = this.patterns.get(record.patternId);
    const existingOccurrences = this.occurrences.filter((occurrence) => occurrence.patternId === record.patternId);
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
    const reinforcementCount = computeReinforcementCount(occurrences);
    const statusInfo = getResolvedState(current || record.pattern, trend, occurrences);

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
      sourceTypes: uniqueBy([...((current?.sourceTypes || [])), record.occurrence.sourceType], (item) => item),
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
      domains: uniqueBy([...(current?.domains || []), ...(record.occurrence.domains || [])], (item) => item),
      status: statusInfo.status,
      resolvedAt: statusInfo.resolvedAt,
      updatedAt: record.occurrence.occurredAt,
    };

    this.patterns.set(record.patternId, updatedPattern);
    this.occurrences.push(record.occurrence);

    const evolution = {
      id: stableHash(`${record.patternId}:${record.occurrence.occurredAt}:${frequency}`),
      patternId: record.patternId,
      userId: record.userId,
      occurredAt: record.occurrence.occurredAt,
      snapshot: clone(updatedPattern),
      trend,
      createdAt: record.occurrence.occurredAt,
    };
    this.evolutions.push(evolution);

    this.events.push({
      id: stableHash(`${record.patternId}:${record.occurrence.sourceId}:${record.occurrence.occurredAt}`),
      userId: record.userId,
      patternId: record.patternId,
      eventType: "pattern_detected",
      payload: {
        occurrenceId: record.occurrence.id,
        sourceType: record.occurrence.sourceType,
        sourceId: record.occurrence.sourceId,
      },
      createdAt: record.occurrence.occurredAt,
    });

    return {
      pattern: updatedPattern,
      occurrence: record.occurrence,
      trend,
    };
  }

  async listPatterns(userId, filters = {}) {
    return [...this.patterns.values()].filter((pattern) => {
      if (pattern.userId !== userId) return false;
      if (filters.family && pattern.family !== filters.family) return false;
      if (filters.status && pattern.status !== filters.status) return false;
      if (filters.sourceType && !(pattern.sourceTypes || []).includes(filters.sourceType)) return false;
      return true;
    });
  }

  async getPattern(userId, patternId) {
    const pattern = this.patterns.get(patternId);
    if (!pattern || pattern.userId !== userId) return null;
    return pattern;
  }

  async listOccurrences(userId, patternId = null) {
    return this.occurrences.filter((occurrence) => {
      if (occurrence.userId !== userId) return false;
      if (patternId && occurrence.patternId !== patternId) return false;
      return true;
    });
  }

  async listEvolution(userId, patternId) {
    return this.evolutions.filter((evolution) => evolution.userId === userId && (!patternId || evolution.patternId === patternId));
  }

  async searchPatterns(userId, query) {
    const normalized = String(query).toLowerCase();
    return [...this.patterns.values()]
      .filter((pattern) => pattern.userId === userId)
      .map((pattern) => {
        const haystack = [pattern.label, pattern.key, pattern.family, ...(pattern.sourceTypes || []), ...(pattern.domains || [])].join(" ").toLowerCase();
        const lexical = haystack.includes(normalized) ? 1 : 0;
        return {
          ...pattern,
          lexicalScore: lexical,
        };
      })
      .sort((a, b) => b.lexicalScore - a.lexicalScore || b.frequency - a.frequency);
  }

  async getOccurrencesByRange(userId, startIso, endIso) {
    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endIso).getTime();
    return this.occurrences.filter((occurrence) => {
      if (occurrence.userId !== userId) return false;
      const time = new Date(occurrence.occurredAt).getTime();
      return time >= startMs && time < endMs;
    });
  }

  async appendEvent(event) {
    this.events.push(event);
    return event;
  }

  async close() {
    return true;
  }
}
