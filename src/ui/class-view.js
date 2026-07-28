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
  } = {},
) {
  let token = storage.getItem("reading-expedition.class-token");

  async function showLandmark() {
    const response = await request("/api/v1/classrooms/landmark", {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      storage.removeItem("reading-expedition.class-token");
      token = null;
      showJoin("參與權杖已到期，請重新輸入班級碼。");
      return;
    }
    const aggregate = await response.json();
    root.innerHTML = `
      <section class="class-shell paper-panel">
        <p class="chapter-label">聚義共建・不比個人</p>
        <h1>班級共同地標</h1>
        <div class="landmark-level" aria-label="共同地標等級 ${aggregate.landmarkLevel}">
          第 ${aggregate.landmarkLevel} 階
        </div>
        ${
          aggregate.privacyProtected
            ? `<p>目前人數尚未達 ${aggregate.participantThreshold} 人，只顯示共同地標，不顯示細分統計。</p>`
            : `<p>匿名參與 ${aggregate.anonymousParticipants} 人，共完成 ${aggregate.validReadings} 次有效閱讀。</p>`
        }
        <p class="privacy-note">這裡沒有排行榜、個人貢獻、姓名、自由聊天或公開個人頁。</p>
        <a href="#/">回到今日航線</a>
      </section>
    `;
  }

  function showJoin(message = "") {
    root.innerHTML = `
      <section class="class-shell paper-panel">
        <p class="chapter-label">聚義共建・匿名加入</p>
        <h1>輸入班級碼</h1>
        <p>班級只共建一座地標，不顯示誰做得多，也不會上傳你的答案文字。</p>
        <form data-class-join>
          <label>八碼班級碼
            <input name="classCode" inputmode="text" minlength="8" maxlength="8" autocomplete="off" required>
          </label>
          <button class="primary-action" type="submit">加入共同地標</button>
        </form>
        <p class="form-message" role="status">${escapeHtml(message)}</p>
      </section>
    `;
    root.querySelector("[data-class-join]").addEventListener("submit", async (event) => {
      event.preventDefault();
      const classCode = new FormData(event.currentTarget).get("classCode");
      const response = await request("/api/v1/classrooms/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ classCode }),
      });
      if (!response.ok) {
        showJoin("班級碼無效或已到期。");
        return;
      }
      const payload = await response.json();
      token = payload.participantToken;
      storage.setItem("reading-expedition.class-token", token);
      await showLandmark();
    });
  }

  if (token) await showLandmark();
  else showJoin();
}
