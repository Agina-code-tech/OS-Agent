import { DEFAULT_WEIGHTS } from "../domain/constants.js";
import { cosineSimilarity, jaccardSimilarity } from "../domain/text.js";

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function recencyScore(dateValue) {
  if (!dateValue) return 0.25;
  const ageMs = Math.max(0, Date.now() - new Date(dateValue).getTime());
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return clamp(1 / (1 + ageDays / 120));
}

function normalize(value, fallback = 0.5) {
  const number = Number(value);
  return Number.isFinite(number) ? clamp(number) : fallback;
}

export function scoreMemoryNode(node, context = {}) {
  const recency = recencyScore(node.lastSeenAt || node.firstSeenAt || context.referenceDate);
  const salience = normalize(node.salience, 0.5);
  const emotion = normalize(node.attributes?.intensity ?? context.emotionIntensity, 0.35);
  const goalAlignment = normalize(context.goalAlignment ?? node.goalAlignment, 0.45);
  const centrality = normalize(node.centrality ?? context.centrality, 0.4);
  const novelty = node.version && node.version > 1 ? clamp(1 / node.version) : 0.85;
  const domainMatch = context.domain ? clamp(jaccardSimilarity((node.lifeDomains || []).join(" "), context.domain)) : 0.4;
  const semanticSimilarity = context.queryEmbedding && node.embedding ? clamp(cosineSimilarity(context.queryEmbedding, node.embedding)) : 0.35;

  const score =
    DEFAULT_WEIGHTS.recency * recency +
    DEFAULT_WEIGHTS.salience * salience +
    DEFAULT_WEIGHTS.emotion * emotion +
    DEFAULT_WEIGHTS.goalAlignment * goalAlignment +
    DEFAULT_WEIGHTS.centrality * centrality +
    DEFAULT_WEIGHTS.novelty * novelty +
    DEFAULT_WEIGHTS.domainMatch * domainMatch +
    0.1 * semanticSimilarity;

  return Number((clamp(score) * 100).toFixed(2));
}

export function scoreEdgeStrength({ confidence = 0.6, intensity = 0.5, repetition = 1, distance = 0.5 }) {
  const base = 0.2 + 0.45 * normalize(confidence) + 0.2 * normalize(intensity) + 0.1 * clamp(repetition / 5) + 0.05 * (1 - clamp(distance));
  return Number(clamp(base).toFixed(4));
}

