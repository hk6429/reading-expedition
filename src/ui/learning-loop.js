import {
  assessmentAxes,
  buildStructureMap,
  createReadingQuest,
  diagnosticCode,
  paragraphWaypoints,
  PREDICTION_CHOICES,
  READING_PLANS,
  READING_STRATEGIES,
  retryCheckpoints,
  reviewSuggestion,
  sourceRadar,
  sourceRadarSummary,
} from "../domain/reading-quest.js";

const TRANSFER_CHOICES = Object.freeze({
  world: ["用相同判準比較另一則公共議題", "檢查另一個消息來源", "向家人說明證據與結論"],
  science: ["在生活中找相同機制", "用圖解說明因果", "比較另一份科學資料"],
  humanities: ["換一個人物觀點重讀", "比較另一段史料", "把判讀方法用在生活故事"],
});

function transferChoicesFor(reading) {
  return TRANSFER_CHOICES[reading.category] ?? TRANSFER_CHOICES.humanities;
}

export function createLearningQuest(reading) {
  return createReadingQuest(reading.id, {
    sessionStorage: window.sessionStorage,
    localStorage: window.localStorage,
    approvedVocabulary: reading.glossary ?? [],
    questionIds: (reading.assessment ?? []).map(({ id }) => id),
    answerChoices: Object.fromEntries(
      (reading.assessment ?? []).map(({ id, options }) => [id, options]),
    ),
    transferChoices: transferChoicesFor(reading),
  });
}

function radioChoice({ name, value, label, checked }) {
  const option = document.createElement("label");
  option.className = "learning-choice";
  const input = document.createElement("input");
  input.type = "radio";
  input.name = name;
  input.value = value;
  input.checked = checked;
  const copy = document.createElement("span");
  copy.textContent = label;
  option.append(input, copy);
  return option;
}

export function createReadingPreparation(reading, quest) {
  const snapshot = quest.snapshot();
  const display = quest.displayPreferences();
  const section = document.createElement("section");
  section.className = "learning-preparation";
  section.setAttribute("aria-labelledby", "learning-preparation-title");
  section.innerHTML = `
    <p class="chapter-label">出發前先定方向</p>
    <h2 id="learning-preparation-title">我的閱讀任務</h2>
    <p>只選一個最接近現在狀態的選項；內容只留在這台裝置，不會上傳自由文字。</p>
    <fieldset data-learning-feature="pre-reading-forecast"><legend>讀前預測</legend><div class="learning-choice-grid" data-choices="prediction"></div></fieldset>
    <fieldset data-learning-feature="reading-strategy"><legend>這次要練的閱讀策略</legend><div class="learning-choice-grid" data-choices="strategy"></div></fieldset>
    <fieldset data-learning-feature="reading-plan"><legend>今天想讀多久</legend><div class="learning-choice-grid" data-choices="plan"></div></fieldset>
    <div class="learning-preparation__tools">
      <button type="button" data-learning-feature="scaffold-fade" aria-pressed="${snapshot.reading.scaffoldsVisible}">${snapshot.reading.scaffoldsVisible ? "淡出段落提示" : "顯示段落提示"}</button>
      <button type="button" data-learning-feature="easy-reading-accessibility" aria-pressed="${display.easyReading}">${display.easyReading ? "關閉易讀模式" : "開啟易讀模式"}</button>
      <button type="button" data-learning-feature="high-contrast-accessibility" aria-pressed="${display.highContrast}">${display.highContrast ? "關閉高對比" : "開啟高對比"}</button>
    </div>
    <p class="learning-announcer" role="status" aria-live="polite"></p>
  `;
  const announcer = section.querySelector(".learning-announcer");
  const predictionGroup = section.querySelector('[data-choices="prediction"]');
  for (const choice of PREDICTION_CHOICES) {
    const option = radioChoice({
      name: `prediction-${reading.id}`,
      value: choice.id,
      label: choice.label,
      checked: snapshot.preparation.prediction === choice.id,
    });
    option.querySelector("input").addEventListener("change", () => {
      quest.choosePrediction(choice.id);
      announcer.textContent = `已記下讀前方向：${choice.label}`;
    });
    predictionGroup.append(option);
  }
  const strategyGroup = section.querySelector('[data-choices="strategy"]');
  for (const strategy of READING_STRATEGIES) {
    const option = radioChoice({
      name: `strategy-${reading.id}`,
      value: strategy.id,
      label: `${strategy.label}：${strategy.cue}`,
      checked: snapshot.preparation.strategy === strategy.id,
    });
    option.querySelector("input").addEventListener("change", () => {
      quest.chooseStrategy(strategy.id);
      announcer.textContent = `本次策略：${strategy.label}`;
    });
    strategyGroup.append(option);
  }
  const planGroup = section.querySelector('[data-choices="plan"]');
  for (const minutes of READING_PLANS) {
    const option = radioChoice({
      name: `plan-${reading.id}`,
      value: String(minutes),
      label: `${minutes} 分鐘`,
      checked: snapshot.preparation.planMinutes === minutes,
    });
    option.querySelector("input").addEventListener("change", () => {
      quest.choosePlan(minutes);
      announcer.textContent = `已選 ${minutes} 分鐘閱讀計畫；不計時，可隨時休息。`;
    });
    planGroup.append(option);
  }
  const scaffoldButton = section.querySelector('[data-learning-feature="scaffold-fade"]');
  scaffoldButton.addEventListener("click", () => {
    const visible = scaffoldButton.getAttribute("aria-pressed") !== "true";
    quest.setScaffoldsVisible(visible);
    scaffoldButton.setAttribute("aria-pressed", String(visible));
    scaffoldButton.textContent = visible ? "淡出段落提示" : "顯示段落提示";
    document.documentElement.dataset.scaffolds = visible ? "on" : "off";
    announcer.textContent = visible ? "段落提示已顯示" : "段落提示已淡出";
  });
  document.documentElement.dataset.scaffolds = snapshot.reading.scaffoldsVisible
    ? "on"
    : "off";
  const easyButton = section.querySelector('[data-learning-feature="easy-reading-accessibility"]');
  document.documentElement.dataset.easyReading = String(display.easyReading);
  easyButton.addEventListener("click", () => {
    const active = easyButton.getAttribute("aria-pressed") !== "true";
    quest.setDisplayPreference("easyReading", active);
    easyButton.setAttribute("aria-pressed", String(active));
    easyButton.textContent = active ? "關閉易讀模式" : "開啟易讀模式";
    document.documentElement.dataset.easyReading = String(active);
    announcer.textContent = active ? "易讀模式已開啟" : "易讀模式已關閉";
  });
  const contrastButton = section.querySelector('[data-learning-feature="high-contrast-accessibility"]');
  document.documentElement.dataset.learningContrast = display.highContrast
    ? "high"
    : "normal";
  contrastButton.addEventListener("click", () => {
    const active = contrastButton.getAttribute("aria-pressed") !== "true";
    quest.setDisplayPreference("highContrast", active);
    contrastButton.setAttribute("aria-pressed", String(active));
    contrastButton.textContent = active ? "關閉高對比" : "開啟高對比";
    document.documentElement.dataset.learningContrast = active ? "high" : "normal";
    announcer.textContent = active ? "高對比模式已開啟" : "高對比模式已關閉";
  });
  return section;
}

export function createSpeechControls(reading) {
  const controls = document.createElement("div");
  controls.className = "speech-controls";
  controls.innerHTML = `
    <span data-learning-feature="speech-reader" class="visually-hidden">瀏覽器語音朗讀</span>
    <button type="button" data-action="start">朗讀</button>
    <button type="button" data-action="pause" disabled>暫停</button>
    <button type="button" data-action="stop" disabled>停止</button>
    <span role="status" aria-live="polite"></span>
  `;
  const start = controls.querySelector('[data-action="start"]');
  const pause = controls.querySelector('[data-action="pause"]');
  const stop = controls.querySelector('[data-action="stop"]');
  const status = controls.querySelector('[role="status"]');
  const synthesis = window.speechSynthesis;
  if (!synthesis || typeof window.SpeechSynthesisUtterance !== "function") {
    start.disabled = true;
    start.textContent = "此瀏覽器不支援朗讀";
    return controls;
  }
  let utterance = null;
  function reset(message = "朗讀已停止") {
    start.disabled = false;
    pause.disabled = true;
    pause.textContent = "暫停";
    stop.disabled = true;
    status.textContent = message;
    utterance = null;
  }
  start.addEventListener("click", () => {
    synthesis.cancel();
    utterance = new SpeechSynthesisUtterance(
      `${reading.title}。${reading.body.map((paragraph) => typeof paragraph === "string" ? paragraph : paragraph?.text ?? "").join("\n")}`,
    );
    utterance.lang = "zh-TW";
    utterance.rate = 0.95;
    utterance.addEventListener("end", () => reset("朗讀完成"));
    utterance.addEventListener("error", () => reset("朗讀暫時無法使用"));
    synthesis.speak(utterance);
    start.disabled = true;
    pause.disabled = false;
    stop.disabled = false;
    status.textContent = "正在朗讀文章";
  });
  pause.addEventListener("click", () => {
    if (synthesis.paused) {
      synthesis.resume();
      pause.textContent = "暫停";
      status.textContent = "繼續朗讀";
    } else {
      synthesis.pause();
      pause.textContent = "繼續";
      status.textContent = "朗讀已暫停";
    }
  });
  stop.addEventListener("click", () => {
    synthesis.cancel();
    reset();
  });
  window.addEventListener(
    "hashchange",
    () => {
      if (!utterance) return;
      synthesis.cancel();
      reset();
    },
    { once: true },
  );
  return controls;
}

export function createParagraphToolkit(reading, index, quest, onChange) {
  const snapshot = quest.snapshot();
  const waypoint = paragraphWaypoints(reading)[index];
  const toolbar = document.createElement("div");
  toolbar.className = "paragraph-toolkit";
  toolbar.innerHTML = `
    <span data-learning-feature="paragraph-waypoint">路標：${waypoint}</span>
    <button type="button" data-learning-feature="paragraph-flag" aria-pressed="${snapshot.reading.completedParagraphs.includes(index)}">${snapshot.reading.completedParagraphs.includes(index) ? "本段已讀" : "標記本段完成"}</button>
    <button type="button" data-learning-feature="paragraph-focus" aria-pressed="${snapshot.reading.focusParagraph === index}">${snapshot.reading.focusParagraph === index ? "離開焦點" : "只看本段"}</button>
  `;
  const flag = toolbar.querySelector('[data-learning-feature="paragraph-flag"]');
  flag.addEventListener("click", () => {
    quest.toggleParagraph(index, reading.body.length);
    onChange?.();
  });
  const focus = toolbar.querySelector('[data-learning-feature="paragraph-focus"]');
  focus.addEventListener("click", () => {
    quest.focusParagraph(index, reading.body.length);
    onChange?.();
  });
  return toolbar;
}

export function createVocabularyAction(item, quest) {
  const template = document.createElement("div");
  template.innerHTML = '<button type="button" class="vocabulary-action" data-learning-feature="vocabulary-bag"></button>';
  const button = template.firstElementChild;
  const stored = quest.vocabularyBag().some(({ term }) => term === item.term);
  button.textContent = stored ? "已收進詞彙袋" : "收進詞彙袋";
  button.disabled = stored;
  button.addEventListener("click", () => {
    quest.collectVocabulary(item);
    button.textContent = "已收進詞彙袋";
    button.disabled = true;
  });
  return button;
}

export function createReadingInsights(reading) {
  const radarSummary = sourceRadarSummary(reading);
  const section = document.createElement("section");
  section.className = "reading-insights";
  section.innerHTML = `
    <div data-learning-feature="structure-map"><h2>文章結構圖</h2><p></p></div>
    <div data-learning-feature="source-radar"><h2>來源雷達</h2><p class="source-radar-summary"></p><ul></ul></div>
  `;
  section.querySelector('[data-learning-feature="structure-map"] p').textContent =
    buildStructureMap(reading);
  section.querySelector(".source-radar-summary").textContent =
    `來源共 ${radarSummary.total} 筆・發布者 ${radarSummary.publishers.length} 個・資料類型 ${radarSummary.dataTypes.length} 種`;
  const sources = section.querySelector('[data-learning-feature="source-radar"] ul');
  for (const source of sourceRadar(reading)) {
    const item = document.createElement("li");
    const heading = document.createElement("strong");
    heading.textContent = `發布者：${source.publisher}`;
    const details = document.createElement("span");
    details.textContent = `資料類型：${source.dataType}｜網域：${source.host}｜授權：${source.license}｜${source.checks.join("、")}`;
    item.append(heading, details);
    sources.append(item);
  }
  return section;
}

export function createMidpointCheck(quest) {
  const template = document.createElement("div");
  template.innerHTML = `
    <aside class="learning-midpoint" data-learning-feature="midpoint-check">
    <strong>中途檢核</strong>
    <p>停一下：我能指出目前哪一段最接近文章主旨嗎？</p>
    <button type="button">可以，繼續讀</button>
    <span role="status" aria-live="polite"></span>
    </aside>
  `;
  const section = template.firstElementChild;
  const button = section.querySelector("button");
  const status = section.querySelector("span");
  if (quest.snapshot().reading.midpointChecked) {
    button.disabled = true;
    button.textContent = "已完成中途檢核";
  }
  button.addEventListener("click", () => {
    quest.markMidpointChecked();
    button.disabled = true;
    button.textContent = "已完成中途檢核";
    status.textContent = "很好，帶著剛才找到的主旨繼續讀。";
  });
  return section;
}

export function createCompletionMap(reading, quest) {
  const template = document.createElement("div");
  template.innerHTML = '<section class="reading-completion-map" data-learning-feature="completion-map"></section>';
  const section = template.firstElementChild;
  section.setAttribute("aria-live", "polite");
  const title = document.createElement("h2");
  title.textContent = "我的閱讀完成地圖";
  const list = document.createElement("ol");
  const update = () => {
    const completed = new Set(quest.snapshot().reading.completedParagraphs);
    list.replaceChildren(
      ...paragraphWaypoints(reading).map((label, index) => {
        const item = document.createElement("li");
        item.textContent = `第 ${index + 1} 段・${label}・${completed.has(index) ? "已標記" : "待確認"}`;
        return item;
      }),
    );
  };
  update();
  section.append(title, list);
  section.update = update;
  return section;
}

function hintCopy(type, level) {
  const skill = {
    comprehension: "先刪去只談細節、沒有涵蓋全文的選項。",
    inference: "分開『原文明說』和『根據線索可推得』。",
    evidence: "先找能直接支持選項的句子，不只找相同詞。",
  }[type] ?? "先回到題幹，圈出要找的訊息。";
  return level === 1 ? skill : "回到你定位的段落，逐句和每個選項比對。";
}

export function createAssessmentGuidance(reading, item, quest, onEvidenceChange) {
  const saved = quest.snapshot().assessment;
  const panel = document.createElement("section");
  panel.className = "assessment-guidance";
  panel.innerHTML = `
    <fieldset data-learning-feature="confidence-scale"><legend>作答前，我有多確定？</legend><div class="confidence-grid"></div></fieldset>
    <div data-learning-feature="hint-ladder"><strong>提示階梯</strong><div class="hint-actions"><button type="button" data-level="1">提示一：想策略</button><button type="button" data-level="2">提示二：回原文</button></div><p aria-live="polite"></p></div>
    <label data-learning-feature="evidence-first">先定位文證段落，再選答案<select><option value="">選擇段落</option></select></label>
    <p data-learning-feature="preserved-answer" class="preserved-answer" role="status">答案與上列選擇只保留在本次閱讀；返回文章後仍可繼續。</p>
  `;
  const confidence = panel.querySelector(".confidence-grid");
  for (const [value, label] of [[1, "還不確定"], [2, "有一點把握"], [3, "大致確定"], [4, "很有把握"]]) {
    const choice = radioChoice({
      name: `confidence-${item.id}`,
      value: String(value),
      label,
      checked: saved.confidence[item.id] === value,
    });
    choice.querySelector("input").addEventListener("change", () =>
      quest.setConfidence(item.id, value),
    );
    confidence.append(choice);
  }
  const hintStatus = panel.querySelector('[data-learning-feature="hint-ladder"] p');
  for (const button of panel.querySelectorAll("[data-level]")) {
    button.addEventListener("click", () => {
      const level = Number(button.dataset.level);
      quest.revealHint(item.id, level);
      hintStatus.textContent = hintCopy(item.type, level);
    });
  }
  const select = panel.querySelector("select");
  reading.body.forEach((_paragraph, index) => {
    const option = document.createElement("option");
    option.value = String(index + 1);
    option.textContent = `第 ${index + 1} 段`;
    select.append(option);
  });
  select.value = String(saved.evidenceParagraphs[item.id] ?? "");
  select.addEventListener("change", () => {
    if (!select.value) return;
    quest.locateEvidence(item.id, Number(select.value), reading.body.length);
    onEvidenceChange?.(true);
  });
  return panel;
}

export function createCorrectionDrawer(item, result) {
  const wrapper = document.createElement("div");
  wrapper.className = "correction-support";
  wrapper.innerHTML = `
    <p data-learning-feature="diagnostic-code"><strong>錯誤類型：</strong>${diagnosticCode(item?.type)}</p>
    <details data-learning-feature="correction-drawer"><summary>打開修正抽屜</summary><ol><li>回到剛才定位的段落。</li><li>找出選項與原文不一致的詞。</li><li>換一個選項，再用文證檢查。</li></ol></details>
  `;
  if (result.correct) wrapper.hidden = true;
  return wrapper;
}

export function restoreAssessmentAnswer(question, item, quest) {
  const answer = quest.snapshot().assessment.answers[item.id];
  if (!answer) return;
  const input = [...question.querySelectorAll('input[type="radio"]')].find(
    (candidate) => candidate.value === answer,
  );
  if (input) input.checked = true;
}

export function createAssessmentReport({
  reading,
  firstResults,
  finalResults,
  evidenceViewedIds,
  outcome,
  quest,
  onTransferChange = () => {},
}) {
  const report = document.createElement("section");
  report.className = "learning-result-report";
  report.innerHTML = `
    <div data-learning-feature="three-axis-result"><h3>三軸學習結果</h3><ul></ul></div>
    <p data-learning-feature="revision-growth"></p>
    <p data-learning-feature="evidence-viewed"></p>
    <fieldset data-learning-feature="transfer-task"><legend>把方法帶到下一次</legend><div class="learning-choice-grid"></div></fieldset>
    <div data-learning-feature="spaced-review"><h3>間隔複習建議</h3><ul></ul></div>
    <div data-learning-feature="retry-checkpoint" ${outcome.passed ? "hidden" : ""}><h3>重試檢查點</h3><ol></ol></div>
  `;
  const retryList = report.querySelector('[data-learning-feature="retry-checkpoint"] ol');
  for (const checkpoint of retryCheckpoints(reading.assessment, finalResults)) {
    const item = document.createElement("li");
    item.dataset.itemId = checkpoint.id;
    item.textContent = checkpoint.instruction;
    retryList.append(item);
  }
  const axes = assessmentAxes(
    reading.assessment,
    firstResults,
    finalResults,
    evidenceViewedIds,
  );
  const labels = { comprehension: "理解", inference: "推論", evidence: "文證" };
  const axisList = report.querySelector('[data-learning-feature="three-axis-result"] ul');
  for (const [key, value] of Object.entries(axes)) {
    const item = document.createElement("li");
    item.textContent = `${labels[key]}：${value.correct}／${value.total}${value.revised ? `・修正進步 ${value.revised} 題` : ""}`;
    axisList.append(item);
  }
  const revised = firstResults.filter(
    (item, index) => !item.correct && finalResults[index]?.correct,
  ).length;
  report.querySelector('[data-learning-feature="revision-growth"]').textContent =
    revised > 0
      ? `你靠回讀與修正多答對 ${revised} 題；這是策略成長，不只是分數增加。`
      : "這次先留下判讀軌跡；下次可從最需要的能力軸繼續。";
  report.querySelector('[data-learning-feature="evidence-viewed"]').textContent =
    `本次主動查看 ${evidenceViewedIds.length} 題文證。`;
  const transferGroup = report.querySelector('[data-learning-feature="transfer-task"] div');
  const selectedTransfer = quest.snapshot().assessment.transferChoice;
  for (const choice of transferChoicesFor(reading)) {
    const option = radioChoice({
      name: `transfer-${reading.id}`,
      value: choice,
      label: choice,
      checked: selectedTransfer === choice,
    });
    option.querySelector("input").addEventListener("change", () => {
      quest.chooseTransfer(choice);
      onTransferChange({ transferCompleted: true });
    });
    transferGroup.append(option);
  }
  const today = new Date().toISOString().slice(0, 10);
  const reviewList = report.querySelector('[data-learning-feature="spaced-review"] ul');
  for (const [index, date] of reviewSuggestion(today).entries()) {
    const item = document.createElement("li");
    item.textContent = `${["明日回想", "三日後比對", "一週後遷移"][index]}・${date}`;
    reviewList.append(item);
  }
  return report;
}
