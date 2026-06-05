import crypto from "node:crypto";

export function normalizeText(value = "") {
  return String(value)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function splitSentences(text = "") {
  return normalizeText(text)
    .split(/(?<=[.!?])\s+|\n+/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function stableHash(value = "") {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

export function stableId(prefix, ...parts) {
  return `${prefix}_${stableHash(parts.join("|")).slice(0, 20)}`;
}

export function truncate(value = "", length = 160) {
  const text = String(value).trim();
  return text.length <= length ? text : `${text.slice(0, Math.max(0, length - 1)).trimEnd()}…`;
}

export function uniqueBy(items, keyFn) {
  const seen = new Set();
  const output = [];

  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }

  return output;
}

export function tokenise(value = "") {
  return String(value)
    .toLowerCase()
    .match(/[a-z0-9']+/g) ?? [];
}

export function jaccardSimilarity(a = "", b = "") {
  const setA = new Set(tokenise(a));
  const setB = new Set(tokenise(b));
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = new Set([...setA, ...setB]).size;
  return union ? intersection / union : 0;
}

export function countMatches(text = "", keywords = []) {
  const normalized = String(text).toLowerCase();
  return keywords.reduce((score, keyword) => {
    return normalized.includes(keyword.toLowerCase()) ? score + 1 : score;
  }, 0);
}

export function cosineSimilarity(a = [], b = []) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) {
    return 0;
  }

  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    magnitudeA += a[index] ** 2;
    magnitudeB += b[index] ** 2;
  }

  const denominator = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
  return denominator ? dot / denominator : 0;
}

