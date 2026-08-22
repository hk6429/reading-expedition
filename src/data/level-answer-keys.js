import { levelReadingsById } from "./level-readings.js";

const DIAGNOSTIC_COPY = Object.freeze({
  comprehension:
    "只抓到局部訊息或偏離全文焦點，還沒有涵蓋文章最主要的意思。",
  inference:
    "推論幅度與前後文線索不合，請再檢查原因、結果與限制條件。",
  evidence:
    "和題目主張的支持關係不夠直接，可能只出現相近詞語卻沒有證明重點。",
});

function exactSpan(readingId, paragraph, quote) {
  const text = levelReadingsById[readingId]?.body?.[paragraph - 1];
  const start = typeof text === "string" ? text.indexOf(quote) : -1;
  if (start < 0 || quote.length < 8 || quote.length > 30) {
    throw new TypeError(`${readingId} 的文證錨點必須是正文內 8–30 字`);
  }
  return Object.freeze({
    paragraph,
    start,
    end: start + quote.length,
    text: quote,
  });
}

function key(readingId, id, correctAnswer, paragraph, evidenceQuote, rationale) {
  const item = levelReadingsById[readingId]?.assessment?.find(
    (candidate) => candidate.id === id,
  );
  if (!item || !item.options.includes(correctAnswer)) {
    throw new TypeError(`${readingId} 的答案鍵與題目不一致`);
  }
  const distractorReasons = Object.fromEntries(
    item.options
      .filter((option) => option !== correctAnswer)
      .map((option) => [
        option,
        `「${option}」${DIAGNOSTIC_COPY[item.type]}`,
      ]),
  );
  return Object.freeze({
    id,
    type: item.type,
    correctAnswer,
    rationale,
    distractorReasons: Object.freeze(distractorReasons),
    evidenceSpan: exactSpan(readingId, paragraph, evidenceQuote),
  });
}

export const levelAnswerKeys = Object.freeze({
  "old-photo-launch-v1": Object.freeze([
    key(
      "old-photo-launch-v1",
      "old-photo-launch-q1",
      "先記下照片中真正看見的線索",
      1,
      "照片中真正看見的事",
      "先區分畫面可直接觀察的內容，才能避免把猜想誤當成事實。",
    ),
    key(
      "old-photo-launch-v1",
      "old-photo-launch-q2",
      "照片只保留部分時間與角度，沒有完整說明人物生活",
      2,
      "照片本身沒有完整回答",
      "照片留下可見線索，但無法單獨回答畫面外的人物生活。",
    ),
    key(
      "old-photo-launch-v1",
      "old-photo-launch-q3",
      "照片只留下某個時間、某個角度的畫面",
      3,
      "照片只留下某個時間、某個角度的畫面",
      "原句直接指出照片受時間與角度限制，因此不是完整故事。",
    ),
  ]),
  "antarctic-voyage-v1": Object.freeze([
    key(
      "antarctic-voyage-v1",
      "antarctic-voyage-q1",
      "各國先依共同規則維持和平與科學合作",
      2,
      "要求大家先遵守和平與研究規則",
      "條約沒有消除所有立場，而是先建立和平研究的共同規則。",
    ),
    key(
      "antarctic-voyage-v1",
      "antarctic-voyage-q2",
      "讓承諾可以被實際查驗，降低隱藏違規的可能",
      4,
      "公開資訊與相互查驗，使違規較難藏在遙遠冰原",
      "公開與查驗把口頭承諾變成可檢查的行動。",
    ),
    key(
      "antarctic-voyage-v1",
      "antarctic-voyage-q3",
      "條約同時保留各國原有主張，卻限制利用新活動擴大聲索",
      4,
      "條約同時保留各國原有主張，卻限制利用新活動擴大聲索",
      "原句同時保留爭議與限制行動，最直接支持合作不必先消除分歧。",
    ),
  ]),
  "moon-phases-voyage-v1": Object.freeze([
    key(
      "moon-phases-voyage-v1",
      "moon-phases-voyage-q1",
      "地球看見的月球受光比例隨公轉改變",
      2,
      "地球上的觀察者看見受光半球的比例不斷改變",
      "太陽持續照亮半個月球，改變的是觀察者看見的受光比例。",
    ),
    key(
      "moon-phases-voyage-v1",
      "moon-phases-voyage-q2",
      "上弦月",
      4,
      "上弦月約在中午升起，傍晚常高掛天空",
      "亮面增加且傍晚可見的半月，符合上弦月的出現時段。",
    ),
    key(
      "moon-phases-voyage-v1",
      "moon-phases-voyage-q3",
      "月食必須在特定位置對準時才會發生",
      4,
      "地球影子落到月面形成的是月食",
      "原文明確區分日常月相與地球影子造成的月食。",
    ),
  ]),
  "historic-map-voyage-v1": Object.freeze([
    key(
      "historic-map-voyage-v1",
      "historic-map-voyage-q1",
      "地圖的版本與形成過程",
      2,
      "判讀前，必須先確認版本與形成過程",
      "先確認版本與傳遞過程，才能判斷地圖呈現的是哪一層資料。",
    ),
    key(
      "historic-map-voyage-v1",
      "historic-map-voyage-q2",
      "圖面受到治理關注與使用目的影響",
      3,
      "醒目的符號顯示製圖者特別關注治理與交通節點",
      "圖上醒目與省略之處反映製圖目的，而不只是繪圖精確度。",
    ),
    key(
      "historic-map-voyage-v1",
      "historic-map-voyage-q3",
      "界線以東部分未經實測",
      4,
      "界線以東部分未經實測",
      "這句直接標示測量邊界，最能提醒讀者空白不等於無人居住。",
    ),
  ]),
});
