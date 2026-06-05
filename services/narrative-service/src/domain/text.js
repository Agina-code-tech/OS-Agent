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

export function tokenise(value = "") {
  return String(value)
    .toLowerCase()
    .match(/[a-z0-9']+/g) ?? [];
}

export function stableHash(value = "") {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

export function stableId(prefix, ...parts) {
  return `${prefix}_${stableHash(parts.join("|")).slice(0, 20)}`;
}

export function truncate(value = "", length = 180) {
  const text = String(value).trim();
  return text.length <= length ? text : `${text.slice(0, Math.max(0, length - 3)).trimEnd()}...`;
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

export function average(values = []) {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (!filtered.length) return 0;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

export function linearTrend(points = []) {
  const filtered = points
    .map((point, index) => ({ x: index, y: Number(point) }))
    .filter((point) => Number.isFinite(point.y));
  if (filtered.length < 2) return 0;
  const n = filtered.length;
  const sumX = filtered.reduce((sum, point) => sum + point.x, 0);
  const sumY = filtered.reduce((sum, point) => sum + point.y, 0);
  const sumXY = filtered.reduce((sum, point) => sum + point.x * point.y, 0);
  const sumXX = filtered.reduce((sum, point) => sum + point.x * point.x, 0);
  const denominator = n * sumXX - sumX * sumX;
  if (!denominator) return 0;
  return (n * sumXY - sumX * sumY) / denominator;
}

export function countMatches(text = "", keywords = []) {
  const normalized = String(text).toLowerCase();
  return keywords.reduce((score, keyword) => {
    return normalized.includes(keyword.toLowerCase()) ? score + 1 : score;
  }, 0);
}

export function bucketByDays(timestamp, windowDays) {
  const now = new Date(timestamp).getTime();
  const bucketMs = windowDays * 24 * 60 * 60 * 1000;
  return Math.floor(now / bucketMs);
}
