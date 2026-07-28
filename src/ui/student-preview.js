function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function renderStudentPreview(packageRecord, mode = "mobile") {
  const paragraphs = packageRecord.body
    .map((paragraph) =>
      `<p>${escapeHtml(typeof paragraph === "string" ? paragraph : paragraph?.text ?? "")}</p>`,
    )
    .join("");
  const characters = packageRecord.body
    .map((paragraph) =>
      typeof paragraph === "string" ? paragraph : paragraph?.text ?? "",
    )
    .join("")
    .replace(/\s/g, "").length;
  const textType =
    packageRecord.textType === "classical" ? "文言文" : "白話文";
  return `
    <section class="student-preview student-preview--${mode}" aria-label="學生${mode === "mobile" ? "手機" : "桌面"}預覽">
      <p class="chapter-label">學生端預覽・${mode === "mobile" ? "手機" : "桌面"}・${textType} ${characters} 字</p>
      <h3>${escapeHtml(packageRecord.title)}</h3>
      ${paragraphs}
    </section>
  `;
}
