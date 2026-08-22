import {
  CLASS_MISSION_CHOICES,
  EXIT_CODES,
  buildClassMission,
  classMissionCelebrationKey,
  chooseAnonymousRole,
  missionTypeDetails,
  normalizeExitCode,
  normalizeMissionChoice,
} from "../domain/class-mission.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const CHOICE_LABELS = Object.freeze({
  shared_readings: "共同篇數",
  category_balance: "類別平衡",
  ability_practice: "能力練習",
});

const EXIT_LABELS = Object.freeze({
  found_evidence: "我找到可支持判斷的文證",
  changed_view: "比較後，我調整了原先看法",
  need_support: "我還需要一個提示或例子",
});

const CATEGORY_LABELS = Object.freeze({
  world: "世界議題",
  science: "自然科學",
  humanities: "人文故事",
});

const SKILL_LABELS = Object.freeze({
  comprehension: "找主旨",
  inference: "推論",
  evidence: "找文證",
});
const ASSIGNMENT_ROUTE_LABELS = Object.freeze({
  guided: "引導路線",
  independent: "獨立路線",
  equivalent: "引導／獨立皆可",
});

function classQuery(hash) {
  return new URLSearchParams(String(hash).split("?")[1] ?? "");
}

function createSeatToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function codeFromClassHash(hash) {
  const code = classQuery(hash).get("code")?.toUpperCase() ?? "";
  return /^[A-Z2-9]{8}$/.test(code) ? code : "";
}

function distributionMarkup(title, distribution, labels, feature) {
  const maximum = Math.max(1, ...Object.values(distribution));
  return `
    <section class="class-mission__balance" data-class-mission-feature="${feature}" aria-label="${title}">
      <h3>${title}</h3>
      <ul>
        ${Object.entries(labels)
          .map(([key, label]) => {
            const value = distribution[key] ?? 0;
            return `<li><span>${label}</span><div role="img" aria-label="${label} ${value} 次"><i style="width:${Math.round((value / maximum) * 100)}%"></i></div><strong>${value}</strong></li>`;
          })
          .join("")}
      </ul>
    </section>
  `;
}

export async function renderClassView(
  root,
  {
    request = fetch,
    storage = window.localStorage,
    contributionQueue = null,
    confirmAction = (message) => window.confirm(message),
    locationHash = window.location.hash,
  } = {},
) {
  let token = storage.getItem("reading-expedition.class-token");
  const projectionMode = classQuery(locationHash).get("project") === "1";

  function showUnavailable(message) {
    root.innerHTML = `
      <section class="class-shell paper-panel class-unavailable" aria-labelledby="class-unavailable-title">
        <p class="chapter-label">匿名席次仍保留</p>
        <h1 id="class-unavailable-title">班級連線暫時中斷</h1>
        <p>${escapeHtml(message)}</p>
        <p>班級席次與尚未送出的共建佇列都留在這部裝置，不必重新輸入班級碼。</p>
        <button type="button" data-retry-class>重新連線</button>
        <a href="#/">先回個人閱讀</a>
      </section>
    `;
    root.querySelector("[data-retry-class]").addEventListener("click", () => {
      showLandmark("已重新連上班級。");
    });
  }

  async function showLandmark(message = "") {
    let response;
    try {
      response = await request("/api/v1/classrooms/landmark", {
        headers: { authorization: `Bearer ${token}` },
      });
    } catch {
      showUnavailable("目前無法連線，請確認網路後再試。");
      return;
    }
    if (!response.ok) {
      if ([401, 403, 410].includes(response.status)) {
        storage.removeItem("reading-expedition.class-token");
        contributionQueue?.clear();
        token = null;
        showJoin("參與權杖已到期，請重新輸入班級碼。");
      } else {
        showUnavailable(`班級服務回應 ${response.status}，稍後可直接重試。`);
      }
      return;
    }
    const aggregate = await response.json();
    const mission = buildClassMission(aggregate);
    const role = chooseAnonymousRole(token, mission.period);
    const details = missionTypeDetails(mission.type);
    const assignment = aggregate.currentAssignment;
    const assignmentMarkup = assignment
      ? `
        <section class="class-mission__current-assignment" aria-labelledby="current-assignment-title">
          <p class="eyebrow">老師目前指派</p>
          <h2 id="current-assignment-title">${escapeHtml(assignment.title)}</h2>
          <p>${escapeHtml(SKILL_LABELS[assignment.ability] ?? assignment.ability)}・${escapeHtml(ASSIGNMENT_ROUTE_LABELS[assignment.route] ?? assignment.route)}・${assignment.dueDate ? `期限 ${escapeHtml(assignment.dueDate)}` : "無期限"}</p>
          <p>期限只協助安排，不扣分、不倒數、不歸零。</p>
          <a class="primary-action" href="#/read/${encodeURIComponent(assignment.readingId)}">開啟指派閱讀</a>
        </section>
      `
      : "";
    const safeStatistics = mission.privacyProtected
      ? `<section class="class-mission__privacy" aria-label="細分統計保護中"><h3>共同進度保護中</h3><p>目前人數尚未達 ${mission.participantThreshold} 人；類別、能力與拼圖片段完全隱藏，避免推回個人。</p></section>`
      : `
          <p>匿名參與 ${Number(aggregate.anonymousParticipants) || 0} 人，共完成 ${Number(aggregate.validReadings) || 0} 次有效閱讀。</p>
          <div class="class-mission__balances">
            ${distributionMarkup("類別平衡圖", mission.categoryDistribution, CATEGORY_LABELS, "category-balance")}
            ${distributionMarkup("能力平衡圖", mission.skillDistribution, SKILL_LABELS, "skill-balance")}
            ${mission.voteDistribution ? distributionMarkup("匿名投票結果", mission.voteDistribution, CHOICE_LABELS, "vote-distribution") : ""}
            ${mission.exitDistribution ? distributionMarkup("匿名觀點牆", mission.exitDistribution, EXIT_LABELS, "exit-distribution") : ""}
          </div>
          <section class="class-mission__jigsaw" aria-labelledby="jigsaw-heading">
            <h3 id="jigsaw-heading">拼圖閱讀</h3>
            <p>每個類別都是共同地圖的一塊；只呈現班級片段，不顯示是誰完成。</p>
            <ul>${Object.entries(CATEGORY_LABELS)
              .map(([key, label]) => `<li class="${mission.categoryDistribution[key] > 0 ? "is-complete" : ""}"><span aria-hidden="true">${mission.categoryDistribution[key] > 0 ? "✓" : "○"}</span>${label}片段</li>`)
              .join("")}</ul>
          </section>
        `;
    root.innerHTML = `
      <section class="class-shell paper-panel${projectionMode ? " is-projecting" : ""}">
        <p class="chapter-label">聚義共建・不比個人</p>
        <h1>班級共同地標</h1>
        <div class="landmark-level" aria-label="共同地標等級 ${aggregate.landmarkLevel}">
          第 ${aggregate.landmarkLevel} 階
        </div>
        <section class="class-mission" aria-labelledby="class-mission-title">
          <p class="eyebrow">${escapeHtml(mission.period)}・${details.title}</p>
          <h2 id="class-mission-title">${details.description}</h2>
          <p><strong>有效閱讀定義：</strong>${mission.validReadingDefinition}。</p>
          <div class="class-mission__track" role="progressbar" aria-label="本週共同任務進度" aria-valuemin="0" aria-valuemax="${mission.target}" aria-valuenow="${mission.progress}">
            <span style="width:${mission.percent}%"></span>
          </div>
          <p>${mission.remaining > 0 ? `全班本週再完成 ${mission.remaining} 次有效閱讀，就能完成共同任務。` : "共同達標！新的共同航圖正在展開。"}</p>
          ${mission.remaining === 0 ? '<div class="class-mission__celebration" data-mission-complete role="status">共同達標・每一片文證都讓地標亮起</div>' : ""}
        </section>
        ${assignmentMarkup}
        <section class="class-mission__routes" aria-labelledby="equivalent-routes-heading">
          <h2 id="equivalent-routes-heading">兩條等價路線</h2>
          <div><article><h3>引導路線</h3><p>有段落路標與策略提示；完成標準與獨立路線相同。</p></article><article><h3>獨立路線</h3><p>自己整理文章與線索；完成標準與引導路線相同。</p></article></div>
        </section>
        <section class="class-mission__role" aria-labelledby="anonymous-role-heading">
          <p class="eyebrow">匿名輪替合作角色</p>
          <h2 id="anonymous-role-heading">本週擔任：${role.label}</h2>
          <p>${role.action}</p>
          <small>探路、查證、整理會依匿名權杖與週期輪替，只顯示在自己的裝置。</small>
        </section>
        ${safeStatistics}
        <fieldset class="class-mission__vote">
          <legend>匿名投票：下週想做哪種共同任務？</legend>
          <p>只送出一個預設代碼，不含姓名與自由文字。</p>
          <div>${CLASS_MISSION_CHOICES.map((choice) => `<button type="button" data-mission-vote="${choice}" aria-pressed="false">${CHOICE_LABELS[choice]}</button>`).join("")}</div>
          <p data-vote-status role="status" aria-live="polite"></p>
        </fieldset>
        <fieldset class="class-mission__exit">
          <legend>匿名觀點／結束單</legend>
          <p>離開前選一個最接近今天狀態的代碼；不需要填寫文字。</p>
          <div>${EXIT_CODES.map((code) => `<button type="button" data-exit-code="${code}" aria-pressed="false">${EXIT_LABELS[code]}</button>`).join("")}</div>
          <p data-exit-status role="status" aria-live="polite"></p>
        </fieldset>
        <p class="class-success">${escapeHtml(message || "你已匿名加入。完成任一篇有效閱讀，就會替全班共同地標增加進度。")}</p>
        <p class="privacy-note">只會同步有效閱讀的類別與能力，不會上傳答案文字。這裡沒有排行榜、個人貢獻、姓名、自由聊天或公開個人頁。</p>
        <a href="#/">回到個人挑戰</a>
        <a href="${projectionMode ? "#/class" : "#/class?project=1"}" data-project-classroom>${projectionMode ? "離開投影模式" : "開啟 16:9 投影頁"}</a>
        <button class="class-leave" type="button" data-leave-class>離開／更換班級</button>
      </section>
    `;
    const celebration = root.querySelector("[data-mission-complete]");
    const celebrationKey = classMissionCelebrationKey(
      token,
      mission.period,
      mission.type,
    );
    let celebrationSeen = false;
    try {
      celebrationSeen = storage.getItem(celebrationKey) === "seen";
    } catch {
      // A blocked storage area must not hide the static completion message.
    }
    if (
      celebration &&
      !celebrationSeen &&
      !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      celebration.classList.add("is-celebrating");
    }
    if (celebration && !celebrationSeen) {
      try {
        storage.setItem(celebrationKey, "seen");
      } catch {
        // The animation remains optional when local persistence is unavailable.
      }
    }
    root.querySelectorAll("[data-mission-vote]").forEach((button) => {
      button.addEventListener("click", async () => {
        const choice = normalizeMissionChoice(button.dataset.missionVote);
        const status = root.querySelector("[data-vote-status]");
        if (!choice) return;
        button.disabled = true;
        status.textContent = "正在送出匿名投票…";
        let voteResponse;
        try {
          voteResponse = await request("/api/v1/classrooms/vote", {
            method: "POST",
            headers: {
              authorization: `Bearer ${token}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({ choice }),
          });
        } catch {
          voteResponse = null;
        }
        button.disabled = false;
        if (!voteResponse?.ok) {
          status.textContent =
            "匿名投票暫時無法送出；共同進度與已完成閱讀都不受影響。";
          return;
        }
        for (const peer of root.querySelectorAll("[data-mission-vote]")) {
          peer.setAttribute("aria-pressed", String(peer === button));
        }
        status.textContent = `已送出「${CHOICE_LABELS[choice]}」，不會顯示投票者。`;
      });
    });
    root.querySelectorAll("[data-exit-code]").forEach((button) => {
      button.addEventListener("click", async () => {
        const code = normalizeExitCode(button.dataset.exitCode);
        if (!code) return;
        for (const peer of root.querySelectorAll("[data-exit-code]")) {
          peer.setAttribute("aria-pressed", String(peer === button));
        }
        const status = root.querySelector("[data-exit-status]");
        button.disabled = true;
        status.textContent = "正在匿名送出觀點…";
        let exitResponse;
        try {
          exitResponse = await request("/api/v1/classrooms/exit", {
            method: "POST",
            headers: {
              authorization: `Bearer ${token}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({ code }),
          });
        } catch {
          exitResponse = null;
        }
        button.disabled = false;
        if (!exitResponse?.ok) {
          status.textContent =
            "匿名觀點暫時無法送出；已保留選擇，可以稍後重試，共同進度不受影響。";
          return;
        }
        status.textContent = `已匿名送出：${EXIT_LABELS[code]}。`;
      });
    });
    root.querySelector("[data-leave-class]").addEventListener("click", () => {
      if (!confirmAction("確定離開目前班級嗎？你的個人閱讀與城市成果會保留。")) {
        return;
      }
      storage.removeItem("reading-expedition.class-token");
      contributionQueue?.clear();
      token = null;
      showJoin("已離開班級，可輸入新的 8 碼班級碼。");
    });
  }

  function showJoin(message = "", value = "") {
    root.innerHTML = `
      <section class="class-shell paper-panel">
        <p class="chapter-label">聚義共建・匿名加入</p>
        <h1>加入班級</h1>
        <p>班級只共建一座地標，不顯示誰做得多，也不會上傳你的答案文字。</p>
        <form data-class-join>
          <label for="class-code">8 碼班級碼</label>
          <input id="class-code" name="classCode" value="${escapeHtml(value)}" inputmode="text" minlength="8" maxlength="11" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-describedby="class-code-help class-join-message" required>
          <p id="class-code-help" class="class-code-help">請輸入老師提供的 8 碼班級碼。可直接貼上，空格與連字號會自動移除。</p>
          <p id="class-join-message" class="form-message" data-class-join-message role="status">${escapeHtml(message)}</p>
          <button class="primary-action" type="submit">加入班級</button>
        </form>
      </section>
    `;
    const form = root.querySelector("[data-class-join]");
    const input = form.elements.classCode;
    const status = root.querySelector("[data-class-join-message]");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const classCode = String(input.value)
        .replace(/[\s-]+/g, "")
        .toUpperCase();
      input.value = classCode;
      if (!/^[A-Z2-9]{8}$/.test(classCode)) {
        input.setAttribute("aria-invalid", "true");
        status.textContent = "請輸入老師提供的 8 碼班級碼。";
        input.focus();
        return;
      }
      input.removeAttribute("aria-invalid");
      const button = form.querySelector("button");
      button.disabled = true;
      button.textContent = "正在加入…";
      form.setAttribute("aria-busy", "true");
      try {
        const seatKey = `reading-expedition.class-seat:${classCode}`;
        let seatToken = storage.getItem(seatKey);
        if (!/^[A-Za-z0-9_-]{43}$/.test(seatToken ?? "")) {
          seatToken = createSeatToken();
          storage.setItem(seatKey, seatToken);
        }
        const response = await request("/api/v1/classrooms/join", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ classCode, seatToken }),
        });
        if (!response.ok) {
          input.setAttribute("aria-invalid", "true");
          status.textContent =
            response.status === 404 || response.status === 410
              ? "班級碼無效或已到期，請向老師確認。"
              : response.status === 429
                ? "嘗試次數過多，請稍後再試。"
                : "班級暫時無法加入，請稍後重試。";
          input.focus();
          return;
        }
        const payload = await response.json();
        token = payload.participantToken;
        storage.setItem("reading-expedition.class-token", token);
        await showLandmark(
          payload.reusedSeat
            ? "已回到這部裝置原有的匿名席次，不會重複計算參與人數。"
            : "你已匿名加入班級。完成一篇閱讀，就能參與共同地標。",
        );
      } catch {
        status.textContent = "目前無法連線，班級碼尚未送出，請確認網路後重試。";
        input.focus();
      } finally {
        if (button.isConnected) {
          button.disabled = false;
          button.textContent = "加入班級";
          form.removeAttribute("aria-busy");
        }
      }
    });
  }

  if (token) await showLandmark();
  else showJoin("", codeFromClassHash(locationHash));
}
