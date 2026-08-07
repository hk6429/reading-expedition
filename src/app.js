import { demoAnswerKeys } from "./data/demo-answer-key.js";
import { demoDailyReadings } from "./data/demo-daily.js";
import { levelAnswerKeys } from "./data/level-answer-keys.js";
import {
  levelDailyReadings,
  levelReadingsById,
} from "./data/level-readings.js";
import {
  demoReadingsById,
  withDemoReadingStrategy,
} from "./data/demo-readings.js";
import {
  gradeAssessment,
} from "./domain/assessment-session.js";
import {
  rewardVerifiedReading,
} from "./domain/city.js";
import { countHistoryActiveDays } from "./domain/active-days.js";
import { recordAbilityEvidence } from "./domain/ability-mastery.js";
import { buildDiagnosticRecord } from "./domain/family-report.js";
import { createAnonymousDeviceId } from "./domain/device-identity.js";
import {
  appendVerifiedReading,
  extractEvidenceText,
} from "./domain/reading-history.js";
import { createReadingSession } from "./domain/reading-session.js";
import { createLocalStore } from "./storage/local-store.js";
import { createFamilyClient } from "./storage/family-client.js";
import { createSyncQueue } from "./storage/sync-queue.js";
import { createClassContributionQueue } from "./storage/class-contribution-queue.js";
import { renderAssessment } from "./ui/assessment-view.js";
import { renderBookshelf } from "./ui/bookshelf-view.js";
import { renderCityInvest } from "./ui/city-view.js";
import { renderCityOverview } from "./ui/city-overview.js";
import { renderHome } from "./ui/home-view.js";
import { renderReading } from "./ui/reading-view.js";
import { renderReviewConsole } from "./ui/review-console.js";
import { renderClassView } from "./ui/class-view.js";
import { renderFamilyView } from "./ui/family-view.js";
import { renderPlacement } from "./ui/placement-view.js";
import { renderUsageGuide } from "./ui/usage-guide.js";
import { createRouter } from "./ui/router.js";
import { renderBackupReminder } from "./ui/backup-reminder.js";
import { nextUnreadReading } from "./domain/reading-inventory.js";

const main = document.querySelector("#main-content");
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js").catch(() => {
    // 離線能力是漸進增強；註冊失敗不阻擋閱讀。
  });
}
const store = createLocalStore(window.localStorage, {
  createDeviceId: createAnonymousDeviceId,
});
const state = store.load();
document.documentElement.dataset.readingMode = state.preferences.mode;
document.documentElement.style.setProperty(
  "--reading-scale",
  state.preferences.fontScale,
);
store.save(state);
const syncQueue = createSyncQueue(window.localStorage);
const classContributionQueue = createClassContributionQueue(window.localStorage);
const familyClient = createFamilyClient({
  fetchImpl: window.fetch.bind(window),
  storage: window.localStorage,
});
let familySyncTimer = null;

function renderFamilySyncStatus() {
  const chip = document.querySelector("#family-sync-chip");
  const child = familyClient.activeChild();
  if (!chip || !child) {
    if (chip) chip.hidden = true;
    return;
  }
  const sync = familyClient.syncStatus();
  chip.hidden = false;
  chip.dataset.status = sync.status;
  chip.textContent = {
    idle: `${child.alias}・只存本機`,
    pending: `${child.alias}・已存本機，等待同步`,
    synced: `${child.alias}・雲端已同步`,
    conflict: `${child.alias}・另一部裝置有新紀錄，請到家庭護照處理`,
    error: `${child.alias}・已存本機，雲端待重試`,
  }[sync.status] ?? `${child.alias}・同步狀態待確認`;
}

function queueFamilySync(next) {
  if (!familyClient.activeChild()) {
    renderFamilySyncStatus();
    return;
  }
  familyClient.markPending();
  renderFamilySyncStatus();
  window.clearTimeout(familySyncTimer);
  familySyncTimer = window.setTimeout(async () => {
    try {
      await familyClient.syncActiveChild(next);
    } catch {
      // 狀態會保留在本機，並由頁首與家庭護照顯示待處理原因。
    }
    renderFamilySyncStatus();
  }, 900);
}

function persistState(next, { syncFamily = true } = {}) {
  store.save(next);
  if (syncFamily) queueFamilySync(next);
}

const session = createReadingSession(state, persistState);
renderFamilySyncStatus();
if (
  familyClient.activeChild() &&
  ["pending", "error"].includes(familyClient.syncStatus().status)
) {
  queueFamilySync(state);
}
const CLASS_TOKEN_KEY = "reading-expedition.class-token";
const ANONYMOUS_STATISTICS_KEY =
  "reading-expedition.anonymous-statistics";

function anonymousStatisticsEnabled() {
  return window.localStorage.getItem(ANONYMOUS_STATISTICS_KEY) !== "off";
}

function setAnonymousStatisticsEnabled(enabled) {
  window.localStorage.setItem(
    ANONYMOUS_STATISTICS_KEY,
    enabled ? "on" : "off",
  );
  if (enabled) {
    window.readingExpeditionPublicCounter?.load();
    return;
  }
  syncQueue.clear();
  window.readingExpeditionPublicCounter?.remove();
}

function setPublicCounterVisible(visible, focusContext = "") {
  if (focusContext) {
    document.documentElement.setAttribute("data-focus-context", focusContext);
  } else {
    document.documentElement.removeAttribute("data-focus-context");
  }
  const shouldShow = visible && anonymousStatisticsEnabled();
  document.documentElement.dataset.publicCounter = shouldShow ? "show" : "hide";
  const counter = document.getElementById("danai-public-counter");
  if (counter) counter.style.display = shouldShow ? "" : "none";
}

function durationBucket(reading) {
  if (reading.readingMinutes <= 5) return "1-5m";
  if (reading.readingMinutes <= 10) return "6-10m";
  return "over-10m";
}

function queueEvent(type, reading) {
  if (!anonymousStatisticsEnabled()) return;
  syncQueue.enqueue({
    id: crypto.randomUUID(),
    type,
    createdAt: new Date().toISOString(),
    context: {
      contentId: reading.id,
      category: reading.category,
      difficulty: reading.difficulty,
      durationBucket: durationBucket(reading),
      deviceId: state.deviceId,
    },
  });
}

async function flushEvents() {
  if (!anonymousStatisticsEnabled()) {
    syncQueue.clear();
    return;
  }
  await syncQueue.flush(async ({ id: _id, createdAt, ...event }) => {
    const response = await fetch("/api/v1/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        events: [{ ...event, occurredAt: createdAt }],
      }),
    });
    return response.ok;
  });
}

async function flushClassContributions() {
  const token = window.localStorage.getItem(CLASS_TOKEN_KEY);
  if (!token) return;
  await classContributionQueue.flush(async (contribution) => {
    const response = await fetch("/api/v1/classrooms/contribute", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(contribution),
    });
    if (response.status === 401) {
      window.localStorage.removeItem(CLASS_TOKEN_KEY);
      classContributionQueue.clear();
      return true;
    }
    return response.ok;
  });
}

function isoWeekKey(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const year = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((date - yearStart) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

window.addEventListener("online", () => {
  flushEvents();
  flushClassContributions();
});
flushEvents();
flushClassContributions();

function localInventory() {
  const demoInventory = demoDailyReadings.map((reading) => ({
    ...reading,
    level: reading.level ?? "tower",
    supportMode:
      reading.supportMode ??
      (reading.difficulty === "guided" ? "guided" : "independent"),
  }));
  return [...demoInventory, ...levelDailyReadings];
}

async function loadInventory(level) {
  const localReadings = localInventory();
  try {
    const remoteReadings = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const response = await fetch(
        `/api/v1/readings?level=${encodeURIComponent(level)}&page=${page}&pageSize=200`,
      );
      if (!response.ok) throw new Error("inventory API unavailable");
      const payload = await response.json();
      if (!Array.isArray(payload.readings)) break;
      remoteReadings.push(...payload.readings);
      hasMore = Boolean(payload.pagination?.hasMore);
      page += 1;
    }
    return [...new Map(
      [...localReadings, ...remoteReadings].map((reading) => [
        reading.id,
        reading,
      ]),
    ).values()];
  } catch {
    return localReadings;
  }
}

async function loadReading(id) {
  const localReading =
    levelReadingsById[id] ??
    (demoReadingsById[id]
      ? {
          ...demoReadingsById[id],
          level: demoReadingsById[id].level ?? "tower",
          supportMode:
            demoReadingsById[id].supportMode ??
            (demoReadingsById[id].difficulty === "guided"
              ? "guided"
              : "independent"),
        }
      : null);
  try {
    const response = await fetch(`/api/v1/readings/${id}`);
    if (!response.ok) throw new Error("reading API unavailable");
    const payload = await response.json();
    return withDemoReadingStrategy(payload.reading);
  } catch {
    return localReading;
  }
}

async function submitAssessment(reading, answers) {
  try {
    const response = await fetch(
      `/api/v1/readings/${reading.id}/submit`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version: reading.version, answers }),
      },
    );
    if (!response.ok) throw new Error("assessment API unavailable");
    return await response.json();
  } catch {
    const answerKey =
      levelAnswerKeys[reading.id] ?? demoAnswerKeys[reading.id];
    if (!answerKey) throw new Error("assessment unavailable");
    return gradeAssessment(answerKey, answers);
  }
}

function localToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone:
      familyClient.timeZone() ??
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function exportLearningState(personLabel = "個人") {
  const payload = store.export();
  if (!payload) return false;
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safeLabel = String(personLabel)
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "個人";
  link.download = `梁山閱征記-${safeLabel}-${localToday()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}

async function restoreLearningState(file) {
  if (!(file instanceof File) || file.size > 2_000_000) {
    throw new TypeError("invalid learning record file");
  }
  const restored = store.restore(await file.text());
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, restored);
  window.location.reload();
}

const router = createRouter({
  afterRoute() {
    if (
      window.location.hash === "#/family" ||
      window.location.hash.startsWith("#/teacher")
    ) {
      return;
    }
    const activeChild = familyClient.activeChild();
    renderBackupReminder(main, {
      personId: activeChild?.id ?? state.deviceId,
      personLabel: activeChild?.alias ?? "此裝置的閱行者",
      sessionStorage: window.sessionStorage,
      onExport: () =>
        exportLearningState(activeChild?.alias ?? "此裝置"),
    });
  },
  async onHome() {
    setPublicCounterVisible(true);
    const selectedLevel = state.preferences.selectedLevel ?? "launch";
    renderHome(
      main,
      await loadInventory(selectedLevel),
      state.completedReadings,
      state.readingHistory,
      {
        preferences: state.preferences,
        diagnosticHistory: state.diagnosticHistory,
        onPreferencesChange: (preferences, { navigate = true } = {}) => {
          const scrollY = window.scrollY;
          state.preferences = preferences;
          persistState(state);
          if (navigate) {
            router.navigate().then(() => window.scrollTo(0, scrollY));
          }
        },
      },
    );
  },
  async onBookshelf() {
    setPublicCounterVisible(true);
    const selectedLevel = state.preferences.selectedLevel ?? "launch";
    const render = async () => {
      renderBookshelf(
        main,
        await loadInventory(selectedLevel),
        state.completedReadings,
        {
          preferences: state.preferences,
          diagnosticHistory: state.diagnosticHistory,
          onPreferencesChange: (
            preferences,
            { persist = true } = {},
          ) => {
            state.preferences = preferences;
            if (persist) persistState(state);
            router.navigate();
          },
        },
      );
    };
    await render();
  },
  async onRead(id) {
    setPublicCounterVisible(false, "reading");
    const reading = await loadReading(id);
    if (!reading) {
      main.innerHTML = `
        <section class="paper-panel">
          <p class="chapter-label">尚待校閱</p>
          <h1>這份讀卷目前無法開啟</h1>
          <p>內容可能正在修訂或已下架，你的既有城市成果不會消失。</p>
          <a href="#/">返回個人挑戰</a>
        </section>
      `;
      return;
    }
    queueEvent("reading_opened", reading);
    renderReading(main, reading, {
      state,
      saveState: persistState,
      session,
      assessmentAvailableOffline: Boolean(
        levelAnswerKeys[reading.id] ?? demoAnswerKeys[reading.id],
      ),
    });
  },
  async onQuiz(id) {
    setPublicCounterVisible(false, "assessment");
    const reading = await loadReading(id);
    if (!reading) {
      window.location.hash = "#/";
      return;
    }
    renderAssessment(main, reading, {
      submitAnswers: (answers) => submitAssessment(reading, answers),
      requiresConnection: !Boolean(
        levelAnswerKeys[reading.id] ?? demoAnswerKeys[reading.id],
      ),
      onComplete: ({
        firstResults,
        finalResults,
        evidenceViewedIds,
        assessmentOutcome,
      }) => {
        const date = localToday();
        const firstCorrect = firstResults.filter(({ correct }) => correct).length;
        const revisedCount = firstResults.filter(
          (item, index) => !item.correct && finalResults[index]?.correct,
        ).length;
        const evidenceResult =
          finalResults.find((result) => {
            const item = reading.assessment.find(({ id }) => id === result.id);
            return item?.type === "evidence";
          }) ?? finalResults[0];
        const evidenceText =
          extractEvidenceText(reading, evidenceResult?.evidenceSpan) ||
          "已完成文證定位";
        const diagnosticRecord = buildDiagnosticRecord({
          reading,
          date,
          supportMode:
            reading.supportMode ?? state.preferences.supportMode,
          firstResults,
          finalResults,
          evidenceViewedIds,
        });
        const previousAttempts = state.diagnosticHistory.filter(
          (record) => record.readingId === reading.id,
        ).length;
        state.diagnosticHistory = [
          ...state.diagnosticHistory,
          {
            ...diagnosticRecord,
            attemptNumber: previousAttempts + 1,
            completedAt: new Date().toISOString(),
          },
        ];
        queueEvent("assessment_submitted", reading);
        if (revisedCount > 0) queueEvent("answer_revised", reading);
        if (!assessmentOutcome?.passed) {
          persistState(state);
          flushEvents();
          return `#/read/${reading.id}`;
        }
        const previous = state.completedReadings[reading.id];
        const repeatedSameDay = previous?.date === date;
        const historyResult = appendVerifiedReading(state.readingHistory, {
          readingId: reading.id,
          date,
          category: reading.category,
          skill: "evidence",
          title: reading.title,
          evidence: evidenceText,
        });
        state.readingHistory = historyResult.history;
        const totalActiveDays = countHistoryActiveDays(state.readingHistory);
        const activeDay = Math.max(1, Math.min(totalActiveDays, 30));
        const reward = rewardVerifiedReading({
          completed: true,
          evidenceSubmitted: true,
          correctCount: firstCorrect,
          revisedCount,
          repeatedSameDay,
          mainlineReward:
            historyResult.added &&
            historyResult.event.mainlineReward &&
            totalActiveDays <= 30,
          activeDay,
        });
        state.city.materials.inkBricks += reward.inkBricks;
        state.city.materials.fellowshipSeals += reward.fellowshipSeals;
        if (
          reward.rewardType === "story" &&
          !state.city.storyUnlocks.some(
            (unlock) => unlock.activeDay === activeDay,
          )
        ) {
          state.city.storyUnlocks.push({
            activeDay,
            title: reward.rewardTitle,
            date,
          });
        }
        if (historyResult.added) {
          state.abilityMastery = recordAbilityEvidence(
            state.abilityMastery,
            diagnosticRecord,
          );
          state.abilityGrowth = Object.fromEntries(
            Object.entries(state.abilityMastery.skills).map(
              ([skill, progress]) => [
                skill,
                progress.successes.length,
              ],
            ),
          );
        }
        state.completedReadings[reading.id] = {
          date,
          version: reading.version,
          reward: reward.inkBricks,
          rewards: {
            inkBricks: reward.inkBricks,
            fellowshipSeals: reward.fellowshipSeals,
            type: reward.rewardType,
            title: reward.rewardTitle ?? "",
          },
          activeDay,
          evidenceSubmitted: true,
          category: reading.category,
          skill: "理解與文證",
          evidence: evidenceText,
          assessmentPassed: Boolean(assessmentOutcome?.passed),
          firstCorrectCount: firstCorrect,
          finalCorrectCount:
            assessmentOutcome?.correctCount ??
            finalResults.filter(({ correct }) => correct).length,
          requiredCorrectCount:
            assessmentOutcome?.requiredCorrectCount ??
            Math.ceil((finalResults.length * 2) / 3),
        };
        queueEvent("reading_completed", reading);
        queueEvent("evidence_located", reading);
        if (
          !repeatedSameDay &&
          window.localStorage.getItem(CLASS_TOKEN_KEY)
        ) {
          classContributionQueue.enqueue({
            validReading: true,
            contentId: reading.id,
            category: reading.category,
            skill: "evidence",
            period: isoWeekKey(date),
          });
        }
        persistState(state);
        flushEvents();
        flushClassContributions();
        return `#/city/invest/${reading.id}`;
      },
    });
  },
  async onCityInvest(id) {
    setPublicCounterVisible(false);
    const completion = state.completedReadings[id];
    if (!completion) {
      window.location.hash = `#/read/${id}`;
      return;
    }
    const reading = await loadReading(id);
    const inventory = await loadInventory(
      reading?.level ?? state.preferences.selectedLevel ?? "launch",
    );
    const nextReading = nextUnreadReading(
      inventory,
      state.completedReadings,
      {
        level:
          reading?.level ?? state.preferences.selectedLevel ?? "launch",
        supportMode:
          reading?.supportMode ?? state.preferences.supportMode ?? "guided",
        currentReadingId: id,
      },
    );
    renderCityInvest(main, state, {
      readingId: id,
      earnedInkBricks: completion.reward,
      earnedFellowshipSeals: completion.rewards?.fellowshipSeals ?? 0,
      rewardType: completion.rewards?.type ?? "building",
      rewardTitle: completion.rewards?.title ?? "",
      activeDay: completion.activeDay ?? 1,
      reading,
      evidence: completion.evidence,
      date: completion.date,
      assessmentPassed: completion.assessmentPassed ?? true,
      finalCorrectCount: completion.finalCorrectCount ?? 0,
      requiredCorrectCount: completion.requiredCorrectCount ?? 2,
      assessmentTotal: reading?.assessment?.length ?? 3,
      nextReading,
      saveState: persistState,
    });
  },
  async onCity() {
    setPublicCounterVisible(true);
    renderCityOverview(main, state, {
      saveState: persistState,
      exportState: exportLearningState,
      restoreState: restoreLearningState,
    });
  },
  async onTeacher(view, status) {
    setPublicCounterVisible(false);
    await renderReviewConsole(main, {
      initialView: view,
      initialStatus: status,
    });
  },
  async onGuide() {
    setPublicCounterVisible(true);
    renderUsageGuide(main, {
      anonymousStatisticsEnabled: anonymousStatisticsEnabled(),
      onAnonymousStatisticsChange: (enabled) => {
        setAnonymousStatisticsEnabled(enabled);
        setPublicCounterVisible(true);
      },
    });
  },
  async onClass() {
    setPublicCounterVisible(false);
    await renderClassView(main, {
      contributionQueue: classContributionQueue,
    });
  },
  async onPlacement() {
    setPublicCounterVisible(false);
    renderPlacement(main, {
      state,
      saveState: persistState,
    });
  },
  async onFamily() {
    setPublicCounterVisible(false);
    await renderFamilyView(main, {
      familyClient,
      localState: state,
      localStore: store,
      loadLevelInventory: loadInventory,
      exportState: () =>
        exportLearningState(
          familyClient.activeChild()?.alias ?? "此裝置",
        ),
      reload: () => window.location.reload(),
    });
  },
  async onRest() {
    setPublicCounterVisible(true);
    main.className = "rest-view";
    main.innerHTML = `
      <section class="paper-panel rest-panel">
        <p class="chapter-label">今日收卷</p>
        <h1>今天先走到這裡，明天再來</h1>
        <p>你的閱讀進度、每篇答題結果與浮城成果都已保存。休息不是中斷，而是替下一次專心留位置。</p>
        <div class="rest-actions">
          <a class="primary-link" href="#/">回到個人閱讀首頁</a>
          <a href="#/city">查看我的浮城與紀錄</a>
        </div>
      </section>
    `;
  },
});

await router.navigate();
document.documentElement.dataset.appReady = "true";
