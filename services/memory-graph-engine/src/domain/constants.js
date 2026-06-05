export const NODE_TYPES = [
  "Memory",
  "Emotion",
  "Belief",
  "Value",
  "Goal",
  "Narrative",
  "Pattern",
  "Relationship",
  "LifeEvent",
  "Person",
  "Project",
];

export const EDGE_TYPES = [
  "causes",
  "reinforces",
  "contradicts",
  "supports",
  "associated_with",
  "triggered_by",
  "evolved_into",
  "part_of",
  "related_to",
  "resolved_by",
  "blocks",
  "strengthens",
];

export const CONCEPT_TYPES = [
  "memory",
  "emotion",
  "belief",
  "value",
  "goal",
  "narrative",
  "pattern",
  "relationship",
  "life_event",
  "person",
  "project",
  "decision",
  "insight",
];

export const LIFE_DOMAINS = [
  "work",
  "relationships",
  "family",
  "health",
  "money",
  "home",
  "identity",
  "creativity",
  "purpose",
  "learning",
  "spirituality",
];

export const DEFAULT_WEIGHTS = {
  recency: 0.28,
  salience: 0.2,
  emotion: 0.14,
  goalAlignment: 0.14,
  centrality: 0.12,
  novelty: 0.06,
  domainMatch: 0.06,
};

export const EMOTION_LEXICON = [
  { label: "joy", intensity: 0.7, polarity: "positive", keywords: ["joy", "happy", "glad", "delighted", "excited", "pleased"] },
  { label: "sadness", intensity: 0.7, polarity: "negative", keywords: ["sad", "down", "grief", "hurt", "lonely", "empty"] },
  { label: "anger", intensity: 0.8, polarity: "negative", keywords: ["angry", "mad", "furious", "irritated", "resentful", "annoyed"] },
  { label: "fear", intensity: 0.85, polarity: "negative", keywords: ["afraid", "anxious", "worried", "scared", "nervous", "terrified"] },
  { label: "shame", intensity: 0.9, polarity: "negative", keywords: ["ashamed", "embarrassed", "humiliated", "exposed"] },
  { label: "guilt", intensity: 0.75, polarity: "negative", keywords: ["guilty", "regretful", "sorry", "blame"] },
  { label: "relief", intensity: 0.5, polarity: "positive", keywords: ["relief", "relieved", "lighter", "calm"] },
  { label: "hope", intensity: 0.55, polarity: "positive", keywords: ["hope", "hopeful", "optimistic", "possible"] },
  { label: "confusion", intensity: 0.45, polarity: "neutral", keywords: ["confused", "unclear", "lost", "foggy"] },
  { label: "trust", intensity: 0.35, polarity: "positive", keywords: ["trust", "safe", "steady", "secure"] },
];

export const VALUE_LEXICON = [
  { label: "honesty", keywords: ["honesty", "truth", "truthful", "real", "transparent"] },
  { label: "freedom", keywords: ["freedom", "autonomy", "independence", "space"] },
  { label: "stability", keywords: ["stability", "sturdy", "safe", "secure", "consistency"] },
  { label: "belonging", keywords: ["belonging", "connection", "community", "family", "together"] },
  { label: "growth", keywords: ["growth", "learn", "improve", "expand", "develop"] },
  { label: "mastery", keywords: ["mastery", "skill", "practice", "excellent", "competence"] },
  { label: "care", keywords: ["care", "kindness", "support", "nurture", "compassion"] },
  { label: "justice", keywords: ["justice", "fair", "fairness", "equity", "right"] },
  { label: "creativity", keywords: ["creative", "creativity", "make", "art", "design", "build"] },
  { label: "responsibility", keywords: ["responsibility", "accountability", "reliable", "commitment"] },
];

export const LIFE_DOMAIN_LEXICON = [
  { domain: "work", keywords: ["work", "job", "manager", "team", "career", "project", "deadline"] },
  { domain: "relationships", keywords: ["partner", "friend", "relationship", "marriage", "dating", "conflict"] },
  { domain: "family", keywords: ["mother", "father", "parent", "child", "sibling", "family"] },
  { domain: "health", keywords: ["health", "body", "sleep", "exercise", "food", "energy", "anxiety", "stress"] },
  { domain: "money", keywords: ["money", "budget", "debt", "income", "pay", "financial"] },
  { domain: "home", keywords: ["home", "house", "room", "living space", "apartment"] },
  { domain: "identity", keywords: ["self", "identity", "confidence", "purpose", "worth"] },
  { domain: "creativity", keywords: ["creative", "write", "art", "music", "design"] },
  { domain: "learning", keywords: ["learn", "study", "read", "teach", "practice"] },
  { domain: "spirituality", keywords: ["meaning", "spiritual", "purpose", "faith", "values"] },
];

export const CUE_PATTERNS = {
  beliefs: [/I believe\b/i, /I think\b/i, /I worry\b/i, /I assume\b/i, /I tell myself\b/i, /it feels like\b/i],
  goals: [/I want to\b/i, /I need to\b/i, /I am trying to\b/i, /my goal is\b/i, /I hope to\b/i],
  decisions: [/I decided\b/i, /I chose\b/i, /I will\b/i, /I won't\b/i, /I am not going to\b/i, /I committed to\b/i],
  insights: [/I realized\b/i, /I noticed\b/i, /I learned\b/i, /it became clear\b/i, /I see now\b/i],
  patterns: [/always\b/i, /again\b/i, /keep\b/i, /repeating\b/i, /same pattern\b/i, /every time\b/i],
  events: [/yesterday\b/i, /last week\b/i, /this morning\b/i, /today\b/i, /when\b/i, /during\b/i, /after\b/i, /before\b/i],
  projects: [/project\b/i, /building\b/i, /working on\b/i, /launch\b/i, /product\b/i, /plan\b/i],
  relationships: [/with my\b/i, /my partner\b/i, /my friend\b/i, /my manager\b/i, /my mother\b/i, /my father\b/i, /my team\b/i],
};

