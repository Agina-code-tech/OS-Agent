import { PUBLICATION_QUALITY } from "../domain/constants.js";
import { average, cosineSimilarity, tokenise } from "../domain/text.js";
import { extractQueryFrameworks } from "../embeddings/provider.js";

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function qualityWeight(publicationType) {
  return PUBLICATION_QUALITY[String(publicationType || "").toLowerCase()] || PUBLICATION_QUALITY.default;
}

function yearWeight(publicationYear, nowYear) {
  if (!Number.isFinite(publicationYear)) return 0.5;
  const age = Math.max(0, nowYear - publicationYear);
  if (age <= 3) return 1;
  if (age <= 10) return 0.92;
  if (age <= 20) return 0.86;
  return 0.8;
}

function frameworkWeight(candidateFrameworks = [], queryFrameworks = []) {
  if (!queryFrameworks.length || !candidateFrameworks.length) return 0.5;
  const candidate = new Set(candidateFrameworks.map((item) => String(item).toLowerCase()));
  let hits = 0;
  for (const framework of queryFrameworks) {
    if (candidate.has(String(framework).toLowerCase())) hits += 1;
  }
  return clamp(hits / queryFrameworks.length, 0, 1);
}

function evidenceWeight(evidenceText = "", query = "") {
  const queryTokens = new Set(tokenise(query));
  const evidenceTokens = new Set(tokenise(evidenceText));
  if (!queryTokens.size || !evidenceTokens.size) return 0.4;
  let hits = 0;
  for (const token of queryTokens) {
    if (evidenceTokens.has(token)) hits += 1;
  }
  return clamp(hits / queryTokens.size, 0, 1);
}

export function rerankCandidates(candidates = [], query, queryEmbedding, options = {}) {
  const queryFrameworks = extractQueryFrameworks(query);
  const nowYear = new Date().getFullYear();

  return candidates.map((candidate) => {
    const vectorScore = candidate.embedding ? cosineSimilarity(queryEmbedding, candidate.embedding) : 0;
    const lexicalScore = Number(candidate.bm25Score || candidate.lexicalScore || 0);
    const frameworkScore = frameworkWeight(candidate.frameworks || [], queryFrameworks);
    const qualityScore = qualityWeight(candidate.publicationType);
    const recencyScore = yearWeight(candidate.publicationYear, nowYear);
    const evidenceScore = evidenceWeight(candidate.text || candidate.excerpt || "", query);
    const sourceDiversity = clamp((candidate.authors || []).length > 1 ? 0.9 : 0.8);

    const rerankScore =
      lexicalScore * 0.28 +
      vectorScore * 0.28 +
      frameworkScore * 0.16 +
      qualityScore * 0.12 +
      recencyScore * 0.08 +
      evidenceScore * 0.06 +
      sourceDiversity * 0.02;

    return {
      ...candidate,
      vectorScore,
      frameworkScore,
      qualityScore,
      recencyScore,
      evidenceScore,
      rerankScore: Number(rerankScore.toFixed(6)),
    };
  }).sort((a, b) => b.rerankScore - a.rerankScore || b.vectorScore - a.vectorScore || b.bm25Score - a.bm25Score);
}

export function confidenceFromScores(scores = {}) {
  const values = [
    scores.rerankScore || 0,
    scores.vectorScore || 0,
    scores.bm25Score || 0,
    scores.frameworkScore || 0,
    scores.qualityScore || 0,
  ];
  return clamp(average(values) * 1.05);
}
