function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderReviewDiff(before, after) {
  const changed = before !== after;
  return `
    <section class="review-diff" aria-label="修改差異">
      <article>
        <p class="chapter-label">修改前</p>
        <p>${escapeHtml(before)}</p>
      </article>
      <article class="${changed ? "is-changed" : ""}">
        <p class="chapter-label">修改後</p>
        <p>${escapeHtml(after)}</p>
      </article>
    </section>
  `;
}
