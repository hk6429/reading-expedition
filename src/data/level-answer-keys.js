function key(id, correctAnswer, paragraph, diagnostic = {}) {
  return {
    id,
    correctAnswer,
    rationale: "答案必須同時符合文章主張與原文線索。",
    distractorReasons: diagnostic,
    evidenceSpan: { paragraph, start: 0, end: 36 },
  };
}

export const levelAnswerKeys = Object.freeze({
  "old-photo-launch-v1": [
    key("old-photo-launch-q1", "先記下照片中真正看見的線索", 1),
    key(
      "old-photo-launch-q2",
      "照片只保留部分時間與角度，沒有完整說明人物生活",
      2,
    ),
    key(
      "old-photo-launch-q3",
      "照片只留下某個時間、某個角度的畫面",
      3,
    ),
  ],
  "antarctic-voyage-v1": [
    key(
      "antarctic-voyage-q1",
      "各國先依共同規則維持和平與科學合作",
      2,
    ),
    key(
      "antarctic-voyage-q2",
      "讓承諾可以被實際查驗，降低隱藏違規的可能",
      4,
    ),
    key(
      "antarctic-voyage-q3",
      "條約同時保留各國原有主張，卻限制利用新活動擴大聲索",
      4,
    ),
  ],
  "moon-phases-voyage-v1": [
    key(
      "moon-phases-voyage-q1",
      "地球看見的月球受光比例隨公轉改變",
      2,
    ),
    key("moon-phases-voyage-q2", "上弦月", 4),
    key(
      "moon-phases-voyage-q3",
      "月食必須在特定位置對準時才會發生",
      4,
    ),
  ],
  "historic-map-voyage-v1": [
    key("historic-map-voyage-q1", "地圖的版本與形成過程", 2),
    key(
      "historic-map-voyage-q2",
      "圖面受到治理關注與使用目的影響",
      3,
    ),
    key(
      "historic-map-voyage-q3",
      "界線以東部分未經實測",
      4,
    ),
  ],
});
