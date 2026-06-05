import { REPORT_WINDOWS, TREND_DIRECTIONS } from "../domain/constants.js";
import { average, linearTrend } from "../domain/text.js";

function countsInWindow(occurrences = [], startMs, endMs) {
  return occurrences.filter((occurrence) => {
    const time = new Date(occurrence.occurredAt).getTime();
    return time >= startMs && time < endMs;
  });
}

function classifyTrend({ recentCount, previousCount, recentIntensity, previousIntensity, lastOccurrenceAt, nowMs, windowDays }) {
  const ageDays = lastOccurrenceAt ? (nowMs - new Date(lastOccurrenceAt).getTime()) / (1000 * 60 * 60 * 24) : Infinity;

  if (recentCount === 0 && previousCount > 0 && ageDays > windowDays) {
    return { direction: "resolved", score: -1 };
  }

  if (previousCount === 0 && recentCount > 0) {
    return { direction: "emerging", score: 1 };
  }

  const countDelta = recentCount - previousCount;
  const intensityDelta = recentIntensity - previousIntensity;
  const trendScore = countDelta + intensityDelta;

  if (trendScore >= 1.2) return { direction: "strengthening", score: trendScore };
  if (trendScore <= -1.2) return { direction: "weakening", score: trendScore };
  if (recentCount === 0) return { direction: "resolved", score: trendScore };
  return { direction: "stable", score: trendScore };
}

export function calculateTrend(pattern, occurrences = [], now = new Date(), windowDays = 30) {
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
    lastOccurrenceAt: pattern.lastOccurrenceAt,
    nowMs,
    windowDays,
  });

  const series = [
    previousOccurrences.length,
    currentOccurrences.length,
  ];

  return {
    direction: trend.direction,
    score: Number(trend.score.toFixed(4)),
    recentCount: currentOccurrences.length,
    previousCount: previousOccurrences.length,
    recentIntensity: Number(recentIntensity.toFixed(4)),
    previousIntensity: Number(previousIntensity.toFixed(4)),
    slope: Number(linearTrend(series).toFixed(4)),
    windowDays,
  };
}

export function getResolvedState(pattern, trend, occurrences = []) {
  if (trend.direction === "resolved") {
    return {
      status: "resolved",
      resolvedAt: pattern.lastOccurrenceAt,
    };
  }

  if (trend.direction === "emerging" || trend.direction === "strengthening") {
    return {
      status: "active",
      resolvedAt: null,
    };
  }

  const ageDays = pattern.lastOccurrenceAt
    ? (Date.now() - new Date(pattern.lastOccurrenceAt).getTime()) / (1000 * 60 * 60 * 24)
    : Infinity;

  return {
    status: ageDays > REPORT_WINDOWS.quarterly ? "resolved" : "active",
    resolvedAt: ageDays > REPORT_WINDOWS.quarterly ? pattern.lastOccurrenceAt : null,
  };
}

export function summarizeTrendDirection(trend) {
  return TREND_DIRECTIONS.includes(trend.direction) ? trend.direction : "stable";
}

