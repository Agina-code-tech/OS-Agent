export const KNOWLEDGE_SOURCE_TYPES = [
  "psychology_textbook",
  "peer_reviewed_research_paper",
  "meta_analysis",
  "systematic_review",
  "behavioral_science_literature",
  "narrative_psychology",
  "jungian_psychology",
  "attachment_theory",
  "act",
  "cbt",
  "positive_psychology",
  "neuroscience",
  "emotional_regulation_research",
];

export const PUBLICATION_QUALITY = {
  meta_analysis: 1,
  systematic_review: 0.96,
  peer_reviewed_research_paper: 0.92,
  psychology_textbook: 0.86,
  behavioral_science_literature: 0.84,
  narrative_psychology: 0.82,
  jungian_psychology: 0.8,
  attachment_theory: 0.9,
  act: 0.88,
  cbt: 0.88,
  positive_psychology: 0.82,
  neuroscience: 0.89,
  emotional_regulation_research: 0.9,
  default: 0.74,
};

export const QUERY_FRAMEWORK_TERMS = [
  { framework: "attachment_theory", terms: ["attachment", "attachment theory", "attachment style", "secure base", "insecure attachment"] },
  { framework: "cbt", terms: ["cbt", "cognitive behavioral", "cognitive distortion", "thought record", "reframe"] },
  { framework: "act", terms: ["act", "acceptance and commitment", "defusion", "values", "psychological flexibility"] },
  { framework: "narrative_psychology", terms: ["narrative", "identity", "life story", "self story", "meaning making"] },
  { framework: "jungian_psychology", terms: ["jung", "shadow", "archetype", "individuation", "complex"] },
  { framework: "positive_psychology", terms: ["strengths", "flourishing", "well-being", "resilience", "gratitude"] },
  { framework: "neuroscience", terms: ["neuroscience", "brain", "nervous system", "amygdala", "prefrontal"] },
  { framework: "emotional_regulation_research", terms: ["emotion regulation", "regulation", "downregulate", "co-regulation", "affect"] },
];

export const DISALLOWED_QUERY_TERMS = [
  "diagnose",
  "diagnosis",
  "therapy",
  "therapist",
  "treatment",
  "prescribe",
  "medication",
  "cure",
  "treat me",
];

export const VECTOR_DIMENSION = 1536;
export const DEFAULT_TOP_K = 6;
export const DEFAULT_CONTEXT_BUDGET = 1800;
export const DEFAULT_CHUNK_WORDS = 220;
export const DEFAULT_CHUNK_OVERLAP = 40;
