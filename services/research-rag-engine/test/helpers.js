export class TestEmbeddingProvider {
  constructor() {
    this.dimension = 4;
  }

  async embedText(text = "") {
    const normalized = String(text).toLowerCase();
    return [
      Number(/cbt|cognitive distortion|self-criticism|reframe/.test(normalized)),
      Number(/attachment|secure base|abandonment|people pleasing/.test(normalized)),
      Number(/regulation|nervous system|amygdala|prefrontal|emotion/.test(normalized)),
      Number(/narrative|identity|meaning/.test(normalized)),
    ];
  }

  async embedMany(texts = []) {
    const vectors = [];
    for (const text of texts) {
      vectors.push(await this.embedText(text));
    }
    return vectors;
  }
}

export function buildSampleDocuments() {
  return [
    {
      id: "doc-cbt",
      collection: "psychology",
      title: "Cognitive Distortions and Self-Criticism in CBT",
      abstract: "CBT research shows that identifying cognitive distortions can reduce harsh self-criticism and rumination.",
      content: [
        "This peer reviewed paper explains how thought records help people notice automatic thoughts.",
        "It shows that naming cognitive distortions and testing alternative beliefs can reduce self-criticism.",
        "The intervention focuses on evidence, reappraisal, and behavioral experiments.",
      ].join(" "),
      publicationType: "peer_reviewed_research_paper",
      publicationYear: 2021,
      authors: ["A. Scholar", "B. Researcher"],
      journal: "Journal of Evidence-Based Psychology",
      sourceUrl: "https://example.org/cbt-self-criticism",
      frameworks: ["cbt"],
      tags: ["cognitive distortions", "self-criticism", "reappraisal"],
      domains: ["cognition"],
    },
    {
      id: "doc-attachment",
      collection: "psychology",
      title: "Attachment Security and Relational Regulation",
      abstract: "Attachment theory describes how secure base behavior supports regulation in close relationships.",
      content: [
        "Attachment theory examines abandonment fear, secure base behavior, and protest responses.",
        "Relational regulation research shows that safety cues can reduce arousal and improve flexibility.",
        "The framework is useful for understanding closeness, distancing, and people pleasing.",
      ].join(" "),
      publicationType: "systematic_review",
      publicationYear: 2019,
      authors: ["C. Analyst"],
      journal: "Review of Developmental Science",
      sourceUrl: "https://example.org/attachment-regulation",
      frameworks: ["attachment_theory"],
      tags: ["attachment", "secure base", "relational regulation"],
      domains: ["relationships"],
    },
    {
      id: "doc-regulation",
      collection: "psychology",
      title: "Neuroscience of Emotional Regulation",
      abstract: "Neuroscience links prefrontal control, amygdala reactivity, and deliberate regulation strategies.",
      content: [
        "Emotion regulation research describes how the prefrontal cortex supports downregulation of reactivity.",
        "The amygdala responds to threat cues, while repetition can strengthen regulation skills.",
        "The literature connects nervous system activation, attention shifting, and behavioral pacing.",
      ].join(" "),
      publicationType: "meta_analysis",
      publicationYear: 2023,
      authors: ["D. Neuroscientist", "E. Collaborator"],
      journal: "Annual Review of Affective Neuroscience",
      sourceUrl: "https://example.org/neuroscience-regulation",
      frameworks: ["neuroscience", "emotional_regulation_research"],
      tags: ["emotion regulation", "nervous system", "amygdala"],
      domains: ["regulation"],
    },
  ];
}
