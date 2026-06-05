import { REPORT_WINDOWS } from "../domain/constants.js";
import { average } from "../domain/text.js";
import { calculateTrend, summarizeTrendDirection } from "../detection/trends.js";

function inWindow(occurredAt, startMs, endMs) {
  const time = new Date(occurredAt).getTime();
  return time >= startMs && time < endMs;
}

function buildPatternStats(pattern, occurrences, windowDays, now) {
  const nowMs = now.getTime();
  const startMs = nowMs - windowDays * 24 * 60 * 60 * 1000;
  const windowOccurrences = occurrences.filter((occurrence) => inWindow(occurrence.occurredAt, startMs, nowMs + 1));
  const triggers = new Map();

  for (const occurrence of windowOccurrences) {
    for (const trigger of occurrence.triggerSignals || []) {
      triggers.set(trigger.label, (triggers.get(trigger.label) || 0) + trigger.count);
    }
  }

  const topTriggers = [...triggers.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const trend = calculateTrend(pattern, occurrences, now, windowDays);

  return {
    id: pattern.id,
    key: pattern.key,
    label: pattern.label,
    family: pattern.family,
    frequency: pattern.frequency,
    intensity: Number(average(windowOccurrences.map((occurrence) => occurrence.intensity)).toFixed(4)),
    confidence: Number(average(windowOccurrences.map((occurrence) => occurrence.confidence)).toFixed(4)) || pattern.confidence,
    firstOccurrenceAt: pattern.firstOccurrenceAt,
    lastOccurrenceAt: pattern.lastOccurrenceAt,
    trendDirection: summarizeTrendDirection(trend),
    trendScore: trend.score,
    reinforcementCount: pattern.reinforcementCount || 0,
    topTriggers,
    sourceTypes: pattern.sourceTypes || [],
    status: pattern.status,
  };
}

function classifyPatterns(patterns, occurrences, now, windowDays) {
  const buckets = {
    emerging: [],
    strengthening: [],
    weakening: [],
    resolved: [],
    stable: [],
  };

  for (const pattern of patterns) {
    const stats = buildPatternStats(pattern, occurrences.filter((occurrence) => occurrence.patternId === pattern.id), windowDays, now);
    buckets[stats.trendDirection]?.push(stats);
  }

  return buckets;
}

export function buildReport({ userId, period, patterns, occurrences, now = new Date() }) {
  const windowDays = REPORT_WINDOWS[period];
  if (!windowDays) {
    throw new Error(`Unsupported report period: ${period}`);
  }

  const nowMs = now.getTime();
  const windowStart = new Date(nowMs - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const previousStart = new Date(nowMs - windowDays * 2 * 24 * 60 * 60 * 1000).toISOString();
  const currentOccurrences = occurrences.filter((occurrence) => inWindow(occurrence.occurredAt, new Date(windowStart).getTime(), nowMs + 1));
  const previousOccurrences = occurrences.filter((occurrence) => inWindow(occurrence.occurredAt, new Date(previousStart).getTime(), new Date(windowStart).getTime()));
  const classifications = classifyPatterns(patterns, occurrences, now, windowDays);
  const activePatterns = patterns
    .map((pattern) => buildPatternStats(pattern, occurrences.filter((occurrence) => occurrence.patternId === pattern.id), windowDays, now))
    .sort((a, b) => b.frequency - a.frequency || b.intensity - a.intensity)
    .slice(0, 20);

  const familyCounts = patterns.reduce((acc, pattern) => {
    acc[pattern.family] = (acc[pattern.family] || 0) + 1;
    return acc;
  }, {});

  const sourceCounts = currentOccurrences.reduce((acc, occurrence) => {
    acc[occurrence.sourceType] = (acc[occurrence.sourceType] || 0) + 1;
    return acc;
  }, {});

  const triggerCounts = currentOccurrences.reduce((acc, occurrence) => {
    for (const trigger of occurrence.triggerSignals || []) {
      acc[trigger.label] = (acc[trigger.label] || 0) + trigger.count;
    }
    return acc;
  }, {});

  const reinforcementLoops = activePatterns
    .filter((pattern) => pattern.reinforcementCount > 0 || (pattern.topTriggers || []).some((trigger) => trigger.count >= 3))
    .map((pattern) => ({
      patternId: pattern.id,
      label: pattern.label,
      loops: (pattern.topTriggers || []).filter((trigger) => trigger.count >= 3),
      reinforcementCount: pattern.reinforcementCount,
    }));

  return {
    ok: true,
    userId,
    period,
    windowDays,
    generatedAt: now.toISOString(),
    summary: {
      totalPatterns: patterns.length,
      totalOccurrences: currentOccurrences.length,
      families: familyCounts,
      sourceCounts,
    },
    emerging: classifications.emerging.slice(0, 10),
    strengthening: classifications.strengthening.slice(0, 10),
    weakening: classifications.weakening.slice(0, 10),
    resolved: classifications.resolved.slice(0, 10),
    activePatterns,
    triggerRanking: Object.entries(triggerCounts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    reinforcementLoops,
    comparison: {
      currentWindowOccurrences: currentOccurrences.length,
      previousWindowOccurrences: previousOccurrences.length,
      currentWindowPatternCount: activePatterns.filter((pattern) => pattern.frequency > 0).length,
    },
  };
}
