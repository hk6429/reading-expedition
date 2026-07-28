function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function renderClassView(
  root,
  {
    request = fetch,
    storage = window.localStorage,
    contributionQueue = null,
    confirmAction = (message) => window.confirm(message),
  } = {},
) {
  let token = storage.getItem("reading-expedition.class-token");

  async function showLandmark(message = "") {
    let response;
    try {
      response = await request("/api/v1/classrooms/landmark", {
        headers: { authorization: `Bearer ${token}` },
      });
    } catch {
      showJoin("目前無法連線班級，請確認網路後再試。");
      return;
    }
    if (!response.ok) {
      storage.removeItem("reading-expedition.class-token");
      contributionQueue?.clear();
      token = null;
      showJoin("參與權杖已到期，請重新輸入班級碼。");
      return;
    }
    const aggregate = await response.json();
    const remaining = Number.isInteger(aggregate.remainingToNextLevel)
      ? aggregate.remainingToNextLevel
      : Math.max(0, 10 - ((aggregate.validReadings ?? 0) % 10));
    const missionProgress = remaining === 0 ? 10 : 10 - Math.min(10, remaining);
    root.innerHTML = `
      <section class="class-shell paper-panel">
        <p class="chapter-label">聚義共建・不比個人</p>
        <h1>班級共同地標</h1>
        <div class="landmark-level" aria-label="共同地標等級 ${aggregate.landmarkLevel}">
          第 ${aggregate.landmarkLevel} 階
        </div>
        <section class="class-mission" aria-labelledby="class-mission-title">
          <p class="eyebrow">本週聚義任務</p>
          <h2 id="class-mission-title">全班累積 10 次有效閱讀，修復聚義橋</h2>
          <div class="class-mission__track" role="progressbar" aria-label="共同地標下一階進度" aria-valuemin="0" aria-valuemax="10" aria-valuenow="${missionProgress}">
            <span style="width:${missionProgress * 10}%"></span>
          </div>
          <p>${remaining > 0 ? `全班再完成 ${remaining} 次有效閱讀，就能共同點亮下一階。` : "本階已點亮，新的共同航圖正在展開。"}</p>
        </section>
        ${
          aggregate.privacyProtected
            ? `<p>目前人數尚未達 ${aggregate.participantThreshold} 人，只顯示共同地標，不顯示細分統計。</p>`
            : `<p>匿名參與 ${aggregate.anonymousParticipants} 人，共完成 ${aggregate.validReadings} 次有效閱讀。</p>`
        }
        <p class="class-success">${escapeHtml(message || "你已匿名加入。完成任一篇有效閱讀，就會替全班共同地標增加進度。")}</p>
        <p class="privacy-note">只會同步有效閱讀的類別與能力，不會上傳答案文字。這裡沒有排行榜、個人貢獻、姓名、自由聊天或公開個人頁。</p>
        <a href="#/">回到今日航線</a>
        <button class="class-leave" type="button" data-leave-class>離開／更換班級</button>
      </section>
    `;
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
        const response = await request("/api/v1/classrooms/join", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ classCode }),
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
        contributionQueue?.clear();
        storage.setItem("reading-expedition.class-token", token);
        await showLandmark("你已匿名加入班級。完成一篇閱讀，就能參與共同地標。");
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
  else showJoin();
}
