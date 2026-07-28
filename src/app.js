import { demoDailyReadings } from "./data/demo-daily.js";
import { renderHome } from "./ui/home-view.js";
import { createRouter } from "./ui/router.js";

const main = document.querySelector("#main-content");

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

const router = createRouter({
  async onHome() {
    renderHome(main, await loadDaily());
  },
  async onRead(id) {
    main.replaceChildren();
    const panel = document.createElement("section");
    panel.className = "paper-panel";
    panel.innerHTML = `
      <p class="chapter-label">展卷準備中</p>
      <h1>已選定今日讀卷</h1>
      <p>讀卷編號：${id}</p>
      <a href="#/">返回三條航線</a>
    `;
    main.append(panel);
  },
});

await router.navigate();
document.documentElement.dataset.appReady = "true";
