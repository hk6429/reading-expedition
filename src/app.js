import { demoDailyReadings } from "./data/demo-daily.js";
import { demoReadingsById } from "./data/demo-readings.js";
import { createReadingSession } from "./domain/reading-session.js";
import { createAnonymousDeviceId } from "./domain/device-identity.js";
import { createLocalStore } from "./storage/local-store.js";
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
    main.replaceChildren();
    const panel = document.createElement("section");
    panel.className = "paper-panel";
    panel.innerHTML = `
      <p class="chapter-label">過關問答</p>
      <h1>帶回兩份文證</h1>
      <p>讀卷編號：${id}</p>
      <a href="#/read/${id}">返回文章</a>
    `;
    main.append(panel);
  },
});

await router.navigate();
document.documentElement.dataset.appReady = "true";
