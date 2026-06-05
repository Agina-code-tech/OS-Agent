import { average, stableHash, uniqueBy } from "../domain/text.js";

function normalizeLength(value) {
  return Array.isArray(value) ? value.length : 0;
}

export function computeSupportCounts(record = {}) {
  return {
    memories: normalizeLength(record.supportingMemories),
    patterns: normalizeLength(record.supportingPatterns),
    emotions: normalizeLength(record.supportingEmotions),
    goals: normalizeLength(record.supportingGoals),
  };
}

export function computeSupportDepth(record = {}) {
  const counts = computeSupportCounts(record);
  return counts.memories + counts.patterns + counts.emotions + counts.goals;
}

export function buildOccurrenceId(record) {
  return stableHash(`${record.userId}:${record.narrativeId}:${record.occurrence.sourceHash}:${record.occurrence.occurredAt}`);
}

export function buildNarrativeWindowSummary(occurrences = []) {
  return {
    count: occurrences.length,
    averageIntensity: Number(average(occurrences.map((occurrence) => occurrence.intensity)).toFixed(4)),
    averageConfidence: Number(average(occurrences.map((occurrence) => occurrence.confidence)).toFixed(4)),
  };
}

export function uniqueSupportCollection(items = []) {
  return uniqueBy(items.filter(Boolean), (item) => item.id || item.label || item.summary || JSON.stringify(item));
}

export function summarizeTopThemes(narratives = []) {
  const themeCounts = narratives.reduce((acc, narrative) => {
    for (const theme of narrative.themes || []) {
      acc[theme] = (acc[theme] || 0) + 1;
    }
    return acc;
  }, {});

  return Object.entries(themeCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}
