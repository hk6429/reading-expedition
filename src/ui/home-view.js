import { groupDailyRoutes } from "../domain/daily-routes.js";
import { createRouteCard } from "./route-card.js";

export function renderHome(container, readings) {
  const routes = groupDailyRoutes(readings);
  container.replaceChildren();
  container.className = "home-view";

  const hero = document.createElement("section");
  hero.className = "home-hero";
  hero.setAttribute("aria-labelledby", "today-heading");
  hero.innerHTML = `
    <div class="hero-copy">
      <p class="chapter-label">今日十刻遠征</p>
      <h1 id="today-heading">今天，想從哪裡讀懂世界？</h1>
      <p class="hero-lead">
        不必一口氣讀完整座梁山。選一條航線，帶回一份可信的知識，就能讓浮城亮起一盞燈。
      </p>
      <div class="today-status" aria-label="今日任務狀態">
        <span>今日只需完成一篇</span>
        <span>約 6–10 分鐘</span>
        <span>中斷不會歸零</span>
      </div>
    </div>
    <div class="floating-city-preview" aria-hidden="true">
      <div class="ink-moon"></div>
      <div class="mountain mountain-back"></div>
      <div class="mountain mountain-front"></div>
      <div class="city-tower"></div>
      <div class="city-light light-one"></div>
      <div class="city-light light-two"></div>
      <span class="city-caption">萬卷浮城・初築</span>
    </div>
  `;

  const routeSection = document.createElement("section");
  routeSection.className = "route-section";
  routeSection.setAttribute("aria-labelledby", "routes-heading");
  routeSection.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">三路同行</p>
        <h2 id="routes-heading">選一卷，今天就算出發</h2>
      </div>
      <p>行舟卷有詞語與段落提示；登樓卷加入更多資料與觀點。</p>
    </div>
  `;

  const grid = document.createElement("div");
  grid.className = "route-grid";
  for (const route of routes) grid.append(createRouteCard(route));
  routeSection.append(grid);

  container.append(hero, routeSection);
}
