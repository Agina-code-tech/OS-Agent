import { DEFAULT_CHUNK_OVERLAP, DEFAULT_CHUNK_WORDS } from "../domain/constants.js";
import { normalizeText, splitSentences, wordCount } from "../domain/text.js";

function buildChunkFromSentences(sentences, chunkIndex, heading, startSentenceIndex, endSentenceIndex) {
  const text = sentences.map((sentence) => sentence.text).join(" ");
  const startChar = sentences[0]?.startChar ?? 0;
  const endChar = sentences[sentences.length - 1]?.endChar ?? text.length;
  return {
    chunkIndex,
    heading,
    text: normalizeText(text),
    tokenCount: wordCount(text),
    startSentenceIndex,
    endSentenceIndex,
    startChar,
    endChar,
  };
}

export function chunkDocument(content = "", options = {}) {
  const maxWords = Number(options.maxWords || DEFAULT_CHUNK_WORDS);
  const overlapWords = Number(options.overlapWords || DEFAULT_CHUNK_OVERLAP);
  const text = normalizeText(content);
  if (!text) return [];

  const sentences = splitSentences(text).map((sentence) => {
    const startChar = text.indexOf(sentence);
    return {
      text: sentence,
      startChar: startChar >= 0 ? startChar : 0,
      endChar: startChar >= 0 ? startChar + sentence.length : sentence.length,
      words: wordCount(sentence),
    };
  });

  const chunks = [];
  let current = [];
  let currentWords = 0;
  let chunkIndex = 0;
  let heading = options.heading || null;

  for (let index = 0; index < sentences.length; index += 1) {
    const sentence = sentences[index];
    const sentenceIsHeading = /^#{1,6}\s+/.test(sentence.text) || /^(chapter|section|part)\b/i.test(sentence.text);
    if (sentenceIsHeading) {
      heading = sentence.text.replace(/^#{1,6}\s+/, "").trim();
    }

    current.push(sentence);
    currentWords += sentence.words;

    const shouldFlush = currentWords >= maxWords || index === sentences.length - 1;
    if (shouldFlush) {
      chunks.push(buildChunkFromSentences(current, chunkIndex, heading, index - current.length + 1, index));
      chunkIndex += 1;
      if (index < sentences.length - 1 && overlapWords > 0) {
        const overlap = [];
        let overlapWordsCount = 0;
        for (let back = current.length - 1; back >= 0; back -= 1) {
          const overlapSentence = current[back];
          overlap.unshift(overlapSentence);
          overlapWordsCount += overlapSentence.words;
          if (overlapWordsCount >= overlapWords) break;
        }
        current = overlap.slice();
        currentWords = overlap.reduce((sum, item) => sum + item.words, 0);
      } else {
        current = [];
        currentWords = 0;
      }
    }
  }

  return chunks;
}
