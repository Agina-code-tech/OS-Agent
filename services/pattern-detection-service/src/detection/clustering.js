import { DEFAULT_THRESHOLD } from "../domain/constants.js";
import { jaccardSimilarity, stableHash, truncate } from "../domain/text.js";

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

export function canonicalizePatternKey(signal) {
  return `${signal.family}.${signal.label.replace(/\s+/g, "_").toLowerCase()}`;
}

export function createPatternId(userId, signal) {
  return `pattern_${stableHash(`${userId}:${canonicalizePatternKey(signal)}`).slice(0, 20)}`;
}

function similarityScore(a, b) {
  return clamp(
    0.7 * jaccardSimilarity(a.label, b.label) +
      0.2 * jaccardSimilarity(a.key, b.key) +
      0.1 * jaccardSimilarity(a.evidence || "", b.evidence || ""),
  );
}

export function clusterSignal(signal, existingPatterns = []) {
  const sameFamily = existingPatterns.filter((pattern) => pattern.family === signal.family);
  let best = null;
  let bestScore = 0;

  for (const pattern of sameFamily) {
    const score = similarityScore(signal, pattern);
    if (score > bestScore) {
      best = pattern;
      bestScore = score;
    }
  }

  if (best && bestScore >= DEFAULT_THRESHOLD.semanticMatch) {
    return {
      matched: true,
      clusterId: best.clusterId || best.id,
      clusterScore: bestScore,
      matchedPattern: best,
      canonicalKey: best.canonicalKey,
    };
  }

  return {
    matched: false,
    clusterId: createPatternId(signal.userId || signal.sourceId || signal.sourceType || "cluster", signal),
    clusterScore: bestScore,
    matchedPattern: null,
    canonicalKey: canonicalizePatternKey(signal),
  };
}

export function createPatternTitle(signal) {
  return truncate(signal.label, 120);
}
