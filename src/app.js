import { demoAnswerKeys } from "./data/demo-answer-key.js";
import { demoDailyReadings } from "./data/demo-daily.js";
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
import { growReadingAbilities } from "./domain/ability-growth.js";
import { createAnonymousDeviceId } from "./domain/device-identity.js";
import {
  appendVerifiedReading,
  extractEvidenceText,
} from "./domain/reading-history.js";
import { createReadingSession } from "./domain/reading-session.js";
import { createLocalStore } from "./storage/local-store.js";
import { createSyncQueue } from "./storage/sync-queue.js";
import { createClassContributionQueue } from "./storage/class-contribution-queue.js";
import { renderAssessment } from "./ui/assessment-view.js";
import { renderCityInvest } from "./ui/city-view.js";
import { renderCityOverview } from "./ui/city-overview.js";
import { renderHome } from "./ui/home-view.js";
import { renderReading } from "./ui/reading-view.js";
import { renderReviewConsole } from "./ui/review-console.js";
import { renderClassView } from "./ui/class-view.js";
import { renderUsageGuide } from "./ui/usage-guide.js";
import { createRouter } from "./ui/router.js";

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
const session = createReadingSession(state, (next) => store.save(next));
const syncQueue = createSyncQueue(window.localStorage);
const classContributionQueue = createClassContributionQueue(window.localStorage);
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
  const mobileControls = document.getElementById("mobile-counter-controls");
  if (counter) counter.style.display = shouldShow ? "" : "none";
  if (mobileControls) mobileControls.style.display = shouldShow ? "" : "none";
  if (counter && shouldShow && mobileControls) counter.style.display = "none";
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

async function loadDaily() {
  const safeDemoReadings = demoDailyReadings.filter(
    ({ id }) => demoReadingsById[id],
  );
  try {
    const response = await fetch("/api/v1/daily");
    if (!response.ok) throw new Error("daily API unavailable");
    const payload = await response.json();
    return Array.isArray(payload.readings) && payload.readings.length
      ? payload.readings
      : safeDemoReadings;
  } catch {
    return safeDemoReadings;
  }
}

async function loadReading(id) {
  try {
    const response = await fetch(`/api/v1/readings/${id}`);
    if (!response.ok) throw new Error("reading API unavailable");
    const payload = await response.json();
    return withDemoReadingStrategy(payload.reading);
  } catch {
    return demoReadingsById[id] ?? null;
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
    const answerKey = demoAnswerKeys[reading.id];
    if (!answerKey) throw new Error("assessment unavailable");
    return gradeAssessment(answerKey, answers);
  }
}

function taipeiToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function exportLearningState() {
  const payload = store.export();
  if (!payload) return;
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `梁山閱征記-${taipeiToday()}.json`;
  link.click();
  URL.revokeObjectURL(url);
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
  async onHome() {
    setPublicCounterVisible(true);
    renderHome(
      main,
      await loadDaily(),
      state.completedReadings,
      state.readingHistory,
    );
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
          <a href="#/">返回三條航線</a>
        </section>
      `;
      return;
    }
    queueEvent("reading_opened", reading);
    renderReading(main, reading, {
      state,
      saveState: (next) => store.save(next),
      session,
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
      onComplete: ({ firstResults, finalResults }) => {
        const date = taipeiToday();
        const previous = state.completedReadings[reading.id];
        const repeatedSameDay = previous?.date === date;
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
          state.abilityGrowth = growReadingAbilities(state.abilityGrowth, {
            completed: true,
            evidenceSubmitted: true,
            revisedCount,
          });
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
        };
        queueEvent("assessment_submitted", reading);
        queueEvent("reading_completed", reading);
        queueEvent("evidence_located", reading);
        if (revisedCount > 0) queueEvent("answer_revised", reading);
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
        store.save(state);
        flushEvents();
        flushClassContributions();
        window.location.hash = `#/city/invest/${reading.id}`;
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
      saveState: (next) => store.save(next),
    });
  },
  async onCity() {
    setPublicCounterVisible(true);
    renderCityOverview(main, state, {
      saveState: (next) => store.save(next),
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
});

await router.navigate();
document.documentElement.dataset.appReady = "true";
