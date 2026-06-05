import { DEFAULT_THRESHOLD } from "../domain/constants.js";
import { jaccardSimilarity, stableHash, truncate } from "../domain/text.js";

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

export function canonicalizeNarrativeKey(signal) {
  return signal.key;
}

export function createNarrativeId(userId, signal) {
  return `narrative_${stableHash(`${userId}:${canonicalizeNarrativeKey(signal)}`).slice(0, 20)}`;
}

function overlapScore(a = [], b = []) {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a.map((item) => String(item).toLowerCase()));
  const setB = new Set(b.map((item) => String(item).toLowerCase()));
  let hits = 0;
  for (const value of setA) {
    if (setB.has(value)) hits += 1;
  }
  return clamp(hits / Math.max(setA.size, setB.size));
}

function similarityScore(signal, narrative) {
  const labelSimilarity = jaccardSimilarity(signal.label, narrative.label);
  const themeSimilarity = overlapScore(signal.themes || [], narrative.themes || []);
  const supportSimilarity = overlapScore(signal.supportPatternHits || [], narrative.supportingPatterns || []);
  const emotionSimilarity = overlapScore(signal.supportEmotionHits || [], narrative.supportingEmotions || []);
  const goalSimilarity = overlapScore(signal.supportGoalHits || [], narrative.supportingGoals || []);
  const descriptionSimilarity = jaccardSimilarity(signal.evidence || "", narrative.summary || narrative.label || "");

  return clamp(
    labelSimilarity * 0.28 +
      themeSimilarity * 0.2 +
      supportSimilarity * 0.18 +
      emotionSimilarity * 0.1 +
      goalSimilarity * 0.1 +
      descriptionSimilarity * 0.14,
  );
}

export function clusterSignal(signal, existingNarratives = []) {
  const sameFamily = existingNarratives.filter((narrative) => narrative.family === signal.family);
  let best = null;
  let bestScore = 0;

  for (const narrative of sameFamily) {
    const score = similarityScore(signal, narrative);
    if (score > bestScore) {
      best = narrative;
      bestScore = score;
    }
  }

  if (best && bestScore >= DEFAULT_THRESHOLD.semanticMatch) {
    return {
      matched: true,
      clusterId: best.clusterId || best.id,
      clusterScore: bestScore,
      matchedNarrative: best,
      canonicalKey: best.canonicalKey,
    };
  }

  return {
    matched: false,
    clusterId: createNarrativeId(signal.userId || signal.sourceId || signal.sourceType || "cluster", signal),
    clusterScore: bestScore,
    matchedNarrative: null,
    canonicalKey: canonicalizeNarrativeKey(signal),
  };
}

export function createNarrativeTitle(signal) {
  return truncate(signal.label, 120);
}
