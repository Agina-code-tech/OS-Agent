import { average, tokenise } from "../domain/text.js";

function termFrequency(tokens = []) {
  return tokens.reduce((acc, token) => {
    acc[token] = (acc[token] || 0) + 1;
    return acc;
  }, {});
}

export function buildCorpusStats(chunks = []) {
  const docCount = chunks.length;
  const documentFrequency = new Map();
  let totalLength = 0;

  for (const chunk of chunks) {
    const tokens = new Set(tokenise(chunk.text));
    totalLength += tokens.size;
    for (const token of tokens) {
      documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
    }
  }

  return {
    docCount,
    avgLength: docCount ? totalLength / docCount : 0,
    documentFrequency,
  };
}

export function bm25Score(query = "", document = "", stats = {}) {
  const queryTokens = tokenise(query);
  const docTokens = tokenise(document);
  if (!queryTokens.length || !docTokens.length) return 0;

  const k1 = 1.5;
  const b = 0.75;
  const tf = termFrequency(docTokens);
  const avgLength = stats.avgLength || docTokens.length || 1;
  const docLength = docTokens.length;

  let score = 0;
  for (const term of queryTokens) {
    const df = stats.documentFrequency?.get(term) || 0;
    if (!df) continue;
    const idf = Math.log(1 + ((stats.docCount - df + 0.5) / (df + 0.5)));
    const frequency = tf[term] || 0;
    const numerator = frequency * (k1 + 1);
    const denominator = frequency + k1 * (1 - b + b * (docLength / avgLength));
    score += idf * (denominator ? numerator / denominator : 0);
  }
  return score;
}

export function lexicalOverlapScore(query = "", document = "") {
  const queryTokens = new Set(tokenise(query));
  const docTokens = new Set(tokenise(document));
  if (!queryTokens.size || !docTokens.size) return 0;
  let hits = 0;
  for (const token of queryTokens) {
    if (docTokens.has(token)) hits += 1;
  }
  return hits / queryTokens.size;
}

export function normalizeScores(items = [], key = "score") {
  const values = items.map((item) => Number(item[key] || 0)).filter((value) => Number.isFinite(value));
  const max = Math.max(...values, 0);
  if (!max) return items.map((item) => ({ ...item, [`${key}Normalized`]: 0 }));
  return items.map((item) => ({ ...item, [`${key}Normalized`]: Number((item[key] / max).toFixed(4)) }));
}

export function averageBm25Score(items = []) {
  return average(items.map((item) => item.bm25Score || 0));
}
