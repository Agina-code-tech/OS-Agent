import { tokenise } from "../domain/text.js";

function hashToken(token, dimensions) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const bucket = Math.abs(hash) % dimensions;
  const sign = hash % 2 === 0 ? 1 : -1;
  return { bucket, sign };
}

export function createHashEmbedding(text, dimensions = 64) {
  const vector = Array.from({ length: dimensions }, () => 0);
  const tokens = tokenise(text);

  if (!tokens.length) return vector;

  for (const token of tokens) {
    const { bucket, sign } = hashToken(token, dimensions);
    vector[bucket] += sign;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) return vector;

  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

