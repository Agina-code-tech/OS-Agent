export const SOURCE_TYPES = [
  "reflection",
  "conversation",
  "journal_entry",
  "check_in",
  "voice_transcript",
];

export const PATTERN_FAMILIES = [
  "emotional",
  "behavioral",
  "cognitive",
  "relationship",
];

export const TREND_DIRECTIONS = [
  "emerging",
  "strengthening",
  "weakening",
  "resolved",
  "stable",
];

export const REPORT_WINDOWS = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
};

export const DEFAULT_THRESHOLD = {
  exactMatch: 0.85,
  semanticMatch: 0.72,
  triggerMatch: 0.55,
};

export const PATTERN_DEFINITIONS = [
  {
    family: "emotional",
    label: "recurring anxiety",
    key: "emotional.recurring_anxiety",
    kind: "emotion",
    keywords: ["anxious", "anxiety", "worried", "worry", "nervous", "panic", "overwhelmed", "stress"],
    triggers: ["uncertainty", "deadlines", "criticism", "performance", "conflict"],
  },
  {
    family: "emotional",
    label: "recurring shame",
    key: "emotional.recurring_shame",
    kind: "emotion",
    keywords: ["ashamed", "shame", "embarrassed", "humiliated", "exposed", "inferior"],
    triggers: ["criticism", "comparison", "mistakes", "exposure", "being seen"],
  },
  {
    family: "emotional",
    label: "recurring anger",
    key: "emotional.recurring_anger",
    kind: "emotion",
    keywords: ["angry", "anger", "furious", "resentful", "irritated", "annoyed"],
    triggers: ["injustice", "boundary violations", "dismissal", "control", "unfairness"],
  },
  {
    family: "emotional",
    label: "recurring joy",
    key: "emotional.recurring_joy",
    kind: "emotion",
    keywords: ["joy", "happy", "delighted", "excited", "pleased", "glad"],
    triggers: ["progress", "connection", "wins", "freedom", "flow"],
  },
  {
    family: "emotional",
    label: "recurring confidence",
    key: "emotional.recurring_confidence",
    kind: "emotion",
    keywords: ["confident", "capable", "certain", "sure", "steady", "trust myself"],
    triggers: ["mastery", "practice", "support", "clarity", "wins"],
  },
  {
    family: "behavioral",
    label: "avoidance",
    key: "behavioral.avoidance",
    kind: "behavior",
    keywords: ["avoid", "avoiding", "delay", "postpone", "put off", "not looking at", "can't face"],
    triggers: ["conflict", "uncertainty", "difficult conversations", "tasks", "decisions"],
  },
  {
    family: "behavioral",
    label: "procrastination",
    key: "behavioral.procrastination",
    kind: "behavior",
    keywords: ["procrastinate", "later", "tomorrow", "stuck", "can't start", "not yet"],
    triggers: ["deadlines", "ambiguity", "fear of failure", "task size"],
  },
  {
    family: "behavioral",
    label: "perfectionism",
    key: "behavioral.perfectionism",
    kind: "behavior",
    keywords: ["perfect", "perfectly", "not good enough", "polish", "fix", "redo", "details"],
    triggers: ["evaluation", "visibility", "mistakes", "high stakes"],
  },
  {
    family: "behavioral",
    label: "overthinking",
    key: "behavioral.overthinking",
    kind: "behavior",
    keywords: ["overthink", "thinking about it", "ruminating", "stuck in my head", "analyze", "what if"],
    triggers: ["ambiguity", "indecision", "social evaluation", "future uncertainty"],
  },
  {
    family: "behavioral",
    label: "impulsive action",
    key: "behavioral.impulsive_action",
    kind: "behavior",
    keywords: ["impulsive", "without thinking", "suddenly", "acted fast", "rushed"],
    triggers: ["emotion spikes", "stress", "pressure", "urgency"],
  },
  {
    family: "behavioral",
    label: "withdrawal",
    key: "behavioral.withdrawal",
    kind: "behavior",
    keywords: ["withdraw", "withdrew", "shut down", "pull away", "isolated", "numb"],
    triggers: ["conflict", "shame", "overload", "rejection"],
  },
  {
    family: "cognitive",
    label: "catastrophizing",
    key: "cognitive.catastrophizing",
    kind: "thought",
    keywords: ["worst case", "disaster", "ruined", "everything will fail", "doom", "terrible"],
    triggers: ["uncertainty", "loss", "mistakes", "future ambiguity"],
  },
  {
    family: "cognitive",
    label: "self-criticism",
    key: "cognitive.self_criticism",
    kind: "thought",
    keywords: ["not enough", "stupid", "lazy", "failure", "should have", "my fault", "I am bad"],
    triggers: ["mistakes", "comparison", "performance", "visibility"],
  },
  {
    family: "cognitive",
    label: "black-and-white thinking",
    key: "cognitive.black_white_thinking",
    kind: "thought",
    keywords: ["always", "never", "all or nothing", "completely", "totally", "either/or"],
    triggers: ["stress", "conflict", "moral judgment", "pressure"],
  },
  {
    family: "cognitive",
    label: "validation seeking",
    key: "cognitive.validation_seeking",
    kind: "thought",
    keywords: ["what will they think", "need approval", "reassure me", "tell me it's okay", "validation"],
    triggers: ["social evaluation", "authority figures", "uncertainty"],
  },
  {
    family: "cognitive",
    label: "future fixation",
    key: "cognitive.future_fixation",
    kind: "thought",
    keywords: ["future", "later", "what if", "next month", "next year", "ahead"],
    triggers: ["uncertainty", "planning pressure", "control"],
  },
  {
    family: "relationship",
    label: "fear of abandonment",
    key: "relationship.fear_of_abandonment",
    kind: "relational",
    keywords: ["abandoned", "left", "alone", "they'll leave", "don't leave", "cling"],
    triggers: ["distance", "ambiguity", "conflict", "change"],
  },
  {
    family: "relationship",
    label: "conflict avoidance",
    key: "relationship.conflict_avoidance",
    kind: "relational",
    keywords: ["avoid conflict", "don't want to upset", "keep the peace", "silent", "not say anything"],
    triggers: ["tension", "disagreement", "boundary setting"],
  },
  {
    family: "relationship",
    label: "people pleasing",
    key: "relationship.people_pleasing",
    kind: "relational",
    keywords: ["people please", "say yes", "please them", "make them happy", "can't disappoint"],
    triggers: ["approval", "authority", "rejection", "social pressure"],
  },
  {
    family: "relationship",
    label: "emotional distancing",
    key: "relationship.emotional_distancing",
    kind: "relational",
    keywords: ["distance", "detached", "avoid intimacy", "guarded", "numb", "closed off"],
    triggers: ["vulnerability", "trust", "overwhelm", "fear of need"],
  },
];

export const EMOTION_LEXICON = [
  { label: "anxiety", keywords: ["anxious", "anxiety", "worried", "worry", "nervous", "panic", "stress", "overwhelmed"] },
  { label: "shame", keywords: ["ashamed", "shame", "embarrassed", "humiliated", "exposed"] },
  { label: "anger", keywords: ["angry", "anger", "furious", "resentful", "irritated", "annoyed"] },
  { label: "joy", keywords: ["joy", "happy", "delighted", "excited", "pleased", "glad"] },
  { label: "confidence", keywords: ["confident", "capable", "certain", "sure", "steady", "trust myself"] },
  { label: "sadness", keywords: ["sad", "sadness", "down", "hurt", "lonely", "empty"] },
  { label: "hope", keywords: ["hope", "hopeful", "optimistic", "possible"] },
  { label: "relief", keywords: ["relief", "relieved", "lighter", "calm"] },
];

export const TRIGGER_LEXICON = [
  { label: "uncertainty", keywords: ["uncertain", "unknown", "not sure", "maybe", "future", "what if"] },
  { label: "deadlines", keywords: ["deadline", "urgent", "due", "late", "time pressure"] },
  { label: "criticism", keywords: ["criticism", "criticized", "judged", "feedback", "review"] },
  { label: "conflict", keywords: ["conflict", "argument", "fight", "tension", "disagreement"] },
  { label: "comparison", keywords: ["compare", "comparison", "others", "better than", "worse than"] },
  { label: "rejection", keywords: ["reject", "rejection", "ignored", "left out", "unwanted"] },
  { label: "visibility", keywords: ["seen", "visible", "public", "share", "exposed", "presenting"] },
  { label: "performance", keywords: ["performance", "deliver", "deliverable", "work review", "evaluation"] },
  { label: "boundary", keywords: ["boundary", "say no", "limit", "protect", "pushy"] },
  { label: "support", keywords: ["help", "support", "ask", "together", "told me"] },
  { label: "overload", keywords: ["overload", "too much", "overwhelmed", "exhausted", "burnt out"] },
  { label: "connection", keywords: ["connection", "close", "intimacy", "care", "belong"] },
];

