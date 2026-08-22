const SESSION_PREFIX = "reading-expedition:quest:";
const VOCABULARY_KEY = "reading-expedition:vocabulary-bag";
const DISPLAY_KEY = "reading-expedition:learning-display";

export const PREDICTION_CHOICES = Object.freeze([
  { id: "confirm", label: "我想確認原本的想法" },
  { id: "discover", label: "我有一點線索，想找完整答案" },
  { id: "explore", label: "我還不確定，先探索文章" },
]);

export const READING_STRATEGIES = Object.freeze([
  { id: "main-idea", label: "抓主旨", cue: "每段找一句最重要的話" },
  { id: "cause-effect", label: "追因果", cue: "圈出原因、變化與結果" },
  { id: "evidence", label: "找文證", cue: "把主張和支持它的句子配對" },
]);

export const READING_PLANS = Object.freeze([5, 10, 15]);

const WAYPOINTS = Object.freeze({
  world: ["先看情境", "比較影響", "整理做法", "形成判準"],
  science: ["先看全貌", "追蹤機制", "連起變化", "整理模型"],
  humanities: ["先看場景", "分清所見", "保留推論", "交叉查證"],
});

export const HIGH_CONTRAST_AA_PALETTE = Object.freeze({
  background: "#ffffff",
  text: "#000000",
  control: "#000000",
  focus: "#003c78",
  chart: "#005a2d",
});

export function paragraphWaypoints(reading) {
  const labels = WAYPOINTS[reading?.category] ?? WAYPOINTS.humanities;
  const total = reading?.body?.length ?? 0;
  return Array.from({ length: total }, (_, index) => {
    const phase = Math.min(
      labels.length - 1,
      Math.floor((index * labels.length) / Math.max(total, 1)),
    );
    return labels[phase];
  });
}

export function buildStructureMap(reading) {
  return paragraphWaypoints(reading)
    .filter((label, index, labels) => index === 0 || label !== labels[index - 1])
    .join(" → ");
}

function inferSourceDataType(source) {
  if (typeof source.dataType === "string" && source.dataType.trim()) {
    return source.dataType.trim().slice(0, 40);
  }
  const identity = `${source.publisher ?? ""} ${source.url ?? ""}`.toLowerCase();
  if (/\.gov\b|政府|氣象署|資料開放/.test(identity)) {
    return "政府公開資料";
  }
  if (/library|museum|archive|典藏|博物館|圖書館/.test(identity)) {
    return "典藏／人文資料";
  }
  if (/nasa|science|research|university|學術|研究/.test(identity)) {
    return "科學／研究資料";
  }
  return "機構公開網頁";
}

export function sourceRadar(reading) {
  return (reading?.sourceAttribution ?? []).map((source) => {
    let host = "無法辨識";
    try {
      host = new URL(source.url).hostname;
    } catch {
      // Invalid source URLs remain visibly unverified instead of being hidden.
    }
    return {
      publisher: source.publisher || "未標示發布單位",
      host,
      license: source.license || "未標示授權",
      dataType: inferSourceDataType(source),
      checks: [
        source.publisher ? "有發布單位" : "發布單位待確認",
        host !== "無法辨識" ? "可追查網址" : "網址待確認",
        source.license ? "有授權說明" : "授權待確認",
      ],
    };
  });
}

export function sourceRadarSummary(reading) {
  const sources = sourceRadar(reading);
  return Object.freeze({
    total: sources.length,
    publishers: [...new Set(sources.map(({ publisher }) => publisher))],
    dataTypes: [...new Set(sources.map(({ dataType }) => dataType))],
  });
}

export function diagnosticCode(type) {
  return (
    {
      comprehension: "重點偏移",
      inference: "推論跨步",
      evidence: "文證失焦",
    }[type] ?? "閱讀線索待整理"
  );
}

export function retryCheckpoints(items, results) {
  const abilityLabels = {
    comprehension: "理解",
    inference: "推論",
    evidence: "文證",
  };
  return results
    .filter(({ correct }) => !correct)
    .map((result) => {
      const item = items.find(({ id }) => id === result.id);
      const ability = abilityLabels[item?.type] ?? "閱讀理解";
      const code = diagnosticCode(item?.type);
      const paragraph = Number(result.evidenceSpan?.paragraph);
      const instruction = Number.isInteger(paragraph) && paragraph > 0
        ? `${ability}・${code}：回到第 ${paragraph} 段，重新比對題目與原文線索。`
        : `${ability}・${code}：依題目提示重新定位文證，再比對選項。`;
      return Object.freeze({
        id: result.id,
        ability,
        code,
        paragraph:
          Number.isInteger(paragraph) && paragraph > 0 ? paragraph : null,
        instruction,
      });
    });
}

function rgbFromHex(hex) {
  if (typeof hex !== "string" || !/^#[0-9a-f]{6}$/i.test(hex)) {
    throw new TypeError("contrast color must be a six-digit hex value");
  }
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
}

function relativeLuminance(hex) {
  const channels = rgbFromHex(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(foreground, background) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function auditHighContrastPalette(palette) {
  const roles = [
    ["文字", "text"],
    ["控制項", "control"],
    ["焦點", "focus"],
    ["圖表", "chart"],
  ];
  const results = roles.map(([role, key]) => {
    const ratio = contrastRatio(palette[key], palette.background);
    return Object.freeze({ role, ratio, passed: ratio >= 4.5 });
  });
  const failed = results.filter(({ passed }) => !passed);
  if (failed.length) {
    throw new Error(
      `WCAG AA contrast failed: ${failed.map(({ role }) => role).join("、")}`,
    );
  }
  return Object.freeze(results);
}

export function assessmentAxes(items, firstResults, finalResults, evidenceViewed = []) {
  const axes = {
    comprehension: { correct: 0, total: 0, revised: 0 },
    inference: { correct: 0, total: 0, revised: 0 },
    evidence: { correct: 0, total: 0, revised: 0, viewed: 0 },
  };
  for (const item of items) {
    const axis = axes[item.type];
    if (!axis) continue;
    const first = firstResults.find(({ id }) => id === item.id);
    const final = finalResults.find(({ id }) => id === item.id);
    axis.total += 1;
    if (final?.correct) axis.correct += 1;
    if (first && !first.correct && final?.correct) axis.revised += 1;
    if (item.type === "evidence" && evidenceViewed.includes(item.id)) {
      axis.viewed += 1;
    }
  }
  return axes;
}

export function reviewSuggestion(dateString) {
  const start = new Date(`${dateString}T12:00:00Z`);
  if (Number.isNaN(start.valueOf())) throw new TypeError("review date is invalid");
  return [1, 3, 7].map((days) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  });
}

function parseObject(storage, key, fallback) {
  try {
    const value = JSON.parse(storage.getItem(key));
    return value && typeof value === "object" ? value : fallback;
  } catch {
    return fallback;
  }
}

function choiceId(value, choices, label) {
  if (!choices.some(({ id }) => id === value)) {
    throw new TypeError(`${label} must be a supported choice`);
  }
  return value;
}

export function createReadingQuest(
  readingId,
  {
    sessionStorage,
    localStorage,
    approvedVocabulary = [],
    questionIds = [],
    answerChoices = {},
    transferChoices = [],
  },
) {
  if (typeof readingId !== "string" || !readingId.trim()) {
    throw new TypeError("readingId is required");
  }
  if (!sessionStorage?.getItem || !sessionStorage?.setItem) {
    throw new TypeError("sessionStorage is required");
  }
  if (!localStorage?.getItem || !localStorage?.setItem) {
    throw new TypeError("localStorage is required");
  }

  const sessionKey = `${SESSION_PREFIX}${readingId}`;
  const session = parseObject(sessionStorage, sessionKey, {});
  session.preparation = {
    prediction: session.preparation?.prediction ?? null,
    strategy: session.preparation?.strategy ?? null,
    planMinutes: session.preparation?.planMinutes ?? null,
  };
  session.reading = {
    completedParagraphs: Array.isArray(session.reading?.completedParagraphs)
      ? session.reading.completedParagraphs
      : [],
    focusParagraph: Number.isInteger(session.reading?.focusParagraph)
      ? session.reading.focusParagraph
      : null,
    scaffoldsVisible: session.reading?.scaffoldsVisible !== false,
    midpointChecked: session.reading?.midpointChecked === true,
  };
  session.assessment = {
    confidence: session.assessment?.confidence ?? {},
    hintLevels: session.assessment?.hintLevels ?? {},
    evidenceParagraphs: session.assessment?.evidenceParagraphs ?? {},
    evidenceViewed: Array.isArray(session.assessment?.evidenceViewed)
      ? session.assessment.evidenceViewed
      : [],
    answers: session.assessment?.answers ?? {},
    transferChoice: session.assessment?.transferChoice ?? null,
  };

  function persist() {
    sessionStorage.setItem(sessionKey, JSON.stringify(session));
  }

  function assertQuestion(itemId) {
    if (!questionIds.includes(itemId)) throw new TypeError("unknown question");
  }

  return Object.freeze({
    choosePrediction(value) {
      session.preparation.prediction = choiceId(
        value,
        PREDICTION_CHOICES,
        "prediction",
      );
      persist();
    },
    chooseStrategy(value) {
      session.preparation.strategy = choiceId(
        value,
        READING_STRATEGIES,
        "strategy",
      );
      persist();
    },
    choosePlan(value) {
      if (!READING_PLANS.includes(value)) {
        throw new TypeError("plan must be 5, 10, or 15 minutes");
      }
      session.preparation.planMinutes = value;
      persist();
    },
    toggleParagraph(index, total) {
      if (!Number.isInteger(index) || index < 0 || index >= total) {
        throw new TypeError("paragraph must be within the reading");
      }
      const completed = new Set(session.reading.completedParagraphs);
      if (completed.has(index)) completed.delete(index);
      else completed.add(index);
      session.reading.completedParagraphs = [...completed].sort((a, b) => a - b);
      persist();
    },
    focusParagraph(index, total) {
      if (index !== null && (!Number.isInteger(index) || index < 0 || index >= total)) {
        throw new TypeError("focus paragraph must be within the reading");
      }
      session.reading.focusParagraph =
        session.reading.focusParagraph === index ? null : index;
      persist();
    },
    setScaffoldsVisible(visible) {
      session.reading.scaffoldsVisible = Boolean(visible);
      persist();
    },
    markMidpointChecked() {
      session.reading.midpointChecked = true;
      persist();
    },
    collectVocabulary(item) {
      const approved = approvedVocabulary.find(
        ({ term, definition }) =>
          term === item?.term && definition === item?.definition,
      );
      if (!approved) throw new TypeError("vocabulary must come from this reading");
      const bag = parseObject(localStorage, VOCABULARY_KEY, []);
      const items = Array.isArray(bag) ? bag : [];
      if (!items.some(({ term }) => term === approved.term)) {
        items.push({ readingId, term: approved.term, definition: approved.definition });
        localStorage.setItem(VOCABULARY_KEY, JSON.stringify(items));
      }
    },
    vocabularyBag() {
      const bag = parseObject(localStorage, VOCABULARY_KEY, []);
      return Array.isArray(bag) ? structuredClone(bag) : [];
    },
    setConfidence(itemId, value) {
      assertQuestion(itemId);
      if (![1, 2, 3, 4].includes(value)) {
        throw new TypeError("confidence must be between 1 and 4");
      }
      session.assessment.confidence[itemId] = value;
      persist();
    },
    revealHint(itemId, level) {
      assertQuestion(itemId);
      if (![1, 2].includes(level)) throw new TypeError("hint level is invalid");
      session.assessment.hintLevels[itemId] = Math.max(
        session.assessment.hintLevels[itemId] ?? 0,
        level,
      );
      persist();
    },
    locateEvidence(itemId, paragraph, totalParagraphs) {
      assertQuestion(itemId);
      if (
        !Number.isInteger(paragraph) ||
        paragraph < 1 ||
        paragraph > totalParagraphs
      ) {
        throw new TypeError("evidence paragraph is invalid");
      }
      session.assessment.evidenceParagraphs[itemId] = paragraph;
      persist();
    },
    markEvidenceViewed(itemId) {
      assertQuestion(itemId);
      if (!session.assessment.evidenceViewed.includes(itemId)) {
        session.assessment.evidenceViewed.push(itemId);
        persist();
      }
    },
    setAnswer(itemId, value) {
      assertQuestion(itemId);
      if (!answerChoices[itemId]?.includes(value)) {
        throw new TypeError("answer must be one of the provided options");
      }
      session.assessment.answers[itemId] = value;
      persist();
    },
    chooseTransfer(value) {
      if (!transferChoices.includes(value)) {
        throw new TypeError("transfer must be a provided choice");
      }
      session.assessment.transferChoice = value;
      persist();
    },
    setDisplayPreference(name, value) {
      if (!["easyReading", "highContrast"].includes(name)) {
        throw new TypeError("display preference is not supported");
      }
      const preferences = parseObject(localStorage, DISPLAY_KEY, {});
      preferences[name] = Boolean(value);
      localStorage.setItem(DISPLAY_KEY, JSON.stringify(preferences));
    },
    displayPreferences() {
      const preferences = parseObject(localStorage, DISPLAY_KEY, {});
      return {
        easyReading: preferences.easyReading === true,
        highContrast: preferences.highContrast === true,
      };
    },
    snapshot() {
      return structuredClone(session);
    },
  });
}

export const READING_QUEST_STORAGE_KEYS = Object.freeze({
  sessionPrefix: SESSION_PREFIX,
  vocabulary: VOCABULARY_KEY,
  display: DISPLAY_KEY,
});
