function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function renderStudentPreview(packageRecord, mode = "mobile") {
  const paragraphs = packageRecord.body
    .map(({ text }) => `<p>${escapeHtml(text)}</p>`)
    .join("");
  return `
    <section class="student-preview student-preview--${mode}" aria-label="學生${mode === "mobile" ? "手機" : "桌面"}預覽">
      <p class="chapter-label">學生端預覽・${mode === "mobile" ? "手機" : "桌面"}</p>
      <h3>${escapeHtml(packageRecord.title)}</h3>
      ${paragraphs}
    </section>
  `;
}
