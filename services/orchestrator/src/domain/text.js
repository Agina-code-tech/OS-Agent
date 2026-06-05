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

