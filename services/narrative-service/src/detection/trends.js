import { REPORT_WINDOWS, TREND_DIRECTIONS } from "../domain/constants.js";
import { average, linearTrend } from "../domain/text.js";

function countsInWindow(occurrences = [], startMs, endMs) {
  return occurrences.filter((occurrence) => {
    const time = new Date(occurrence.occurredAt).getTime();
    return time >= startMs && time < endMs;
  });
}

function classifyTrend({ recentCount, previousCount, recentIntensity, previousIntensity, lastOccurrenceAt, nowMs, windowDays, frequency }) {
  const ageDays = lastOccurrenceAt ? (nowMs - new Date(lastOccurrenceAt).getTime()) / (1000 * 60 * 60 * 24) : Infinity;

  if (recentCount === 0 && previousCount > 0 && ageDays > windowDays) {
    return { direction: "completed", score: -1.2 };
  }

  if (previousCount === 0 && recentCount > 0) {
    return { direction: "emerging", score: 1 };
  }

  const countDelta = recentCount - previousCount;
  const intensityDelta = recentIntensity - previousIntensity;
  const score = countDelta + intensityDelta + Math.min(0.4, frequency * 0.03);

  if (score >= 0.8) return { direction: "growing", score };
  if (score <= -0.8) return { direction: "declining", score };
  if (recentCount === 0) return { direction: "declining", score };
  if (ageDays > windowDays * 2 && recentCount > 0) return { direction: "stable", score };
  return { direction: "stable", score };
}

export function calculateTrend(narrative, occurrences = [], now = new Date(), windowDays = 90) {
  const nowMs = now.getTime();
  const currentStart = nowMs - windowDays * 24 * 60 * 60 * 1000;
  const previousStart = nowMs - windowDays * 2 * 24 * 60 * 60 * 1000;
  const currentOccurrences = countsInWindow(occurrences, currentStart, nowMs + 1);
  const previousOccurrences = countsInWindow(occurrences, previousStart, currentStart);
  const recentIntensity = average(currentOccurrences.map((occurrence) => occurrence.intensity));
  const previousIntensity = average(previousOccurrences.map((occurrence) => occurrence.intensity));
  const trend = classifyTrend({
    recentCount: currentOccurrences.length,
    previousCount: previousOccurrences.length,
    recentIntensity,
    previousIntensity,
    lastOccurrenceAt: narrative.lastOccurrenceAt,
    nowMs,
    windowDays,
    frequency: occurrences.length,
  });

  return {
    direction: trend.direction,
    score: Number(trend.score.toFixed(4)),
    recentCount: currentOccurrences.length,
    previousCount: previousOccurrences.length,
    recentIntensity: Number(recentIntensity.toFixed(4)),
    previousIntensity: Number(previousIntensity.toFixed(4)),
    slope: Number(linearTrend([previousOccurrences.length, currentOccurrences.length]).toFixed(4)),
    windowDays,
  };
}

export function getNarrativeState(narrative, trend, occurrences = []) {
  if (trend.direction === "completed") {
    return {
      status: "completed",
      completedAt: narrative.lastOccurrenceAt,
    };
  }

  if (trend.direction === "emerging" || trend.direction === "growing") {
    return {
      status: "active",
      completedAt: null,
    };
  }

  const ageDays = narrative.lastOccurrenceAt
    ? (Date.now() - new Date(narrative.lastOccurrenceAt).getTime()) / (1000 * 60 * 60 * 24)
    : Infinity;

  return {
    status: ageDays > REPORT_WINDOWS.quarterly ? "completed" : "active",
    completedAt: ageDays > REPORT_WINDOWS.quarterly ? narrative.lastOccurrenceAt : null,
  };
}

export function summarizeTrendDirection(trend) {
  return TREND_DIRECTIONS.includes(trend.direction) ? trend.direction : "stable";
}
