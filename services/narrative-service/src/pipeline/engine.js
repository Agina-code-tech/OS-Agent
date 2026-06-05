import { analyzeNarrativeInput, shouldDetectNarrative } from "../detection/analysis.js";
import { clusterSignal, createNarrativeId, createNarrativeTitle } from "../detection/clustering.js";
import { buildReport } from "../reporting/reports.js";
import {
  buildNarrativeWindowSummary,
  buildOccurrenceId,
  computeSupportDepth,
  computeSupportCounts,
  summarizeTopThemes,
  uniqueSupportCollection,
} from "../stores/store-utils.js";
import { average, stableHash, uniqueBy } from "../domain/text.js";

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function mergeStrings(...groups) {
  return uniqueBy(groups.flat().filter(Boolean).map((item) => String(item)), (item) => item.toLowerCase());
}

function buildNarrativeSummary(signal, analysis) {
  const themes = signal.themes?.length ? signal.themes.slice(0, 3).join(", ") : signal.family;
  const identitySignals = analysis.identitySignals.identityStatements.length
    ? ` Identity language points to ${analysis.identitySignals.identityStatements[0].text.toLowerCase()}.`
    : "";
  return `${signal.label} is taking shape through recurring evidence around ${themes}.${identitySignals}`;
}

function buildNarrativeRecord({ userId, analysis, signal, existingNarrative, clusterMatch }) {
  const sourceTypes = mergeStrings(ensureArray(existingNarrative?.sourceTypes), analysis.sourceType);
  const supportingMemories = uniqueSupportCollection([
    ...(existingNarrative?.supportingMemories || []),
    ...analysis.supportingMemories,
  ]);
  const supportingPatterns = uniqueSupportCollection([
    ...(existingNarrative?.supportingPatterns || []),
    ...analysis.supportingPatterns,
  ]);
  const supportingEmotions = uniqueSupportCollection([
    ...(existingNarrative?.supportingEmotions || []),
    ...analysis.supportingEmotions,
  ]);
  const supportingGoals = uniqueSupportCollection([
    ...(existingNarrative?.supportingGoals || []),
    ...analysis.supportingGoals,
  ]);

  return {
    id: existingNarrative?.id || createNarrativeId(userId, signal),
    userId,
    key: existingNarrative?.key || signal.key,
    label: existingNarrative?.label || createNarrativeTitle(signal),
    family: existingNarrative?.family || signal.family,
    kind: existingNarrative?.kind || signal.kind,
    clusterId: clusterMatch.clusterId,
    canonicalKey: clusterMatch.canonicalKey,
    summary: existingNarrative?.summary || buildNarrativeSummary(signal, analysis),
    themes: mergeStrings(existingNarrative?.themes || [], signal.themes || []),
    supportingMemories,
    supportingPatterns,
    supportingEmotions,
    supportingGoals,
    sourceTypes,
  };
}

function buildOccurrenceRecord({ userId, analysis, signal, narrativeId }) {
  return {
    id: buildOccurrenceId({
      userId,
      narrativeId,
      occurrence: {
        sourceHash: analysis.sourceHash,
        occurredAt: analysis.occurredAt,
      },
    }),
    userId,
    narrativeId,
    sourceType: analysis.sourceType,
    sourceId: analysis.sourceId,
    sourceHash: analysis.sourceHash,
    text: analysis.text,
    excerpt: signal.evidence || analysis.excerpt,
    occurredAt: analysis.occurredAt,
    intensity: signal.intensity,
    confidence: signal.confidence,
    supportingMemories: analysis.supportingMemories,
    supportingPatterns: analysis.supportingPatterns,
    supportingEmotions: analysis.supportingEmotions,
    supportingGoals: analysis.supportingGoals,
    identitySignals: analysis.identitySignals,
    themes: signal.themes || [],
    metadata: {
      ...analysis.metadata,
      family: signal.family,
      key: signal.key,
      label: signal.label,
      kind: signal.kind,
      supportPatternHits: signal.supportPatternHits,
      supportEmotionHits: signal.supportEmotionHits,
      supportGoalHits: signal.supportGoalHits,
      supportMemoryHits: signal.supportMemoryHits,
    },
  };
}

function summarizeFamilyCounts(detections) {
  return detections.reduce((acc, detection) => {
    acc[detection.narrative.family] = (acc[detection.narrative.family] || 0) + 1;
    return acc;
  }, {});
}

function summarizeStatusCounts(detections) {
  return detections.reduce((acc, detection) => {
    acc[detection.narrative.status] = (acc[detection.narrative.status] || 0) + 1;
    return acc;
  }, {});
}

function summarizeTrendCounts(detections) {
  return detections.reduce((acc, detection) => {
    acc[detection.trend.direction] = (acc[detection.trend.direction] || 0) + 1;
    return acc;
  }, {});
}

function summarizeIdentityCounts(detections) {
  return detections.reduce((acc, detection) => {
    acc.beliefChanges += detection.occurrence.identitySignals?.beliefChanges?.length || 0;
    acc.valueShifts += detection.occurrence.identitySignals?.valueShifts?.length || 0;
    acc.identityStatements += detection.occurrence.identitySignals?.identityStatements?.length || 0;
    acc.emotionalMaturation += detection.occurrence.identitySignals?.emotionalMaturation?.length || 0;
    return acc;
  }, {
    beliefChanges: 0,
    valueShifts: 0,
    identityStatements: 0,
    emotionalMaturation: 0,
  });
}

export class NarrativeIntelligenceEngine {
  constructor({ store, config = {} } = {}) {
    if (!store) {
      throw new Error("NarrativeIntelligenceEngine requires a store");
    }

    this.store = store;
    this.config = {
      maxSearchResults: Number(config.maxSearchResults || 25),
      reportLookbackMultiplier: Number(config.reportLookbackMultiplier || 2),
    };
  }

  async ensureReady() {
    await this.store.ensureSchema?.();
  }

  async ingest(input) {
    if (Array.isArray(input?.entries)) {
      const results = [];
      for (const entry of input.entries) {
        results.push(await this.ingestOne(entry));
      }
      return {
        ok: true,
        mode: "batch",
        userId: input.userId || null,
        processedCount: results.length,
        results,
      };
    }

    return this.ingestOne(input);
  }

  async ingestOne(input) {
    const analysis = analyzeNarrativeInput(input);
    if (!analysis.userId) {
      throw new Error("userId is required");
    }

    if (!analysis.text && !analysis.contextText && !analysis.signals.length) {
      return {
        ok: true,
        userId: analysis.userId,
        sourceType: analysis.sourceType,
        sourceId: analysis.sourceId,
        occurredAt: analysis.occurredAt,
        detectedCount: 0,
        narratives: [],
        summary: {
          signalCount: 0,
          narrativeCount: 0,
          familyCounts: {},
          statusCounts: {},
          trendCounts: {},
          identityCounts: {
            beliefChanges: 0,
            valueShifts: 0,
            identityStatements: 0,
            emotionalMaturation: 0,
          },
        },
      };
    }

    const knownNarratives = await this.store.listNarratives(analysis.userId, {});
    const currentNarratives = [...knownNarratives];
    const detections = [];

    for (const signal of analysis.signals) {
      if (!shouldDetectNarrative(signal)) {
        continue;
      }

      const clusterMatch = clusterSignal({ ...signal, userId: analysis.userId }, currentNarratives);
      const narrativeRecord = buildNarrativeRecord({
        userId: analysis.userId,
        analysis,
        signal,
        existingNarrative: clusterMatch.matchedNarrative,
        clusterMatch,
      });
      const narrativeId = narrativeRecord.id;
      const priorOccurrences = await this.store.listOccurrences(analysis.userId, narrativeId);
      const occurrence = buildOccurrenceRecord({
        userId: analysis.userId,
        analysis,
        signal,
        narrativeId,
      });
      const saved = await this.store.saveDetection({
        userId: analysis.userId,
        narrativeId,
        narrative: narrativeRecord,
        occurrence,
        identitySignals: analysis.identitySignals,
      });

      detections.push({
        signal,
        clusterMatched: clusterMatch.matched,
        clusterScore: clusterMatch.clusterScore,
        ...saved,
        window: buildNarrativeWindowSummary([...priorOccurrences, occurrence]),
        supportDepth: computeSupportDepth(narrativeRecord),
        supportCounts: computeSupportCounts(narrativeRecord),
      });

      const existingIndex = currentNarratives.findIndex((narrative) => narrative.id === saved.narrative.id);
      if (existingIndex >= 0) {
        currentNarratives[existingIndex] = saved.narrative;
      } else {
        currentNarratives.push(saved.narrative);
      }
    }

    const sortedDetections = detections.sort((a, b) => {
      const frequencyDelta = (b.narrative.frequency || 0) - (a.narrative.frequency || 0);
      if (frequencyDelta !== 0) return frequencyDelta;
      return (b.narrative.confidence || 0) - (a.narrative.confidence || 0);
    });

    return {
      ok: true,
      userId: analysis.userId,
      sourceType: analysis.sourceType,
      sourceId: analysis.sourceId,
      occurredAt: analysis.occurredAt,
      signalCount: analysis.signals.length,
      detectedCount: sortedDetections.length,
      narratives: sortedDetections,
      summary: {
        familyCounts: summarizeFamilyCounts(sortedDetections),
        statusCounts: summarizeStatusCounts(sortedDetections),
        trendCounts: summarizeTrendCounts(sortedDetections),
        identityCounts: summarizeIdentityCounts(sortedDetections),
        totalIntensity: Number(average(sortedDetections.map((detection) => detection.occurrence.intensity)).toFixed(4)),
        totalConfidence: Number(average(sortedDetections.map((detection) => detection.occurrence.confidence)).toFixed(4)),
      },
      input: {
        sourceHash: analysis.sourceHash,
        excerpt: analysis.excerpt,
        metadata: analysis.metadata,
      },
    };
  }

  async listNarratives(userId, filters = {}) {
    if (!userId) throw new Error("userId is required");
    return this.store.listNarratives(String(userId), filters);
  }

  async getNarrative(userId, narrativeId) {
    if (!userId) throw new Error("userId is required");
    if (!narrativeId) throw new Error("narrativeId is required");
    return this.store.getNarrative(String(userId), String(narrativeId));
  }

  async getOccurrences(userId, narrativeId = null) {
    if (!userId) throw new Error("userId is required");
    return this.store.listOccurrences(String(userId), narrativeId ? String(narrativeId) : null);
  }

  async getEvolution(userId, narrativeId = null) {
    if (!userId) throw new Error("userId is required");
    return this.store.listEvolution(String(userId), narrativeId ? String(narrativeId) : null);
  }

  async search(userId, query) {
    if (!userId) throw new Error("userId is required");
    const narratives = await this.store.searchNarratives(String(userId), String(query || ""));
    return {
      ok: true,
      userId: String(userId),
      query: String(query || ""),
      total: narratives.length,
      results: narratives.slice(0, this.config.maxSearchResults).map((narrative) => ({
        ...narrative,
        searchScore: clamp((narrative.lexicalScore || narrative.lexicalRank || 0) + Math.log10((narrative.frequency || 0) + 1) * 0.15),
      })),
    };
  }

  async buildReport(userId, period = "monthly") {
    if (!userId) throw new Error("userId is required");
    const windowDays = period === "monthly" ? 30 : period === "quarterly" ? 90 : period === "annual" ? 365 : null;
    if (!windowDays) {
      throw new Error(`Unsupported report period: ${period}`);
    }

    const now = new Date();
    const lookbackDays = windowDays * this.config.reportLookbackMultiplier;
    const startIso = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
    const narratives = await this.store.listNarratives(String(userId), {});
    const occurrences = await this.store.getOccurrencesByRange(String(userId), startIso, now.toISOString());

    return buildReport({
      userId: String(userId),
      period,
      narratives,
      occurrences,
      now,
    });
  }

  async buildIdentitySummary(userId) {
    const report = await this.buildReport(userId, "annual");
    return {
      ok: true,
      userId: String(userId),
      generatedAt: report.generatedAt,
      whoThisPersonIsBecoming: report.identityEvolution.becomingSummary,
      majorThemes: report.majorThemes,
      identityEvolution: report.identityEvolution,
      activeNarratives: report.activeNarratives,
    };
  }

  async health() {
    return this.store.healthCheck?.() || { ok: true };
  }
}
