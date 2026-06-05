import { REPORT_WINDOWS } from "../domain/constants.js";
import { average } from "../domain/text.js";
import { calculateTrend, summarizeTrendDirection } from "../detection/trends.js";
import { summarizeTopThemes } from "../stores/store-utils.js";

function inWindow(occurredAt, startMs, endMs) {
  const time = new Date(occurredAt).getTime();
  return time >= startMs && time < endMs;
}

function buildNarrativeStats(narrative, occurrences, windowDays, now) {
  const nowMs = now.getTime();
  const startMs = nowMs - windowDays * 24 * 60 * 60 * 1000;
  const windowOccurrences = occurrences.filter((occurrence) => inWindow(occurrence.occurredAt, startMs, nowMs + 1));
  const trend = calculateTrend(narrative, occurrences, now, windowDays);
  return {
    id: narrative.id,
    key: narrative.key,
    label: narrative.label,
    family: narrative.family,
    frequency: narrative.frequency,
    intensity: Number(average(windowOccurrences.map((occurrence) => occurrence.intensity)).toFixed(4)) || narrative.intensity,
    confidence: Number(average(windowOccurrences.map((occurrence) => occurrence.confidence)).toFixed(4)) || narrative.confidence,
    startDate: narrative.startDate,
    firstOccurrenceAt: narrative.firstOccurrenceAt,
    lastOccurrenceAt: narrative.lastOccurrenceAt,
    trendDirection: summarizeTrendDirection(trend),
    trendScore: trend.score,
    currentChapterNumber: narrative.currentChapterNumber,
    currentChapterTitle: narrative.currentChapterTitle,
    status: narrative.status,
    themes: narrative.themes || [],
    summary: narrative.summary,
    chapters: narrative.chapters || [],
  };
}

function classifyNarratives(narratives, occurrences, now, windowDays) {
  const buckets = {
    emerging: [],
    growing: [],
    declining: [],
    completed: [],
    stable: [],
  };

  for (const narrative of narratives) {
    const stats = buildNarrativeStats(
      narrative,
      occurrences.filter((occurrence) => occurrence.narrativeId === narrative.id),
      windowDays,
      now,
    );
    buckets[stats.trendDirection]?.push(stats);
  }

  return buckets;
}

function topNarrativeLabels(narratives = []) {
  return narratives
    .slice(0, 5)
    .map((narrative) => narrative.label)
    .filter(Boolean);
}

function composeBecomingSummary(narratives = [], themeRanking = []) {
  const labels = topNarrativeLabels(narratives);
  const topThemes = themeRanking.slice(0, 4).map((item) => item.label);

  if (!labels.length && !topThemes.length) {
    return "The identity picture is still forming and there is not enough evidence yet to summarize a stable direction.";
  }

  const phrases = [];
  if (labels.includes("Recovering From Burnout")) {
    phrases.push("more protective of energy and recovery");
  }
  if (labels.includes("Learning Emotional Boundaries")) {
    phrases.push("more boundaried and selective with access");
  }
  if (labels.includes("Transitioning Into Leadership") || labels.includes("Reclaiming Agency")) {
    phrases.push("more self-directed and willing to decide");
  }
  if (labels.includes("Trusting Intuition")) {
    phrases.push("more willing to trust inner signals");
  }
  if (labels.includes("Creative Self-Expression")) {
    phrases.push("more visible and creatively expressive");
  }
  if (labels.includes("Building Self-Trust")) {
    phrases.push("more reliable with self-promises");
  }
  if (labels.includes("Repairing Relationships")) {
    phrases.push("more honest and repair-oriented in relationships");
  }
  if (labels.includes("Moving From Survival To Stability")) {
    phrases.push("more focused on stability and rhythm");
  }
  if (labels.includes("Integrating Grief And Loss")) {
    phrases.push("more able to metabolize grief and loss");
  }

  if (!phrases.length) {
    phrases.push(...topThemes.slice(0, 3).map((theme) => `more oriented toward ${theme}`));
  }

  return `This person is becoming ${phrases.join(", ")}.`;
}

function aggregateIdentityShifts(narratives = [], currentOccurrences = []) {
  const beliefChanges = [];
  const valueShifts = [];
  const identityStatements = [];
  const emotionalMaturation = [];

  for (const narrative of narratives) {
    for (const shift of narrative.beliefShifts || []) beliefChanges.push(shift);
    for (const shift of narrative.valueShifts || []) valueShifts.push(shift);
    for (const shift of narrative.identityShifts || []) identityStatements.push(shift);
    for (const shift of narrative.emotionalMaturation || []) emotionalMaturation.push(shift);
  }

  const recentBeliefChanges = currentOccurrences.flatMap((occurrence) => (occurrence.identitySignals?.beliefChanges || []));
  const recentValueShifts = currentOccurrences.flatMap((occurrence) => (occurrence.identitySignals?.valueShifts || []));
  const recentIdentityStatements = currentOccurrences.flatMap((occurrence) => (occurrence.identitySignals?.identityStatements || []));
  const recentMaturation = currentOccurrences.flatMap((occurrence) => (occurrence.identitySignals?.emotionalMaturation || []));

  return {
    beliefChanges: [...beliefChanges, ...recentBeliefChanges],
    valueShifts: [...valueShifts, ...recentValueShifts],
    identityStatements: [...identityStatements, ...recentIdentityStatements],
    emotionalMaturation: [...emotionalMaturation, ...recentMaturation],
  };
}

export function buildReport({ userId, period, narratives, occurrences, now = new Date() }) {
  const windowDays = REPORT_WINDOWS[period];
  if (!windowDays) {
    throw new Error(`Unsupported report period: ${period}`);
  }

  const nowMs = now.getTime();
  const windowStart = new Date(nowMs - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const previousStart = new Date(nowMs - windowDays * 2 * 24 * 60 * 60 * 1000).toISOString();
  const currentOccurrences = occurrences.filter((occurrence) => inWindow(occurrence.occurredAt, new Date(windowStart).getTime(), nowMs + 1));
  const previousOccurrences = occurrences.filter((occurrence) => inWindow(occurrence.occurredAt, new Date(previousStart).getTime(), new Date(windowStart).getTime()));
  const classifications = classifyNarratives(narratives, occurrences, now, windowDays);
  const activeNarratives = narratives
    .map((narrative) => buildNarrativeStats(
      narrative,
      occurrences.filter((occurrence) => occurrence.narrativeId === narrative.id),
      windowDays,
      now,
    ))
    .sort((a, b) => b.frequency - a.frequency || b.confidence - a.confidence)
    .slice(0, 20);

  const familyCounts = narratives.reduce((acc, narrative) => {
    acc[narrative.family] = (acc[narrative.family] || 0) + 1;
    return acc;
  }, {});

  const statusCounts = narratives.reduce((acc, narrative) => {
    acc[narrative.status] = (acc[narrative.status] || 0) + 1;
    return acc;
  }, {});

  const chapterCounts = activeNarratives.reduce((acc, narrative) => {
    const chapter = narrative.currentChapterTitle || "Recognizing the Pattern";
    acc[chapter] = (acc[chapter] || 0) + 1;
    return acc;
  }, {});

  const themeRanking = summarizeTopThemes(narratives);
  const identityEvolution = aggregateIdentityShifts(narratives, currentOccurrences);
  const becomingSummary = composeBecomingSummary(activeNarratives, themeRanking);
  const themeCounts = currentOccurrences.reduce((acc, occurrence) => {
    for (const theme of occurrence.themes || []) {
      acc[theme] = (acc[theme] || 0) + 1;
    }
    return acc;
  }, {});

  return {
    ok: true,
    userId,
    period,
    windowDays,
    generatedAt: now.toISOString(),
    summary: {
      totalNarratives: narratives.length,
      totalOccurrences: currentOccurrences.length,
      families: familyCounts,
      statusCounts,
      chapterCounts,
      themeCounts,
    },
    emerging: classifications.emerging.slice(0, 10),
    growing: classifications.growing.slice(0, 10),
    declining: classifications.declining.slice(0, 10),
    completed: classifications.completed.slice(0, 10),
    stable: classifications.stable.slice(0, 10),
    activeNarratives,
    majorThemes: themeRanking,
    identityEvolution: {
      beliefChanges: identityEvolution.beliefChanges.slice(0, 10),
      valueShifts: identityEvolution.valueShifts.slice(0, 10),
      identityStatements: identityEvolution.identityStatements.slice(0, 10),
      emotionalMaturation: identityEvolution.emotionalMaturation.slice(0, 10),
      becomingSummary,
    },
    comparison: {
      currentWindowOccurrences: currentOccurrences.length,
      previousWindowOccurrences: previousOccurrences.length,
      currentWindowNarrativeCount: activeNarratives.filter((narrative) => narrative.frequency > 0).length,
    },
  };
}
