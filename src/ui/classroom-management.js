import {
  ASSIGNMENT_ABILITIES,
  ASSIGNMENT_ROUTES,
  buildClassAssignment,
  buildClassDeepLink,
  buildClassMission,
  interventionForAbilityMetrics,
  missionTypeDetails,
  normalizeAssignmentReadings,
  normalizeMissionChoice,
} from "../domain/class-mission.js";

const CLASS_CODE_STORAGE_KEY = "reading-expedition.teacher-class-codes";
const TEACHER_MISSION_OPTIONS = Object.freeze([
  ["shared_readings", "共同篇數", "一起累積有效閱讀，不比較個人速度。"],
  ["category_balance", "類別平衡", "讓三個閱讀類別都有完成片段。"],
  ["ability_practice", "能力練習", "共同練習主旨、推論與文證。"],
]);
const ASSIGNMENT_ABILITY_LABELS = Object.freeze({
  comprehension: "找主旨",
  inference: "推論",
  evidence: "找文證",
});
const ASSIGNMENT_ROUTE_LABELS = Object.freeze({
  guided: "引導路線",
  independent: "獨立路線",
  equivalent: "兩者等價",
});
const READING_LEVEL_LABELS = Object.freeze({
  launch: "啟程",
  voyage: "遠航",
  tower: "登樓",
});
const READING_CATEGORY_LABELS = Object.freeze({
  world: "世界議題",
  science: "自然科學",
  humanities: "人文故事",
});

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function readRememberedCodes(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(CLASS_CODE_STORAGE_KEY) ?? "{}");
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([id, code]) =>
          /^[A-Za-z0-9-]{1,80}$/.test(id) && /^[A-Z2-9]{8}$/.test(code),
      ),
    );
  } catch {
    return {};
  }
}

function saveRememberedCodes(storage, codes) {
  try {
    storage.setItem(CLASS_CODE_STORAGE_KEY, JSON.stringify(codes));
  } catch {
    // The code remains visible for the current render even if storage is blocked.
  }
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日期未提供";
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Taipei",
  }).format(date);
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("clipboard unavailable");
}

async function loadAssignmentReadings(request) {
  const levels = ["launch", "voyage", "tower"];
  const results = await Promise.all(
    levels.map(async (level) => {
      try {
        const response = await request(
          `/api/v1/readings?level=${level}&page=1&pageSize=200`,
        );
        if (!response?.ok) return [];
        const payload = await response.json();
        return Array.isArray(payload.readings) ? payload.readings : [];
      } catch {
        return [];
      }
    }),
  );
  return normalizeAssignmentReadings(results.flat());
}

function teacherAssignmentMarkup(classroom, assignmentReadings) {
  if (classroom.revokedAt) return "";
  const current = classroom.currentAssignment ?? classroom.assignment ?? {};
  const hasOptions = assignmentReadings.length > 0;
  const selectedReading = assignmentReadings.some(
    ({ readingId }) => readingId === current.readingId,
  )
    ? current.readingId
    : assignmentReadings[0]?.readingId ?? "";
  const selectedAbility = ASSIGNMENT_ABILITIES.includes(current.ability)
    ? current.ability
    : "evidence";
  const selectedRoute = ASSIGNMENT_ROUTES.includes(current.route)
    ? current.route
    : "equivalent";
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(current.dueDate ?? "")
    ? current.dueDate
    : "";
  return `
    <section class="class-mission__assignment" aria-labelledby="assignment-${escapeHtml(classroom.id)}">
      <p class="eyebrow">G069・教師指派</p>
      <h4 id="assignment-${escapeHtml(classroom.id)}">指派閱讀任務</h4>
      <p>只選結構化文章、能力與路線，不收姓名、答案或自由文字。</p>
      <form data-class-assignment-form data-classroom-id="${escapeHtml(classroom.id)}">
        <label>選擇文章
          <select name="readingId" ${hasOptions ? "" : "disabled"} required>
            ${hasOptions
              ? assignmentReadings.map(({ readingId, title, level, category, supportMode }) => {
                  const metadata = [
                    READING_LEVEL_LABELS[level],
                    READING_CATEGORY_LABELS[category],
                    supportMode === "guided"
                      ? "引導模式"
                      : supportMode === "independent"
                        ? "獨立模式"
                        : null,
                  ].filter(Boolean).join("・");
                  return `<option value="${escapeHtml(readingId)}" ${readingId === selectedReading ? "selected" : ""}>${escapeHtml(`${title}${metadata ? `（${metadata}）` : ""}`)}</option>`;
                }).join("")
              : '<option value="">文章清單暫時無法載入</option>'}
          </select>
        </label>
        <label>練習能力
          <select name="ability" required>
            ${ASSIGNMENT_ABILITIES.map((ability) => `<option value="${ability}" ${ability === selectedAbility ? "selected" : ""}>${ASSIGNMENT_ABILITY_LABELS[ability]}</option>`).join("")}
          </select>
        </label>
        <fieldset>
          <legend>閱讀路線</legend>
          ${ASSIGNMENT_ROUTES.map((route) => `<label><input type="radio" name="route" value="${route}" ${route === selectedRoute ? "checked" : ""}><span><strong>${ASSIGNMENT_ROUTE_LABELS[route]}</strong><small>${route === "equivalent" ? "學生可自由選引導或獨立，完成標準相同。" : "只指定閱讀支援方式，不代表能力高低。"}</small></span></label>`).join("")}
        </fieldset>
        <div class="class-mission__deadline">
          <label>日期期限
            <input type="date" name="dueDate" value="${dueDate}" ${dueDate ? "" : "disabled"}>
          </label>
          <label><input type="checkbox" name="noDeadline" ${dueDate ? "" : "checked"}>無期限</label>
        </div>
        <p>期限只協助安排教學；逾期不扣分、不倒數、不歸零，之後仍可完成。</p>
        <button type="submit" ${hasOptions ? "" : "disabled"}>儲存閱讀指派</button>
        <p data-assignment-status role="status" aria-live="polite">${hasOptions ? "" : "目前無法取得文章清單，請稍後重新載入；既有指派不受影響。"}</p>
      </form>
    </section>
  `;
}

function teacherMissionMarkup(classroom, assignmentReadings, classCode = "") {
  if (classroom.revokedAt) return "";
  const mission = buildClassMission(classroom);
  const selectedType = mission.type;
  const safeDetails = mission.privacyProtected
    ? `<p class="class-mission__privacy">匿名參與尚未達 ${mission.participantThreshold} 人，能力熱圖與介入建議暫不顯示。</p>`
    : (() => {
        const intervention = interventionForAbilityMetrics(
          mission.abilityMetrics,
        );
        const labels = {
          comprehension: "找主旨",
          inference: "推論",
          evidence: "找文證",
        };
        const qualityMarkup = mission.qualityRates
          ? `
            <section class="class-mission__quality" aria-labelledby="quality-${escapeHtml(classroom.id)}">
              <h4 id="quality-${escapeHtml(classroom.id)}">學習品質聚合</h4>
              <p>只顯示達隱私門檻的班級比率，不列學生、答案或自由文字。</p>
              <dl>
                <div><dt>首次正確率</dt><dd>${Math.round(mission.qualityRates.firstCorrectRate * 100)}%</dd></div>
                <div><dt>修正成功率</dt><dd>${Math.round(mission.qualityRates.revisedCorrectRate * 100)}%</dd></div>
                <div><dt>文證查看率</dt><dd>${Math.round(mission.qualityRates.evidenceViewedRate * 100)}%</dd></div>
                <div><dt>遷移完成率</dt><dd>${Math.round(mission.qualityRates.transferCompletedRate * 100)}%</dd></div>
              </dl>
            </section>
          `
          : "";
        return `
          <section class="class-mission__teacher-heatmap" aria-labelledby="heatmap-${escapeHtml(classroom.id)}">
            <h4 id="heatmap-${escapeHtml(classroom.id)}">匿名能力熱圖</h4>
            <p>依本週各能力的作答機會與首次正確率呈現；未滿 5 次只顯示樣本不足，不判定弱點。</p>
            <ul>${Object.entries(labels)
              .map(([key, label]) => {
                const metric = mission.abilityMetrics?.[key] ?? { opportunities: 0, firstCorrectRate: null };
                const enough = metric.opportunities >= 5;
                const percent = enough ? Math.round(metric.firstCorrectRate * 100) : 0;
                return `<li><span>${label}</span><div role="img" aria-label="${label} ${metric.opportunities} 次機會，${enough ? `首次正確率 ${percent}%` : "樣本不足"}"><i style="width:${percent}%"></i></div><strong>${enough ? `${percent}%` : `${metric.opportunities}/5`}</strong></li>`;
              })
              .join("")}</ul>
          </section>
          <aside class="class-mission__intervention" aria-labelledby="intervention-${escapeHtml(classroom.id)}">
            <p class="eyebrow">10 分鐘介入卡</p>
            <h4 id="intervention-${escapeHtml(classroom.id)}">${intervention.title}</h4>
            <dl>
              <div><dt>班級</dt><dd>${escapeHtml(classCode || classroom.id)}</dd></div>
              <div><dt>週次</dt><dd>${escapeHtml(mission.period)}</dd></div>
              <div><dt>能力</dt><dd>${intervention.skill ? labels[intervention.skill] : "樣本不足，暫不判定"}</dd></div>
              <div><dt>樣本</dt><dd>${intervention.opportunities} 次機會（最低 ${intervention.minimumSample}）</dd></div>
              <div><dt>證據</dt><dd>${intervention.rate === null ? "尚無足夠聚合資料" : `首次答對 ${intervention.firstCorrect}/${intervention.opportunities}（${Math.round(intervention.rate * 100)}%）`}</dd></div>
            </dl>
            <p>${intervention.steps}</p>
            <p>${intervention.example}</p>
            <p>${intervention.practice}</p>
            <p>${intervention.exitCheck}</p>
            <button type="button" class="class-mission__print-action" data-print-intervention aria-label="列印介入卡">列印介入卡</button>
          </aside>
          ${qualityMarkup}
        `;
      })();
  return `
    <section class="class-mission__teacher" aria-labelledby="mission-${escapeHtml(classroom.id)}">
      <h4 id="mission-${escapeHtml(classroom.id)}">設定共同任務</h4>
      <form data-class-mission-form data-classroom-id="${escapeHtml(classroom.id)}">
        <fieldset>
          <legend>選擇下一個共同任務</legend>
          ${TEACHER_MISSION_OPTIONS.map(([type, title, description]) =>
            `<label><input type="radio" name="missionType" value="${type}" ${type === selectedType ? "checked" : ""}><span><strong>${title}</strong><small>${description}</small></span></label>`,
          ).join("")}
        </fieldset>
        <button type="submit">儲存共同任務</button>
        <p data-mission-form-status role="status" aria-live="polite"></p>
      </form>
      ${teacherAssignmentMarkup(classroom, assignmentReadings)}
      ${safeDetails}
    </section>
  `;
}

function classroomMarkup(classroom, rememberedCode, assignmentReadings) {
  const revoked = Boolean(classroom.revokedAt);
  const code = !revoked ? rememberedCode : null;
  const labelId = `classroom-${classroom.id}`;
  const identity = code
    ? `班級 ${code}`
    : `建立於 ${formatDate(classroom.createdAt)}`;
  return `
    <article class="classroom-card${revoked ? " is-revoked" : ""}" aria-labelledby="${escapeHtml(labelId)}">
      <div class="classroom-card__heading">
        <div>
          <p class="chapter-label">${revoked ? "已封印" : "聚義進行中"}</p>
          <h3 id="${escapeHtml(labelId)}">${escapeHtml(identity)}</h3>
        </div>
        <span class="classroom-status">${revoked ? "已停用" : "使用中"}</span>
      </div>
      ${
        code
          ? `
            <div class="class-code-row">
              <code>${escapeHtml(code)}</code>
              <button type="button" aria-label="複製班級碼 ${escapeHtml(code)}" data-copy-class-code="${escapeHtml(classroom.id)}">複製班級碼</button>
              <button type="button" aria-label="複製匿名加入連結" data-copy-class-link="${escapeHtml(classroom.id)}">複製加入連結</button>
              <button type="button" aria-label="安全更換班級碼" data-rotate-class-code="${escapeHtml(classroom.id)}">安全換碼</button>
            </div>
          `
          : revoked
            ? ""
            : `<p class="class-code-note">班級碼只在建立時顯示；若已遺失，請停用後建立新班級。</p>`
      }
      <dl class="classroom-metrics">
        <div><dt>匿名參與</dt><dd>${Number(classroom.anonymousParticipants) || 0} 人</dd></div>
        <div><dt>有效閱讀</dt><dd>${Number(classroom.validReadings) || 0} 次</dd></div>
        <div><dt>有效期限</dt><dd>${escapeHtml(formatDate(classroom.expiresAt))}</dd></div>
      </dl>
      ${teacherMissionMarkup(classroom, assignmentReadings, code ?? "")}
      ${
        revoked
          ? ""
          : `<button class="classroom-revoke" type="button" aria-label="停用${escapeHtml(identity)}" data-revoke-classroom="${escapeHtml(classroom.id)}">停用班級</button>`
      }
    </article>
  `;
}

function createdClassroomMarkup(classroom) {
  if (!classroom?.id || !/^[A-Z2-9]{8}$/.test(classroom.classCode ?? "")) {
    return "";
  }
  return `
    <section class="classroom-created" aria-labelledby="created-classroom-title">
      <div>
        <p class="chapter-label">班級建立成功</p>
        <h3 id="created-classroom-title">現在把這組代碼交給學生</h3>
        <p>學生從頁首「加入班級」輸入即可；這組代碼只在教師目前的分頁保存。</p>
      </div>
      <div class="class-code-row">
        <code>${escapeHtml(classroom.classCode)}</code>
        <button type="button" aria-label="複製班級碼 ${escapeHtml(classroom.classCode)}" data-copy-class-code="${escapeHtml(classroom.id)}">複製班級碼</button>
        <button type="button" aria-label="複製匿名加入連結" data-copy-class-link="${escapeHtml(classroom.id)}">複製加入連結</button>
      </div>
    </section>
  `;
}

export async function renderClassroomManagement(
  root,
  {
    request = fetch,
    csrfToken,
    getCsrfToken = () => csrfToken,
    onAuthenticationInvalid = async () => {},
    storage = window.sessionStorage,
    baseUrl = window.location.href,
  } = {},
) {
  let rememberedCodes = readRememberedCodes(storage);

  async function load({
    message = "",
    focusTarget = "",
    createdClassroom = null,
  } = {}) {
    let response;
    try {
      response = await request("/api/v1/teacher/classrooms");
    } catch {
      response = null;
    }
    if (!response?.ok) {
      root.innerHTML = `
        <section class="classroom-manager" aria-labelledby="classroom-manager-title">
          <h2 id="classroom-manager-title">班級管理</h2>
          <p class="form-message" data-classroom-message role="status">班級資料暫時無法載入，請重新登入。</p>
        </section>
      `;
      return;
    }
    const payload = await response.json();
    const classrooms = Array.isArray(payload.classrooms)
      ? payload.classrooms
      : [];
    const assignmentReadings = normalizeAssignmentReadings([
      ...(Array.isArray(payload.assignmentReadings)
        ? payload.assignmentReadings
        : []),
      ...(await loadAssignmentReadings(request)),
      ...classrooms.flatMap(({ currentAssignment }) =>
        currentAssignment ? [currentAssignment] : [],
      ),
    ]);
    root.innerHTML = `
      <section class="classroom-manager" aria-labelledby="classroom-manager-title">
        <header class="classroom-manager__heading">
          <div>
            <p class="chapter-label">聚義共建・教師端</p>
            <h2 id="classroom-manager-title">班級管理</h2>
            <p>建立匿名班級後，把 8 碼班級碼交給學生；不收姓名、學號或班級真名。</p>
          </div>
          <button class="primary-action" type="button" data-create-classroom>建立新班級</button>
        </header>
        ${createdClassroomMarkup(createdClassroom)}
        <p class="form-message" data-classroom-message role="status">${escapeHtml(message)}</p>
        <div class="classroom-list">
          ${
            classrooms.length
              ? classrooms
                  .map((classroom) =>
                    classroomMarkup(
                      classroom,
                      rememberedCodes[classroom.id],
                      assignmentReadings,
                    ),
                  )
                  .join("")
              : `<p class="classroom-empty">尚未建立班級。建立後即可複製班級碼給學生。</p>`
          }
        </div>
      </section>
    `;

    root
      .querySelector("[data-create-classroom]")
      .addEventListener("click", async (event) => {
        const createButton = event.currentTarget;
        createButton.disabled = true;
        let createResponse;
        try {
          createResponse = await request("/api/v1/teacher/classrooms", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-csrf-token": getCsrfToken(),
            },
            body: "{}",
          });
        } catch {
          createResponse = null;
        }
        if ([401, 403].includes(createResponse?.status)) {
          await onAuthenticationInvalid();
          return;
        }
        if (!createResponse?.ok) {
          createButton.disabled = false;
          root.querySelector("[data-classroom-message]").textContent =
            "班級建立失敗，請確認網路或重新登入後再試。";
          return;
        }
        const classroom = await createResponse.json();
        rememberedCodes = {
          ...rememberedCodes,
          [classroom.id]: classroom.classCode,
        };
        saveRememberedCodes(storage, rememberedCodes);
        await load({
          message: "班級碼已顯示在上方，也會保留在下方班級卡片。",
          focusTarget: `.classroom-created [data-copy-class-code="${classroom.id}"]`,
          createdClassroom: classroom,
        });
      });

    root.querySelectorAll("[data-copy-class-code]").forEach((button) => {
      button.addEventListener("click", async () => {
        const code = rememberedCodes[button.dataset.copyClassCode];
        try {
          await copyText(code);
          button.textContent = "已複製 ✓";
          root.querySelector("[data-classroom-message]").textContent =
            `班級碼 ${code} 已複製。`;
        } catch {
          root.querySelector("[data-classroom-message]").textContent =
            "無法自動複製，請手動選取班級碼。";
        }
      });
    });

    root.querySelectorAll("[data-copy-class-link]").forEach((button) => {
      button.addEventListener("click", async () => {
        const code = rememberedCodes[button.dataset.copyClassLink];
        const deepLink = buildClassDeepLink(baseUrl, code);
        try {
          if (!deepLink) throw new Error("class link unavailable");
          await copyText(deepLink);
          button.textContent = "加入連結已複製 ✓";
          root.querySelector("[data-classroom-message]").textContent =
            "已複製匿名班級加入連結；連結不含教師或學生姓名。";
        } catch {
          root.querySelector("[data-classroom-message]").textContent =
            "無法自動複製加入連結，請重新建立班級碼後再試。";
        }
      });
    });

    root.querySelectorAll("[data-rotate-class-code]").forEach((button) => {
      button.addEventListener("click", async () => {
        const classroomId = button.dataset.rotateClassCode;
        if (!window.confirm("確定安全換碼？舊班級碼與既有學生席次會立即失效，指派與班級統計會保留。")) return;
        button.disabled = true;
        let rotateResponse;
        try {
          rotateResponse = await request(
            `/api/v1/teacher/classrooms/${classroomId}/code`,
            {
              method: "POST",
              headers: { "x-csrf-token": getCsrfToken() },
            },
          );
        } catch {
          rotateResponse = null;
        }
        if ([401, 403].includes(rotateResponse?.status)) {
          await onAuthenticationInvalid();
          return;
        }
        if (!rotateResponse?.ok) {
          button.disabled = false;
          root.querySelector("[data-classroom-message]").textContent =
            "班級碼暫時無法更換；舊碼與既有席次維持原狀。";
          return;
        }
        const rotated = await rotateResponse.json();
        rememberedCodes = { ...rememberedCodes, [classroomId]: rotated.classCode };
        saveRememberedCodes(storage, rememberedCodes);
        await load({
          message: "班級碼已安全更換；請只分享新碼，舊碼與舊席次已失效。",
          focusTarget: `[data-copy-class-code="${classroomId}"]`,
        });
      });
    });

    root.querySelectorAll("[data-print-intervention]").forEach((button) => {
      button.addEventListener("click", () => {
        const intervention = button.closest(".class-mission__intervention");
        if (!intervention) return;
        document.body.classList.add("is-printing-intervention");
        intervention.classList.add("is-print-target");
        try {
          window.print();
        } finally {
          intervention.classList.remove("is-print-target");
          document.body.classList.remove("is-printing-intervention");
        }
      });
    });

    root.querySelectorAll("[data-class-mission-form]").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const classroomId = form.dataset.classroomId;
        const missionType = normalizeMissionChoice(
          new FormData(form).get("missionType"),
        );
        const status = form.querySelector("[data-mission-form-status]");
        const submit = form.querySelector('button[type="submit"]');
        if (!missionType) {
          status.textContent = "請先選擇一種共同任務。";
          return;
        }
        submit.disabled = true;
        status.textContent = "正在儲存共同任務…";
        let missionResponse;
        try {
          missionResponse = await request(
            `/api/v1/teacher/classrooms/${classroomId}/mission`,
            {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-csrf-token": getCsrfToken(),
              },
              body: JSON.stringify({ type: missionType }),
            },
          );
        } catch {
          missionResponse = null;
        }
        submit.disabled = false;
        if ([401, 403].includes(missionResponse?.status)) {
          await onAuthenticationInvalid();
          return;
        }
        if (!missionResponse?.ok) {
          status.textContent =
            "共同任務暫時無法儲存；目前設定與班級進度都不會被清除。";
          return;
        }
        status.textContent = `已儲存「${missionTypeDetails(missionType).title}」，學生下次載入時會看到。`;
      });
    });

    root.querySelectorAll("[data-class-assignment-form]").forEach((form) => {
      const noDeadline = form.elements.noDeadline;
      const dueDate = form.elements.dueDate;
      noDeadline.addEventListener("change", () => {
        dueDate.disabled = noDeadline.checked;
        if (noDeadline.checked) dueDate.value = "";
      });
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const classroomId = form.dataset.classroomId;
        const fields = new FormData(form);
        const assignment = buildClassAssignment(
          {
            readingId: fields.get("readingId"),
            ability: fields.get("ability"),
            route: fields.get("route"),
            dueDate: noDeadline.checked ? "" : fields.get("dueDate"),
          },
          assignmentReadings,
        );
        const status = form.querySelector("[data-assignment-status]");
        const submit = form.querySelector('button[type="submit"]');
        if (!assignment) {
          status.textContent =
            "請確認文章、能力、路線與日期期限；尚未送出任何變更。";
          return;
        }
        submit.disabled = true;
        status.textContent = "正在儲存閱讀指派…";
        let assignmentResponse;
        try {
          assignmentResponse = await request(
            `/api/v1/teacher/classrooms/${classroomId}/assignment`,
            {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-csrf-token": getCsrfToken(),
              },
              body: JSON.stringify(assignment),
            },
          );
        } catch {
          assignmentResponse = null;
        }
        submit.disabled = false;
        if ([401, 403].includes(assignmentResponse?.status)) {
          await onAuthenticationInvalid();
          return;
        }
        if (!assignmentResponse?.ok) {
          status.textContent =
            "閱讀指派暫時無法儲存；原有指派與學生進度都不會被清除。";
          return;
        }
        status.textContent = `已指派「${assignment.title}」・${ASSIGNMENT_ABILITY_LABELS[assignment.ability]}・${ASSIGNMENT_ROUTE_LABELS[assignment.route]}・${assignment.dueDate ?? "無期限"}。`;
      });
    });

    root.querySelectorAll("[data-revoke-classroom]").forEach((button) => {
      button.addEventListener("click", () => {
        const classroomId = button.dataset.revokeClassroom;
        const card = button.closest(".classroom-card");
        button.hidden = true;
        card.insertAdjacentHTML(
          "beforeend",
          `
            <div class="classroom-revoke-confirm" data-revoke-confirm role="group" aria-label="停用班級確認">
              <p><strong>確定停用這個班級？</strong></p>
              <p>停用後，原班級碼與已加入學生的參與權限都會立即失效。</p>
              <div>
                <button type="button" data-confirm-revoke>確定停用</button>
                <button type="button" data-cancel-revoke>取消</button>
              </div>
            </div>
          `,
        );
        const confirmPanel = card.querySelector("[data-revoke-confirm]");
        confirmPanel
          .querySelector("[data-cancel-revoke]")
          .addEventListener("click", () => {
            confirmPanel.remove();
            button.hidden = false;
            button.focus();
          });
        const confirmButton = confirmPanel.querySelector(
          "[data-confirm-revoke]",
        );
        confirmButton.addEventListener("click", async () => {
          confirmButton.disabled = true;
          let revokeResponse;
          try {
            revokeResponse = await request(
              `/api/v1/teacher/classrooms/${classroomId}`,
              {
                method: "DELETE",
                headers: { "x-csrf-token": getCsrfToken() },
              },
            );
          } catch {
            revokeResponse = null;
          }
          if ([401, 403].includes(revokeResponse?.status)) {
            await onAuthenticationInvalid();
            return;
          }
          if (revokeResponse?.status === 404) {
            delete rememberedCodes[classroomId];
            saveRememberedCodes(storage, rememberedCodes);
            await load({
              message: "班級已停用，畫面已同步最新狀態。",
              focusTarget: "[data-create-classroom]",
            });
            return;
          }
          if (!revokeResponse?.ok) {
            confirmButton.disabled = false;
            root.querySelector("[data-classroom-message]").textContent =
              "班級停用失敗，請確認網路後重新載入。";
            return;
          }
          delete rememberedCodes[classroomId];
          saveRememberedCodes(storage, rememberedCodes);
          await load({
            message: "班級已停用，原有班級碼與學生權杖皆已失效。",
            focusTarget: "[data-create-classroom]",
          });
        });
        confirmButton.focus();
      });
    });
    if (focusTarget) {
      const target = root.querySelector(focusTarget);
      target?.focus();
      target
        ?.closest(".classroom-created")
        ?.scrollIntoView({ block: "nearest" });
    }
  }

  await load();
}
