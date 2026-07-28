const sourceAttribution = Object.freeze([
  {
    publisher: "U.S. Geological Survey",
    url: "https://www.usgs.gov/water-science-school/science/what-hydrology",
    license: "Public Domain",
  },
]);

export const demoReadingsById = Object.freeze({
  "water-sharing-guided-v1": {
    id: "water-sharing-guided-v1",
    contentKey: "2026-07-28-water-sharing",
    category: "world",
    difficulty: "guided",
    textType: "vernacular",
    title: "一座城市如何分配有限水源？",
    hookQuestion: "如果水不夠，每個人都該拿到一樣多嗎？",
    body: [
      "假設一座城市進入缺水期，水庫能供應的水比平常少，家庭、農田與工廠卻仍然同時需要用水。市府若只問「誰要得最多」，數字較大的一方可能先取得水源；若要求三方一律減少相同比例，看來人人遵守同一規則，也不一定代表每一方承受的影響相同。",
      "家庭用水包含飲水與清潔等基本需要；農業一旦錯過作物需要灌溉的時間，影響可能難以立刻補救；產業減水也可能牽動工作與供應。因此，分配者不能把三種用途當成完全相同的數字，更不能只因某一方聲音較大，就把有限水源全數交給它。",
      "較完整的做法，是先確認各方最低的基本需要，再比較缺水造成的影響，並了解每一方還有多少節水空間。能先改善設備、調整流程或減少浪費的一方，可以提出節水方案；暫時沒有替代方法的一方，也要說明原因。這些資料應使用同一套格式公開，才方便彼此檢查。",
      "公平分水不是一次猜出唯一答案，而是讓決定有清楚理由。當水情、需求或節水成果改變，原先的比例也應重新檢討。學生若要評估一項方案，可以追問：基本需要是否受到保障？影響是否被完整說明？能節省的部分是否真的先做了？理由能被檢查，方案才有修正與取得信任的可能。",
    ],
    glossary: [
      {
        term: "分配",
        definition: "把有限資源依照規則分給不同對象。",
      },
    ],
    sourceAttribution,
    readingMinutes: 6,
    version: 1,
    assessment: [
      {
        id: "water-sharing-guided-q1-v1",
        type: "comprehension",
        prompt: "文章認為分配水源時，最需要考量什麼？",
        options: [
          "只看誰要求得最多",
          "基本需要、影響與節水能力",
          "讓每一方自由取用",
          "由最早到場的人決定",
        ],
      },
      {
        id: "water-sharing-guided-q2-v1",
        type: "inference",
        prompt: "依照文章觀點，為什麼「各方減少相同比例」不一定公平？",
        options: [
          "不同用途的基本需要與缺水影響可能不同",
          "每一方原本使用的水量必定完全相同",
          "只要規則相同就不需要檢查實際後果",
          "缺水時應由聲音最大的一方取得全部水源",
        ],
      },
      {
        id: "water-sharing-guided-q3-v1",
        type: "evidence",
        prompt: "下列哪一段最能支持「公平方案必須接受後續檢查與修正」？",
        options: ["第1段", "第2段", "第3段", "第4段"],
      },
    ],
  },
  "water-sharing-challenge-v1": {
    id: "water-sharing-challenge-v1",
    contentKey: "2026-07-28-water-sharing",
    category: "world",
    difficulty: "challenge",
    textType: "vernacular",
    title: "缺水時，平均分配真的公平嗎？",
    hookQuestion: "同樣減少一成用水，對每個人造成的影響相同嗎？",
    body: [
      "一座城市進入枯水期，民生、農業與產業同時面對供水縮減。決策者若採取「一律減少百分之十」，形式上使用了相同規則，實際後果卻未必相同：有些用途牽涉維持生活的最低需要，有些受到時間限制，有些則較有機會先改變流程、降低浪費。只比較總量，很容易把處境差異藏在整齊的百分比之後。",
      "另一種做法，是先保障每一方的基本需要，再按照影響程度分配剩餘水量。但「基本」由誰判定？影響要看眼前損失，還是連後續的工作與供應也計入？若只由單一部門回答，方案仍可能偏向它最熟悉的觀點。因此，決策需要公開各項定義、資料來源與尚未確定之處，讓不同立場的人能檢查。",
      "節水能力也不能只靠口頭承諾。某一方若表示能更換設備、調整時段或減少不必要用水，就應提出可追蹤的目標；另一方若認為已無法再減，也要交代限制。這些資料不只是為了分出多少水，更是為了日後比較承諾與結果。當新資料顯示某項措施無效，分配比例就有重新調整的理由。",
      "由此看來，公平不是把同一個數字套在所有人身上，也不是永遠維持第一次決定。它是一套可說明、可檢查、可修正的程序：先辨認最低需要與不同影響，再比較各方能採取的節水行動，最後留下重新評估的時間與條件。真正可靠的方案，不必假裝沒有衝突，而要讓衝突中的每個判斷都有證據可循。",
      "閱讀這類公共議題時，不能只問自己贊成哪一方。更重要的是辨認作者使用了哪些分配原則、哪些資料仍然缺少，以及結論在什麼情況下應被改變。",
    ],
    glossary: [
      {
        term: "節水能力",
        definition: "能否透過設備、流程或行為調整而減少用水。",
      },
    ],
    sourceAttribution,
    readingMinutes: 8,
    version: 1,
    assessment: [
      {
        id: "water-sharing-challenge-q1-v1",
        type: "comprehension",
        prompt: "文章認為較可靠的分水程序，首先應辨認什麼？",
        options: [
          "各方最低需要與可能承受的不同影響",
          "哪一方最早提出用水申請",
          "哪一方能用最大聲量影響決策",
          "如何永久維持第一次決定",
        ],
      },
      {
        id: "water-sharing-challenge-q2-v1",
        type: "inference",
        prompt: "作者最可能同意下列哪個觀點？",
        options: [
          "相同比例必然帶來相同影響",
          "公平程序必須能依新證據調整",
          "總用水量是唯一分配依據",
          "不同用途不需要公開理由",
        ],
      },
      {
        id: "water-sharing-challenge-q3-v1",
        type: "evidence",
        prompt: "哪一段最能支持「相同規則可能造成不同後果」？",
        options: ["第1段", "第2段", "第3段", "第4段"],
      },
    ],
  },
});
