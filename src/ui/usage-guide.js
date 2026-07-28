const studentSteps = [
  ["選一條航線", "從世界、科學、人文挑一篇今天想知道的事，不必三條都完成。"],
  ["選適合難度", "行舟卷提供較多詞語與段落提示；登樓卷資訊較多、整合要求較高。"],
  ["讀完再答三題", "依序找重點、想意思、找證據。答錯時回到原文找線索，還能修正一次。"],
  ["把成果帶回城", "完成閱讀與文證任務就能取得墨磚，慢慢修築自己的萬卷浮城。"],
];

const teacherSteps = [
  ["先看學生端", "用一篇文章走完選卷、閱讀、作答、修正與建城，確認課堂時間與裝置操作。"],
  ["校閱後再發布", "教師校閱可並排檢查雙難度、來源、正文、答案、干擾選項與文證位置。"],
  ["建立匿名班級", "登入教師校閱臺，在班級管理建立並複製 8 碼班級碼；學生加入時不必填姓名、學號或班級真名。"],
  ["用回顧取代排名", "關注完成閱讀、文證一致率與共同地標，不公開個人成績，也不以斷簽施壓。"],
];

function renderSteps(steps) {
  return steps
    .map(
      ([title, detail], index) => `
        <li>
          <span>${String(index + 1).padStart(2, "0")}</span>
          <div>
            <h3>${title}</h3>
            <p>${detail}</p>
          </div>
        </li>
      `,
    )
    .join("");
}

export function renderUsageGuide(container) {
  container.className = "guide-view";
  container.innerHTML = `
    <section class="guide-hero" aria-labelledby="guide-title">
      <a class="back-link" href="#/">← 返回今日航線</a>
      <p class="chapter-label">入山手引</p>
      <h1 id="guide-title">師生怎麼使用梁山閱征記？</h1>
      <p>學生每天用十分鐘完成一篇；老師先把來源與題目把關，再用班級共建陪全班累積。沒有速度競賽，也不因休息一天而歸零。</p>
    </section>

    <div class="guide-audiences">
      <section class="guide-card student-guide" aria-labelledby="student-guide-title">
        <p class="eyebrow">學生篇</p>
        <h2 id="student-guide-title">一篇、三題、一次修正</h2>
        <ol>${renderSteps(studentSteps)}</ol>
        <p class="guide-class-note">要加入全班共同地標時，點選頁首「班級共建」，輸入老師提供的 8 碼班級碼即可。</p>
        <a class="guide-action" href="#/">選今天的閱讀航線</a>
      </section>

      <section class="guide-card teacher-guide" aria-labelledby="teacher-guide-title">
        <p class="eyebrow">教師篇</p>
        <h2 id="teacher-guide-title">先校閱，再帶全班共讀</h2>
        <ol>${renderSteps(teacherSteps)}</ol>
        <div class="guide-actions">
          <a class="guide-action" href="#/teacher">進入教師校閱</a>
          <a class="guide-action secondary" href="#/teacher/classes">建立匿名班級</a>
          <a class="guide-action secondary" href="#/class">學生加入班級</a>
        </div>
      </section>
    </div>

    <section class="guide-note" aria-labelledby="privacy-guide-title">
      <h2 id="privacy-guide-title">資料留在哪裡？</h2>
      <p>學生的閱讀位置、城市與收藏主要保存在自己的裝置。第一版不要求姓名、學號、Email、學校或班級真名；班級端只使用匿名班級碼與達隱私門檻後的共同成果。</p>
    </section>
  `;
}
