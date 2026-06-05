import { splitSentences, tokenise, truncate } from "../domain/text.js";

function sentenceOverlap(sentence, queryTokens) {
  const sentenceTokens = new Set(tokenise(sentence));
  let hits = 0;
  for (const token of queryTokens) {
    if (sentenceTokens.has(token)) hits += 1;
  }
  return hits;
}

export function compressChunkText(text = "", query = "", maxSentences = 3) {
  const sentences = splitSentences(text);
  if (!sentences.length) return truncate(text, 320);
  const queryTokens = tokenise(query);
  const scored = sentences.map((sentence, index) => ({
    sentence,
    index,
    score: sentenceOverlap(sentence, queryTokens),
  }));
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  const selected = scored.slice(0, maxSentences).sort((a, b) => a.index - b.index).map((item) => item.sentence);
  return truncate(selected.join(" "), 480);
}

export function buildSupportingEvidence(chunk, query) {
  const excerpt = compressChunkText(chunk.text, query, 2);
  const reason = chunk.heading ? `Section: ${chunk.heading}` : "Relevant passage";
  return {
    chunkId: chunk.id,
    excerpt,
    reason,
  };
}
