import { ABILITY_EQUIPMENT } from "../domain/ability-mastery.js";
import { resolveHistoryChapterProgress } from "../domain/active-days.js";
import {
  CONTENT_CATEGORIES,
  DAILY_INTENTS,
  READER_IDENTITIES,
  TIME_BUDGETS,
  WEEKLY_TARGETS,
  CITY_THEMES,
  deriveMissionProgress,
  updateGamificationProfile,
} from "../domain/gamification-profile.js";
import {
  STORY_ACTIVE_DAYS,
  journeyRewardForActiveDay,
} from "../domain/journey-progression.js";

const LABELS = Object.freeze({
  identity: Object.freeze({
    explorer: ["探索者", "從好奇出發，看看文章帶你到哪裡"],
    scout: ["偵察者", "留意關鍵線索，查清楚再判斷"],
    curator: ["策展者", "收藏文證，把知識整理成自己的地圖"],
  }),
  intent: Object.freeze({
    comprehension: ["找主旨", "抓住文章最重要的意思"],
    inference: ["推論", "把不同線索連起來"],
    evidence: ["找文證", "回到原文指出支持判斷的句子"],
  }),
  category: Object.freeze({
    any: ["不限類別", "由下一篇未完成讀卷開始"],
    world: ["世界議題", "理解生活與公共議題"],
    science: ["自然科學", "閱讀現象、數據與解釋"],
    humanities: ["人文故事", "理解人物、文化與觀點"],
  }),
  theme: Object.freeze({
    dawn: ["晨曦紙城", "溫暖明亮的晨色"],
    forest: ["森綠書城", "安靜沉著的綠意"],
    night: ["星夜墨城", "深色星光的夜景"],
  }),
});

const TIME_OPTIONS = Object.freeze([
  [5, "5 分鐘", "讀一小段"],
  [10, "10 分鐘", "完成一篇"],
  [15, "15 分鐘", "閱讀並回看文證"],
]);

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function makeChoice({ label, description, selected, onSelect }) {
  const button = makeElement("button", `reading-choice${selected ? " is-selected" : ""}`);
  button.type = "button";
  button.setAttribute("aria-pressed", String(selected));
  button.append(
    makeElement("strong", "", label),
    makeElement("small", "", description),
  );
  button.addEventListener("click", onSelect);
  return button;
}

function makeChoiceGroup({ title, description, choices, value, onSelect }) {
  const fieldset = makeElement("fieldset", "mission-choice-group");
  fieldset.append(makeElement("legend", "", title));
  if (description) fieldset.append(makeElement("p", "", description));
  const options = makeElement("div", "reading-level-choices");
  for (const [id, label, copy] of choices) {
    options.append(
      makeChoice({
        label,
        description: copy,
        selected: id === value,
        onSelect: () => onSelect(id),
      }),
    );
  }
  fieldset.append(options);
  return fieldset;
}

function makeProgress(label, { completed, target, percent }) {
  const wrapper = makeElement("div", "mission-progress");
  const summary = makeElement(
    "p",
    "goal-progress",
    target === 0
      ? `${label}：本週休息；已自由閱讀 ${completed} 篇，不形成缺口`
      : `${label}：${completed}／${target}`,
  );
  const bar = makeElement("div", "ability-track");
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-label", `${label}進度`);
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", String(target || 1));
  bar.setAttribute("aria-valuenow", String(target ? Math.min(completed, target) : 0));
  if (target === 0) bar.setAttribute("aria-valuetext", "本週選擇休息，不計缺口");
  const fill = makeElement("span");
  fill.style.width = `${percent}%`;
  bar.append(fill);
  wrapper.append(summary, bar);
  return wrapper;
}

function buildPrologue(commit) {
  const section = makeElement("section", "paper-panel mission-prologue");
  section.setAttribute("aria-labelledby", "mission-prologue-heading");
  section.innerHTML = `
    <p class="chapter-label">任務序章</p>
    <h2 id="mission-prologue-heading">浮城需要的不是最快的人，而是願意找證據的人</h2>
    <p>每次讀懂、回看原文與修正，都會留下自己的學習足跡。這裡不設公開排名，也不會因休息讓進度消失。</p>
    <ol class="mission-prologue__steps">
      <li><strong>第一步：閱讀</strong>——讀懂一篇文章，先說出自己理解的重點。</li>
      <li><strong>第二步：找文證</strong>——回到原文，指出支持判斷的句子。</li>
      <li><strong>第三步：建城</strong>——把閱讀與文證帶回浮城，留下自己的學習建築。</li>
    </ol>
  `;
  const start = makeElement("button", "primary-action", "選擇我的閱讀方式");
  start.type = "button";
  start.addEventListener("click", () => commit({ prologueSeen: true }));
  const skip = makeElement("button", "", "略過序章");
  skip.type = "button";
  skip.addEventListener("click", () => commit({ prologueSeen: true }));
  const actions = makeElement("div", "city-overview__actions");
  actions.append(start, skip);
  section.append(actions);
  return section;
}

function buildTodayPanel(
  profile,
  progress,
  nextChallenge,
  resumeChallenge,
  commit,
) {
  const section = makeElement("section", "paper-panel mission-today");
  section.setAttribute("aria-labelledby", "today-mission-heading");
  section.append(
    makeElement("p", "eyebrow", "可隨時更改，不是能力標籤"),
    makeElement("h2", "", "今天想怎麼讀？"),
  );
  section.querySelector("h2").id = "today-mission-heading";
  section.append(
    makeChoiceGroup({
      title: "我的閱讀者身分",
      description: "只是今天想採取的閱讀姿態，不代表程度高低。",
      choices: READER_IDENTITIES.map((id) => [id, ...LABELS.identity[id]]),
      value: profile.readerIdentity,
      onSelect: (readerIdentity) => commit({ readerIdentity }),
    }),
    makeChoiceGroup({
      title: "今日意圖",
      description: "先選一個想刻意練習的閱讀動作。",
      choices: DAILY_INTENTS.map((id) => [id, ...LABELS.intent[id]]),
      value: profile.dailyIntent,
      onSelect: (dailyIntent) => commit({ dailyIntent }),
    }),
    makeChoiceGroup({
      title: "今天可用時間",
      description: "選 5、10 或 15 分鐘，完成多少都算一次有意義的練習。",
      choices: TIME_OPTIONS.filter(([minutes]) => TIME_BUDGETS.includes(minutes)),
      value: profile.timeBudget,
      onSelect: (timeBudget) => commit({ timeBudget }),
    }),
    makeChoiceGroup({
      title: "內容類別",
      description: "依今天的好奇心選擇；書架仍可自由瀏覽。",
      choices: CONTENT_CATEGORIES.map((id) => [id, ...LABELS.category[id]]),
      value: profile.contentCategory,
      onSelect: (contentCategory) => commit({ contentCategory }),
    }),
  );

  const resume = makeElement("article", "next-unlock personalized-resume");
  resume.append(makeElement("p", "chapter-label", progress.returnMission ? "溫和回歸任務" : "個人化續讀卡"));
  if (progress.returnMission) {
    resume.append(
      makeElement("h3", "", progress.returnMission.title),
      makeElement("p", "", progress.returnMission.message),
    );
  } else {
    const challenge = resumeChallenge?.reading ?? nextChallenge;
    resume.append(
      makeElement("h3", "", challenge ? `接著讀：${challenge.title}` : "今天的讀卷已完成"),
      makeElement(
        "p",
        "",
        resumeChallenge
          ? `上次讀到第 ${resumeChallenge.paragraph + 1} 段，可以從原位置繼續。`
          : `${profile.readerIdentity ? LABELS.identity[profile.readerIdentity][0] : "閱讀者"}・${profile.dailyIntent ? LABELS.intent[profile.dailyIntent][0] : "自由探索"}・${profile.timeBudget ? `${profile.timeBudget} 分鐘` : "自己決定時間"}`,
      ),
    );
  }
  const challenge = resumeChallenge?.reading ?? nextChallenge;
  const actions = makeElement("div", "city-overview__actions");
  const continueLink = makeElement("a", "primary-link", challenge ? "接著讀" : "打開選文書架");
  continueLink.href = challenge ? `#/read/${challenge.id}` : "#/bookshelf";
  const restLink = makeElement("a", "", "今天先休息");
  restLink.href = "#/rest";
  actions.append(continueLink, restLink);
  resume.append(actions);
  section.append(resume);
  return section;
}

function buildWeeklyPanel(profile, progress, commit) {
  const section = makeElement("section", "paper-panel weekly-mission");
  section.setAttribute("aria-labelledby", "weekly-mission-heading");
  section.innerHTML = `
    <p class="eyebrow">自訂節奏</p>
    <h2 id="weekly-mission-heading">這週由我決定想前進多少</h2>
    <p>連續天數不會歸零，也不以完成速度比較。每週都能重新調整。</p>
  `;
  section.append(
    makeChoiceGroup({
      title: "每週閱讀目標",
      description: "選擇適合本週生活的 1、3、5 或 7 篇。",
      choices: WEEKLY_TARGETS.map((target) =>
        target === 0
          ? [target, "本週休息", "不顯示缺口，既有成果完整保留"]
          : [target, `${target} 篇`, "達成後仍可自由閱讀"],
      ),
      value: profile.weeklyTarget,
      onSelect: (weeklyTarget) => commit({ weeklyTarget }),
    }),
    makeChoiceGroup({
      title: "每週能力目標",
      description: "選一項刻意練習，成功與修正都能留下證據。",
      choices: DAILY_INTENTS.map((id) => [id, ...LABELS.intent[id]]),
      value: profile.weeklyAbility,
      onSelect: (weeklyAbility) => commit({ weeklyAbility }),
    }),
    makeProgress("本週閱讀目標", progress.weeklyReading),
    makeProgress(`${LABELS.intent[progress.weeklyAbility.ability][0]}能力目標`, progress.weeklyAbility),
  );
  return section;
}

function nextStoryDay(activeDay) {
  return STORY_ACTIVE_DAYS.find((day) => day > activeDay) ?? 30;
}

function buildGrowthPanel({ readingHistory, abilityMastery, city }) {
  const progress = resolveHistoryChapterProgress(readingHistory);
  const nextDay = Math.min(progress.activeDay + 1, 30);
  const reward = journeyRewardForActiveDay(nextDay);
  const storyDay = nextStoryDay(progress.activeDay);
  const section = makeElement("section", "paper-panel mission-growth");
  section.setAttribute("aria-labelledby", "mission-growth-heading");
  section.innerHTML = `
    <p class="eyebrow">看得見的下一步</p>
    <h2 id="mission-growth-heading">下一個確定獎勵</h2>
    <p>第 ${nextDay} 個活躍日固定獲得「${reward.title}」；不是隨機結果，也不要求連續登入。</p>
    <article class="next-unlock">
      <p class="chapter-label">故事解鎖預覽</p>
      <h3>第 ${storyDay} 個活躍日會開啟新章回</h3>
      <p>故事會等你，不會倒數、不會過期。</p>
    </article>
  `;

  const equipment = makeElement("div", "ability-grid");
  for (const [skill, config] of Object.entries(ABILITY_EQUIPMENT)) {
    const unlocked = abilityMastery?.unlockedEquipment?.includes(config.id) ?? false;
    const card = makeElement("article", `ability-card${unlocked ? " is-unlocked" : ""}`);
    card.append(
      makeElement("p", "eyebrow", unlocked ? "精熟徽章・已獲得" : "精熟徽章・練習中"),
      makeElement("h3", "", config.name),
      makeElement("p", "", `${config.ability}：${config.description}`),
      makeElement("strong", "", "怎麼使用這件裝備"),
      makeElement("p", "", config.action),
      makeElement("small", "", "只和自己的學習證據比較，不設公開排名。"),
    );
    card.dataset.ability = skill;
    equipment.append(card);
  }
  section.append(equipment);

  const archive = makeElement("details", "story-archive");
  archive.append(makeElement("summary", "", "打開故事檔案"));
  const unlocks = city?.storyUnlocks ?? [];
  archive.append(
    makeElement(
      "p",
      "",
      unlocks.length
        ? `已收藏 ${unlocks.length} 個章回：${unlocks.map(({ title }) => title).join("、")}`
        : "完成故事日後，章回會永久收藏在這裡。",
    ),
  );
  section.append(archive);
  return section;
}

function buildCityPanel(profile, city, commit, onExport) {
  const section = makeElement("section", "paper-panel city-personalization");
  section.setAttribute("aria-labelledby", "city-personalization-heading");
  section.append(
    makeElement("p", "eyebrow", "只存在這台裝置"),
    makeElement("h2", "", "替自己的浮城留下名字與樣子"),
  );
  section.querySelector("h2").id = "city-personalization-heading";
  const label = makeElement("label", "city-name-field", "城市名稱");
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 20;
  input.value = profile.cityName;
  input.setAttribute("aria-describedby", "city-name-help");
  label.append(input);
  const help = makeElement("small", "", "名稱只儲存在本機，可隨時更改。");
  help.id = "city-name-help";
  input.addEventListener("change", () => commit({ cityName: input.value }));
  section.append(label, help);
  section.append(
    makeChoiceGroup({
      title: "城市外觀主題",
      description: "三種主題沒有稀有度，選喜歡的就好。",
      choices: CITY_THEMES.map((id) => [id, ...LABELS.theme[id]]),
      value: profile.cityTheme,
      onSelect: (cityTheme) => commit({ cityTheme }),
    }),
  );

  const investments = city?.investments ?? [];
  const roomLabels = Object.freeze({
    world: "世界知識房",
    science: "科學知識房",
    humanities: "人文知識房",
  });
  const roomCounts = Object.fromEntries(
    Object.keys(roomLabels).map((category) => [
      category,
      investments.filter(
        ({ knowledge }) => knowledge?.category === category,
      ).length,
    ]),
  );
  section.append(
    makeElement("h3", "", "知識房間"),
    makeElement(
      "p",
      "",
      investments.length
        ? `已收藏 ${investments.length} 份文證，分別放進三間知識房。`
        : "第一份文證入城後，這裡會整理你收藏的領域與知識。",
    ),
  );
  const rooms = makeElement("div", "knowledge-room-grid");
  for (const [category, labelText] of Object.entries(roomLabels)) {
    const room = makeElement("article", "knowledge-room");
    room.dataset.knowledgeRoom = category;
    room.append(
      makeElement("h4", "", labelText),
      makeElement("p", "", `${roomCounts[category]} 份文證收藏`),
    );
    rooms.append(room);
  }
  section.append(
    rooms,
    makeElement("h3", "", "第二航季"),
    makeElement(
      "p",
      "",
      "30 個活躍日後開啟新的跨領域航圖；原有城市、文證與徽章完整保留。",
    ),
  );
  const exportButton = makeElement("button", "", "匯出學習作品集");
  exportButton.type = "button";
  exportButton.addEventListener("click", () => onExport?.());
  section.append(exportButton);
  return section;
}

export function createMissionDashboard({
  context = "home",
  profile,
  readingHistory = [],
  abilityMastery = {},
  nextChallenge = null,
  resolveNextChallenge = null,
  resumeChallenge = null,
  city = null,
  onProfileChange = () => {},
  onExport,
}) {
  const root = makeElement("div", "mission-dashboard");
  root.setAttribute("aria-live", "polite");
  let current = profile;

  function commit(changes) {
    current = updateGamificationProfile(current, changes);
    onProfileChange(current);
    render();
  }

  function render() {
    const progress = deriveMissionProgress({
      profile: current,
      readingHistory,
      abilityMastery,
    });
    const panels = [];
    if (!current.prologueSeen) panels.push(buildPrologue(commit));
    if (context === "home") {
      const currentChallenge = resolveNextChallenge
        ? resolveNextChallenge(current)
        : nextChallenge;
      panels.push(
        buildTodayPanel(
          current,
          progress,
          currentChallenge,
          resumeChallenge,
          commit,
        ),
        buildWeeklyPanel(current, progress, commit),
      );
    } else {
      panels.push(
        buildGrowthPanel({ readingHistory, abilityMastery, city }),
        buildCityPanel(current, city, commit, onExport),
      );
    }
    root.dataset.cityTheme = current.cityTheme;
    root.replaceChildren(...panels);
  }

  render();
  return root;
}
