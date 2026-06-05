import { average, stableHash, uniqueBy } from "../domain/text.js";

export function buildCitationKey(document = {}) {
  const source = document.doi || document.sourceUrl || document.title || "unknown-source";
  return stableHash([
    source,
    document.publicationYear || "",
    (document.authors || []).join("|"),
    document.publicationType || "",
  ].join("|")).slice(0, 24);
}

export function buildCitationText(document = {}) {
  const authors = Array.isArray(document.authors) && document.authors.length ? document.authors.join(", ") : "Unknown author";
  const year = document.publicationYear || "n.d.";
  const title = document.title || "Untitled";
  const venue = document.journal || document.publisher || document.publicationType || "source";
  const suffix = document.doi ? `DOI: ${document.doi}` : document.sourceUrl ? document.sourceUrl : "";
  return `${authors} (${year}). ${title}. ${venue}.${suffix ? ` ${suffix}` : ""}`.trim();
}

export function buildDocumentId(document = {}) {
  return `doc_${stableHash(buildCitationKey(document)).slice(0, 20)}`;
}

export function buildChunkId(documentId, chunkIndex, chunkText) {
  return `chunk_${stableHash(`${documentId}:${chunkIndex}:${chunkText}`).slice(0, 20)}`;
}

export function buildRetrievalId(query, userId = "global") {
  return `retr_${stableHash(`${userId}:${query}`).slice(0, 20)}`;
}

export function mergeUniqueStrings(...groups) {
  return uniqueBy(groups.flat().filter(Boolean).map((item) => String(item)), (item) => item.toLowerCase());
}

export function summarizeConfidence(values = []) {
  const value = Math.max(0, Math.min(1, average(values)));
  return Number(value.toFixed(4));
}

export function rankBy(values = [], key = "score") {
  return [...values].sort((a, b) => Number(b[key] || 0) - Number(a[key] || 0));
}
