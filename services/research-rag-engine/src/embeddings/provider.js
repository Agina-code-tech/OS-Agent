import OpenAI from "openai";
import { VECTOR_DIMENSION, QUERY_FRAMEWORK_TERMS } from "../domain/constants.js";
import { stableHash, tokenise } from "../domain/text.js";

function normalizeVector(values = [], dimension = VECTOR_DIMENSION) {
  const vector = new Array(dimension).fill(0);
  for (let index = 0; index < values.length; index += 1) {
    vector[index] = Number(values[index] || 0);
  }
  return vector;
}

function localEmbedding(text = "", dimension = VECTOR_DIMENSION) {
  const vector = new Array(dimension).fill(0);
  const tokens = tokenise(text);
  if (!tokens.length) return vector;

  for (const token of tokens) {
    const hash = stableHash(token);
    for (let offset = 0; offset < 8; offset += 1) {
      const slice = hash.slice(offset * 8, offset * 8 + 8);
      const value = parseInt(slice, 16);
      const index = value % dimension;
      const sign = value % 2 === 0 ? 1 : -1;
      vector[index] += sign * (1 + (value % 7) / 10);
    }
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / magnitude);
}

export function extractQueryFrameworks(query = "") {
  const normalized = String(query).toLowerCase();
  return QUERY_FRAMEWORK_TERMS.flatMap((entry) => {
    const hits = entry.terms.filter((term) => normalized.includes(term.toLowerCase()));
    return hits.length ? [entry.framework] : [];
  });
}

export class EmbeddingProvider {
  constructor(config = {}) {
    this.model = config.embeddingModel || "text-embedding-3-small";
    this.dimension = Number(config.vectorDimension || VECTOR_DIMENSION);
    this.client = config.openAiApiKey ? new OpenAI({ apiKey: config.openAiApiKey }) : null;
  }

  async embedText(text) {
    if (this.client) {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: text || "",
        encoding_format: "float",
      });
      return normalizeVector(response.data[0].embedding, this.dimension);
    }
    return localEmbedding(text, this.dimension);
  }

  async embedMany(texts = []) {
    const vectors = [];
    for (const text of texts) {
      vectors.push(await this.embedText(text));
    }
    return vectors;
  }
}

export function buildLocalEmbedding(text, dimension = VECTOR_DIMENSION) {
  return localEmbedding(text, dimension);
}
