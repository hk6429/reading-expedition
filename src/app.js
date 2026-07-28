import { demoAnswerKeys } from "./data/demo-answer-key.js";
import { demoDailyReadings } from "./data/demo-daily.js";
import { demoReadingsById } from "./data/demo-readings.js";
import {
  gradeAssessment,
} from "./domain/assessment-session.js";
import {
  rewardVerifiedReading,
} from "./domain/city.js";
import { createAnonymousDeviceId } from "./domain/device-identity.js";
import { createReadingSession } from "./domain/reading-session.js";
import { createLocalStore } from "./storage/local-store.js";
import { renderAssessment } from "./ui/assessment-view.js";
import { renderCityInvest } from "./ui/city-view.js";
import { renderHome } from "./ui/home-view.js";
import { renderReading } from "./ui/reading-view.js";
import { createRouter } from "./ui/router.js";

const main = document.querySelector("#main-content");
const store = createLocalStore(window.localStorage, {
  createDeviceId: createAnonymousDeviceId,
});
const state = store.load();
store.save(state);
const session = createReadingSession(state, (next) => store.save(next));

async function loadDaily() {
  try {
    const response = await fetch("/api/v1/daily");
    if (!response.ok) throw new Error("daily API unavailable");
    const payload = await response.json();
    return payload.readings;
  } catch {
    return demoDailyReadings;
  }
}

async function loadReading(id) {
  try {
    const response = await fetch(`/api/v1/readings/${id}`);
    if (!response.ok) throw new Error("reading API unavailable");
    const payload = await response.json();
    return payload.reading;
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

const router = createRouter({
  async onHome() {
    renderHome(main, await loadDaily());
  },
  async onRead(id) {
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
    renderReading(main, reading, {
      state,
      saveState: (next) => store.save(next),
      session,
    });
  },
  async onQuiz(id) {
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
        const reward = rewardVerifiedReading({
          completed: true,
          evidenceSubmitted: true,
          correctCount: firstCorrect,
          revisedCount,
          repeatedSameDay,
        });
        state.city.materials.inkBricks += reward.inkBricks;
        state.completedReadings[reading.id] = {
          date,
          version: reading.version,
          reward: reward.inkBricks,
          evidenceSubmitted: true,
        };
        store.save(state);
        window.location.hash = `#/city/invest/${reading.id}`;
      },
    });
  },
  async onCityInvest(id) {
    const completion = state.completedReadings[id];
    if (!completion) {
      window.location.hash = `#/read/${id}`;
      return;
    }
    renderCityInvest(main, state, {
      readingId: id,
      earnedInkBricks: completion.reward,
      date: completion.date,
      saveState: (next) => store.save(next),
    });
  },
});

await router.navigate();
document.documentElement.dataset.appReady = "true";
