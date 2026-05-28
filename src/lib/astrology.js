const signData = [
  { sign: "Aries", start: [3, 21], end: [4, 19], element: "Fire", bodyZone: "Head & face" },
  { sign: "Taurus", start: [4, 20], end: [5, 20], element: "Earth", bodyZone: "Throat & neck" },
  { sign: "Gemini", start: [5, 21], end: [6, 20], element: "Air", bodyZone: "Lungs & nervous system" },
  { sign: "Cancer", start: [6, 21], end: [7, 22], element: "Water", bodyZone: "Chest & stomach" },
  { sign: "Leo", start: [7, 23], end: [8, 22], element: "Fire", bodyZone: "Heart & spine" },
  { sign: "Virgo", start: [8, 23], end: [9, 22], element: "Earth", bodyZone: "Digestive system & gut" },
  { sign: "Libra", start: [9, 23], end: [10, 22], element: "Air", bodyZone: "Kidneys & lower back" },
  { sign: "Scorpio", start: [10, 23], end: [11, 21], element: "Water", bodyZone: "Reproductive system & elimination" },
  { sign: "Sagittarius", start: [11, 22], end: [12, 21], element: "Fire", bodyZone: "Hips & thighs" },
  { sign: "Capricorn", start: [12, 22], end: [1, 19], element: "Earth", bodyZone: "Bones, knees & skin" },
  { sign: "Aquarius", start: [1, 20], end: [2, 18], element: "Air", bodyZone: "Shins, ankles & circulation" },
  { sign: "Pisces", start: [2, 19], end: [3, 20], element: "Water", bodyZone: "Feet & lymphatic system" },
];

const dayRulers = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];

const shadowPrompts = [
  { label: "AVOIDANCE", prompt: "What are you currently not looking at?" },
  { label: "PATTERN", prompt: "What behavior keeps showing up that you justify?" },
  { label: "FEAR", prompt: "What outcome are you organizing your life to avoid?" },
  { label: "SABOTAGE", prompt: "Where are you slowing yourself down on purpose?" },
  { label: "RELATIONAL", prompt: "What dynamic are you recreating with someone right now?" },
];

const modeMap = {
  Fire: { Aries: "ACT", Leo: "EXPRESS", Sagittarius: "ACT" },
  Earth: { Taurus: "FEEL", Virgo: "THINK", Capricorn: "TRANSFORM" },
  Air: { Gemini: "THINK", Libra: "EXPRESS", Aquarius: "THINK" },
  Water: { Cancer: "FEEL", Scorpio: "TRANSFORM", Pisces: "FEEL" },
};

function pad2(value) {
  return String(value).padStart(2, "0");
}

export function getLocalDateValue(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function parseDateValue(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function getSign(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return (
    signData.find((entry) => {
      const [startMonth, startDay] = entry.start;
      const [endMonth, endDay] = entry.end;

      if (startMonth <= endMonth) {
        return (
          (month === startMonth && day >= startDay) ||
          (month > startMonth && month < endMonth) ||
          (month === endMonth && day <= endDay)
        );
      }

      return (
        (month === startMonth && day >= startDay) ||
        month > startMonth ||
        month < endMonth ||
        (month === endMonth && day <= endDay)
      );
    }) ?? signData[0]
  );
}

export function getDayRuler(date) {
  return dayRulers[date.getDay()];
}

export function buildAstrologyContext(dateValue) {
  const date = parseDateValue(dateValue);
  const sign = getSign(date);

  return {
    dateValue,
    date,
    sign: sign.sign,
    season: `${sign.sign} season`,
    dayRuler: getDayRuler(date),
    element: sign.element,
    bodyZone: sign.bodyZone,
  };
}

function getMode(sign, element, dayRuler) {
  const base = modeMap[element]?.[sign] ?? "THINK";

  if (dayRuler === "Moon" && base === "THINK") return "FEEL";
  if (dayRuler === "Mercury" && base === "FEEL") return "THINK";
  if (dayRuler === "Mars" && base === "THINK") return "ACT";
  if (dayRuler === "Saturn" && base === "ACT") return "TRANSFORM";

  return base;
}

function getModeReason(mode, sign, dayRuler, element) {
  const reasons = {
    THINK: `${sign} season benefits from clear sequencing, and ${dayRuler} day rewards structured attention and precise language.`,
    ACT: `${sign} season needs visible movement, and ${dayRuler} day pushes intent into a concrete next step.`,
    FEEL: `${sign} season works best with body awareness, and ${dayRuler} day makes regulation before action more effective.`,
    EXPRESS: `${sign} season needs output into the room, and ${dayRuler} day favors direct communication over internal rehearsal.`,
    TRANSFORM: `${sign} season is asking for a pattern reset, and ${dayRuler} day supports removing what is outdated instead of maintaining it.`,
  };

  return reasons[mode] ?? `${sign} season and ${dayRuler} day call for ${element.toLowerCase()}-based practical focus.`;
}

function getWarning(sign, element, dayRuler, mode) {
  if (dayRuler === "Mercury" && mode === "THINK") {
    return {
      likelyToday: "overthinking",
      correction: "Set a 12-minute timer, write the next three actions, and start the first one before you add more information.",
    };
  }

  if (dayRuler === "Moon" && element === "Water") {
    return {
      likelyToday: "emotional flooding",
      correction: "Do six slow exhales, name the feeling in one sentence, and choose one fact-based task before you discuss anything.",
    };
  }

  if (dayRuler === "Mars" && element === "Fire") {
    return {
      likelyToday: "impulsivity",
      correction: "Pause for one full breath, remove one unnecessary choice, and execute the smallest useful step.",
    };
  }

  if (dayRuler === "Saturn") {
    return {
      likelyToday: "burnout",
      correction: "Cut the plan to one must-do task, then work for 25 minutes before checking anything else.",
    };
  }

  if (sign === "Gemini" || sign === "Aquarius") {
    return {
      likelyToday: "fragmentation",
      correction: "Write one priority on paper, close the other tabs, and stay with that task for a full work block.",
    };
  }

  return {
    likelyToday: "avoidance",
    correction: "Name the avoided task, open the relevant file or note, and stay with it for 10 minutes without switching context.",
  };
}

function getActions(mode, warning) {
  const bodyActions = {
    THINK: "Do 3 minutes of slow nasal breathing, then write the problem in one sentence.",
    ACT: "Do 10 brisk squats or a 2-minute walk, then begin the first task without opening another tab.",
    FEEL: "Place one hand on your chest and one on your belly, then do six slow exhales before deciding anything.",
    EXPRESS: "Unclench your jaw, roll your shoulders once, and say one direct sentence you have been avoiding.",
    TRANSFORM: "Do a 90-second body scan, then remove one distracting object from your workspace.",
  };

  const mindActions = {
    THINK: "Write the next three tasks in order, then finish the first one in a 25-minute block.",
    ACT: "Define the smallest visible next step, then set a 15-minute timer and complete it.",
    FEEL: "List the feeling, the trigger, and the next fact-based action in three short lines.",
    EXPRESS: "Draft the message in plain language, then edit it down to one clear paragraph.",
    TRANSFORM: "Identify one pattern you keep repeating, then write the replacement behavior in one sentence.",
  };

  const lifeActions = {
    THINK: "Close one open loop by sending the email, booking the thing, or making the decision today.",
    ACT: "Deliver one concrete output before lunch, even if it is small and unfinished.",
    FEEL: "Pause one unnecessary commitment and choose the next thing only after you feel regulated.",
    EXPRESS: "Say the direct thing to the relevant person instead of rehearsing it internally.",
    TRANSFORM: "Remove one outdated obligation from your calendar, list, or workspace today.",
  };

  const correctionSuffix =
    warning.likelyToday === "avoidance"
      ? " Keep the task visible until the first 10 minutes are done."
      : warning.likelyToday === "overthinking"
        ? " Do not add more information before acting."
        : warning.likelyToday === "burnout"
          ? " Protect the rest of the day by shrinking the scope."
          : "";

  return {
    body: `${bodyActions[mode]}${correctionSuffix}`,
    mind: mindActions[mode],
    life: lifeActions[mode],
  };
}

function getTodayRule(mode, warning) {
  const ruleMap = {
    THINK: "write the sequence first and act before you reopen the loop",
    ACT: "move immediately on the smallest visible next step",
    FEEL: "regulate your body before you make the call",
    EXPRESS: "say the direct thing instead of circling it",
    TRANSFORM: "remove the old pattern before you optimize the new one",
  };

  const failMap = {
    THINK: "keep gathering information to avoid commitment",
    ACT: "wait for certainty and lose momentum",
    FEEL: "let discomfort make decisions for you",
    EXPRESS: "hint instead of naming the issue",
    TRANSFORM: "negotiate with a pattern you need to interrupt",
  };

  const avoidanceSuffix = warning.likelyToday === "avoidance" ? " and keep the avoided task visible" : "";
  return `Today works best when you ${ruleMap[mode]}${avoidanceSuffix}, and fails when you ${failMap[mode]}.`;
}

export function buildFallbackGuide(context) {
  const mode = getMode(context.sign, context.element, context.dayRuler);
  const warning = getWarning(context.sign, context.element, context.dayRuler, mode);
  const actions = getActions(mode, warning);

  return {
    snapshot: `${context.season} / ${context.dayRuler} day / ${context.element} / ${context.bodyZone}`,
    dominantMode: {
      label: mode,
      reason: getModeReason(mode, context.sign, context.dayRuler, context.element),
    },
    actions,
    shadowPrompts,
    warning,
    todayRule: getTodayRule(mode, warning),
  };
}

export function formatGuideText(guide) {
  return [
    "--- DAILY SNAPSHOT ---",
    guide.snapshot,
    "",
    "--- DOMINANT MODE ---",
    `${guide.dominantMode.label}`,
    guide.dominantMode.reason,
    "",
    "--- 3 ACTIONS ---",
    `BODY: ${guide.actions.body}`,
    `MIND: ${guide.actions.mind}`,
    `LIFE: ${guide.actions.life}`,
    "",
    "--- SHADOW PROMPTS ---",
    ...guide.shadowPrompts.map(
      (item, index) => `${index + 1}. ${item.label}: ${item.prompt}`,
    ),
    "",
    "--- WARNING PATTERN ---",
    `LIKELY TODAY: ${guide.warning.likelyToday}`,
    `CORRECTION: ${guide.warning.correction}`,
    "",
    "--- TODAY'S RULE ---",
    guide.todayRule,
  ].join("\n");
}

export function buildHistorySummary(guide) {
  return `${guide.dominantMode.label} - ${guide.warning.likelyToday}`;
}

export const GUIDE_SCHEMA = {
  name: "daily_astrology_guide",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      snapshot: { type: "string" },
      dominantMode: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: {
            type: "string",
            enum: ["THINK", "ACT", "FEEL", "EXPRESS", "TRANSFORM"],
          },
          reason: { type: "string" },
        },
        required: ["label", "reason"],
      },
      actions: {
        type: "object",
        additionalProperties: false,
        properties: {
          body: { type: "string" },
          mind: { type: "string" },
          life: { type: "string" },
        },
        required: ["body", "mind", "life"],
      },
      shadowPrompts: {
        type: "array",
        minItems: 5,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            label: {
              type: "string",
              enum: ["AVOIDANCE", "PATTERN", "FEAR", "SABOTAGE", "RELATIONAL"],
            },
            prompt: { type: "string" },
          },
          required: ["label", "prompt"],
        },
      },
      warning: {
        type: "object",
        additionalProperties: false,
        properties: {
          likelyToday: { type: "string" },
          correction: { type: "string" },
        },
        required: ["likelyToday", "correction"],
      },
      todayRule: { type: "string" },
    },
    required: ["snapshot", "dominantMode", "actions", "shadowPrompts", "warning", "todayRule"],
  },
};
