import { average, stableHash, uniqueBy } from "../domain/text.js";
import { buildNarrativeChapters, currentChapterFromChapters } from "../detection/chapters.js";
import { calculateTrend, getNarrativeState } from "../detection/trends.js";
import { buildOccurrenceId, buildNarrativeWindowSummary, computeSupportDepth, uniqueSupportCollection } from "./store-utils.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeTextSignals(...groups) {
  return uniqueBy(groups.flat().filter(Boolean), (item) => item.text || item.label || JSON.stringify(item));
}

function mergeStrings(...groups) {
  return uniqueBy(groups.flat().filter(Boolean).map((value) => String(value)), (value) => value.toLowerCase());
}

export class InMemoryNarrativeStore {
  constructor() {
    this.narratives = new Map();
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
    const current = this.narratives.get(record.narrativeId);
    const existingOccurrences = this.occurrences.filter((occurrence) => occurrence.narrativeId === record.narrativeId);
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
    const chapters = buildNarrativeChapters(
      current || record.narrative,
      occurrences,
      record.identitySignals,
    );
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
      themes: mergeStrings(current?.themes || [], record.narrative.themes || []),
      supportingMemories: uniqueSupportCollection([...(current?.supportingMemories || []), ...(record.narrative.supportingMemories || [])]),
      supportingPatterns: uniqueSupportCollection([...(current?.supportingPatterns || []), ...(record.narrative.supportingPatterns || [])]),
      supportingEmotions: uniqueSupportCollection([...(current?.supportingEmotions || []), ...(record.narrative.supportingEmotions || [])]),
      supportingGoals: uniqueSupportCollection([...(current?.supportingGoals || []), ...(record.narrative.supportingGoals || [])]),
      identityShifts: mergeTextSignals(current?.identityShifts || [], record.identitySignals?.identityStatements || []),
      beliefShifts: mergeTextSignals(current?.beliefShifts || [], record.identitySignals?.beliefChanges || []),
      valueShifts: mergeTextSignals(current?.valueShifts || [], record.identitySignals?.valueShifts || []),
      emotionalMaturation: mergeTextSignals(current?.emotionalMaturation || [], record.identitySignals?.emotionalMaturation || []),
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

    this.narratives.set(record.narrativeId, updatedNarrative);
    this.occurrences.push(record.occurrence);

    const evolution = {
      id: stableHash(`${record.narrativeId}:${record.occurrence.occurredAt}:${frequency}`),
      narrativeId: record.narrativeId,
      userId: record.userId,
      occurredAt: record.occurrence.occurredAt,
      snapshot: clone(updatedNarrative),
      trend,
      createdAt: record.occurrence.occurredAt,
    };
    this.evolutions.push(evolution);

    this.events.push({
      id: stableHash(`${record.narrativeId}:${record.occurrence.sourceId}:${record.occurrence.occurredAt}`),
      userId: record.userId,
      narrativeId: record.narrativeId,
      eventType: "narrative_detected",
      payload: {
        occurrenceId: record.occurrence.id,
        sourceType: record.occurrence.sourceType,
        sourceId: record.occurrence.sourceId,
      },
      createdAt: record.occurrence.occurredAt,
    });

    return {
      narrative: updatedNarrative,
      occurrence: record.occurrence,
      trend,
    };
  }

  async listNarratives(userId, filters = {}) {
    return [...this.narratives.values()].filter((narrative) => {
      if (narrative.userId !== userId) return false;
      if (filters.family && narrative.family !== filters.family) return false;
      if (filters.status && narrative.status !== filters.status) return false;
      if (filters.theme && !(narrative.themes || []).some((theme) => theme === filters.theme)) return false;
      if (filters.sourceType && !(narrative.sourceTypes || []).includes(filters.sourceType)) return false;
      return true;
    });
  }

  async getNarrative(userId, narrativeId) {
    const narrative = this.narratives.get(narrativeId);
    if (!narrative || narrative.userId !== userId) return null;
    return narrative;
  }

  async listOccurrences(userId, narrativeId = null) {
    return this.occurrences.filter((occurrence) => {
      if (occurrence.userId !== userId) return false;
      if (narrativeId && occurrence.narrativeId !== narrativeId) return false;
      return true;
    });
  }

  async listEvolution(userId, narrativeId = null) {
    return this.evolutions.filter((evolution) => evolution.userId === userId && (!narrativeId || evolution.narrativeId === narrativeId));
  }

  async searchNarratives(userId, query) {
    const normalized = String(query || "").trim().toLowerCase();
    return [...this.narratives.values()]
      .filter((narrative) => narrative.userId === userId)
      .map((narrative) => {
        const haystack = [
          narrative.label,
          narrative.key,
          narrative.family,
          narrative.summary,
          ...(narrative.themes || []),
        ].join(" ").toLowerCase();
        const lexical = !normalized ? 0 : haystack.includes(normalized) ? 1 : 0;
        return {
          ...narrative,
          lexicalScore: lexical,
        };
      })
      .sort((a, b) => b.lexicalScore - a.lexicalScore || b.frequency - a.frequency || b.confidence - a.confidence);
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
