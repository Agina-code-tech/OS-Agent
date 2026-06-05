import { analyzePatternInput, shouldDetectSignal } from "../detection/analysis.js";
import { clusterSignal, createPatternId, createPatternTitle } from "../detection/clustering.js";
import { buildReport } from "../reporting/reports.js";
import {
  buildOccurrenceId,
  computeReinforcementCount,
  computeTriggerCounts,
  summarizeTopTriggers,
  buildPatternWindowSummary,
} from "../stores/store-utils.js";
import { average, stableHash, uniqueBy } from "../domain/text.js";

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function mergeUniqueStrings(...groups) {
  return uniqueBy(groups.flat().filter(Boolean).map((item) => String(item)), (item) => item.toLowerCase());
}

function buildPatternRecord({ userId, analysis, signal, existingPattern, clusterMatch }) {
  const sourceDomains = mergeUniqueStrings(
    ensureArray(existingPattern?.domains),
    ensureArray(analysis.metadata?.domains),
    analysis.metadata?.domain,
    analysis.metadata?.lifeDomain,
    analysis.sourceType,
  );
  const sourceTypes = mergeUniqueStrings(
    ensureArray(existingPattern?.sourceTypes),
    analysis.sourceType,
  );

  return {
    id: existingPattern?.id || createPatternId(userId, signal),
    userId,
    key: existingPattern?.key || signal.key,
    label: existingPattern?.label || createPatternTitle(signal),
    family: existingPattern?.family || signal.family,
    kind: existingPattern?.kind || signal.kind,
    clusterId: clusterMatch.clusterId,
    canonicalKey: clusterMatch.canonicalKey,
    sourceTypes,
    domains: sourceDomains,
  };
}

function buildOccurrenceRecord({ userId, analysis, signal, patternId }) {
  const triggerCounts = computeTriggerCounts(analysis.triggerSignals);
  const topTriggers = summarizeTopTriggers(triggerCounts);
  const domains = mergeUniqueStrings(
    ensureArray(analysis.metadata?.domains),
    analysis.metadata?.domain,
    analysis.metadata?.lifeDomain,
    analysis.sourceType,
  );

  return {
    id: buildOccurrenceId({
      userId,
      patternId,
      occurrence: {
        sourceHash: analysis.sourceHash,
        occurredAt: analysis.occurredAt,
      },
    }),
    userId,
    patternId,
    sourceType: analysis.sourceType,
    sourceId: analysis.sourceId,
    sourceHash: analysis.sourceHash,
    text: analysis.text,
    excerpt: signal.evidence || analysis.excerpt,
    occurredAt: analysis.occurredAt,
    intensity: signal.intensity,
    confidence: signal.confidence,
    keywordHits: signal.keywordHits,
    triggerSignals: analysis.triggerSignals,
    domains,
    metadata: {
      ...analysis.metadata,
      family: signal.family,
      key: signal.key,
      label: signal.label,
      kind: signal.kind,
      triggerCounts,
      topTriggers,
    },
    triggerCounts,
    topTriggers,
  };
}

function summarizeFamilyCounts(detections) {
  return detections.reduce((acc, detection) => {
    acc[detection.pattern.family] = (acc[detection.pattern.family] || 0) + 1;
    return acc;
  }, {});
}

function summarizeSourceCounts(detections) {
  return detections.reduce((acc, detection) => {
    acc[detection.occurrence.sourceType] = (acc[detection.occurrence.sourceType] || 0) + 1;
    return acc;
  }, {});
}

function summarizeTrendCounts(detections) {
  return detections.reduce((acc, detection) => {
    acc[detection.trend.direction] = (acc[detection.trend.direction] || 0) + 1;
    return acc;
  }, {});
}

export class PatternDetectionEngine {
  constructor({ store, config = {} } = {}) {
    if (!store) {
      throw new Error("PatternDetectionEngine requires a store");
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
    const analysis = analyzePatternInput(input);
    if (!analysis.userId) {
      throw new Error("userId is required");
    }

    if (!analysis.text || !analysis.signals.length) {
      return {
        ok: true,
        userId: analysis.userId,
        sourceType: analysis.sourceType,
        sourceId: analysis.sourceId,
        occurredAt: analysis.occurredAt,
        detectedCount: 0,
        detections: [],
        summary: {
          signalCount: 0,
          patternCount: 0,
          familyCounts: {},
          sourceCounts: {},
          trendCounts: {},
        },
      };
    }

    const knownPatterns = await this.store.listPatterns(analysis.userId, {});
    const currentPatterns = [...knownPatterns];
    const detections = [];

    for (const signal of analysis.signals) {
      if (!shouldDetectSignal(signal)) {
        continue;
      }

      const clusterMatch = clusterSignal({ ...signal, userId: analysis.userId }, currentPatterns);
      const patternRecord = buildPatternRecord({
        userId: analysis.userId,
        analysis,
        signal,
        existingPattern: clusterMatch.matchedPattern,
        clusterMatch,
      });
      const patternId = patternRecord.id;
      const priorOccurrences = await this.store.listOccurrences(analysis.userId, patternId);
      const occurrence = buildOccurrenceRecord({
        userId: analysis.userId,
        analysis,
        signal,
        patternId,
      });
      const reinforcementCount = computeReinforcementCount([...priorOccurrences, occurrence]);
      const triggerCounts = occurrence.triggerCounts;
      const topTriggers = occurrence.topTriggers;
      const saved = await this.store.saveDetection({
        userId: analysis.userId,
        patternId,
        pattern: patternRecord,
        occurrence,
        triggerCounts,
        topTriggers,
        reinforcementCount,
      });

      detections.push({
        signal,
        clusterMatched: clusterMatch.matched,
        clusterScore: clusterMatch.clusterScore,
        ...saved,
        patternWindow: buildPatternWindowSummary([...priorOccurrences, occurrence]),
      });

      const existingIndex = currentPatterns.findIndex((pattern) => pattern.id === saved.pattern.id);
      if (existingIndex >= 0) {
        currentPatterns[existingIndex] = saved.pattern;
      } else {
        currentPatterns.push(saved.pattern);
      }
    }

    const sortedDetections = detections.sort((a, b) => {
      const frequencyDelta = (b.pattern.frequency || 0) - (a.pattern.frequency || 0);
      if (frequencyDelta !== 0) return frequencyDelta;
      return (b.pattern.intensity || 0) - (a.pattern.intensity || 0);
    });

    return {
      ok: true,
      userId: analysis.userId,
      sourceType: analysis.sourceType,
      sourceId: analysis.sourceId,
      occurredAt: analysis.occurredAt,
      signalCount: analysis.signals.length,
      detectedCount: sortedDetections.length,
      detections: sortedDetections,
      summary: {
        familyCounts: summarizeFamilyCounts(sortedDetections),
        sourceCounts: summarizeSourceCounts(sortedDetections),
        trendCounts: summarizeTrendCounts(sortedDetections),
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

  async listPatterns(userId, filters = {}) {
    if (!userId) throw new Error("userId is required");
    return this.store.listPatterns(String(userId), filters);
  }

  async getPattern(userId, patternId) {
    if (!userId) throw new Error("userId is required");
    if (!patternId) throw new Error("patternId is required");
    return this.store.getPattern(String(userId), String(patternId));
  }

  async getOccurrences(userId, patternId = null) {
    if (!userId) throw new Error("userId is required");
    return this.store.listOccurrences(String(userId), patternId ? String(patternId) : null);
  }

  async getEvolution(userId, patternId = null) {
    if (!userId) throw new Error("userId is required");
    return this.store.listEvolution(String(userId), patternId ? String(patternId) : null);
  }

  async search(userId, query) {
    if (!userId) throw new Error("userId is required");
    const patterns = await this.store.searchPatterns(String(userId), String(query || ""));
    return {
      ok: true,
      userId: String(userId),
      query: String(query || ""),
      total: patterns.length,
      results: patterns.slice(0, this.config.maxSearchResults).map((pattern) => ({
        ...pattern,
        searchScore: clamp((pattern.lexicalScore || pattern.lexicalRank || 0) + Math.log10((pattern.frequency || 0) + 1) * 0.15),
      })),
    };
  }

  async buildReport(userId, period = "weekly") {
    if (!userId) throw new Error("userId is required");
    const windowDays = period === "weekly" ? 7 : period === "monthly" ? 30 : period === "quarterly" ? 90 : null;
    if (!windowDays) {
      throw new Error(`Unsupported report period: ${period}`);
    }

    const now = new Date();
    const lookbackDays = windowDays * this.config.reportLookbackMultiplier;
    const startIso = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
    const patterns = await this.store.listPatterns(String(userId), {});
    const occurrences = await this.store.getOccurrencesByRange(String(userId), startIso, now.toISOString());

    return buildReport({
      userId: String(userId),
      period,
      patterns,
      occurrences,
      now,
    });
  }

  async health() {
    return this.store.healthCheck?.() || { ok: true };
  }
}
