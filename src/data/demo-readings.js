export const demoReadingsById = Object.freeze({
  "water-sharing-guided-v1": {
    id: "water-sharing-guided-v1",
    contentKey: "2026-07-28-water-sharing",
    category: "world",
    difficulty: "guided",
    title: "一座城市如何分配有限水源？",
    hookQuestion: "如果水不夠，每個人都該拿到一樣多嗎？",
    body: [
      "清晨，水庫的刻度又下降了一格。城市裡的家庭、農田與工廠，都需要同一批有限的水。",
      "看起來最公平的方法，是每一方減少相同比例。但家庭需要基本飲水，農作物錯過灌溉期可能枯萎，工廠也可能影響許多人的工作。",
      "因此，分配水源不能只看誰的需求量最大，還要比較基本需要、受影響程度，以及每一方能不能先節省用水。",
      "真正困難的不是找出唯一答案，而是讓分配理由可以被檢查，也願意依新資料調整。",
    ],
    glossary: [
      {
        term: "分配",
        definition: "把有限資源依照規則分給不同對象。",
      },
    ],
    sourceAttribution: [
      {
        publisher: "U.S. Geological Survey",
        url: "https://www.usgs.gov/water-science-school/science/what-hydrology",
        license: "Public Domain",
      },
    ],
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
        type: "evidence",
        prompt: "哪一段最能支持「公平不一定是平均」？",
        options: ["第1段", "第2段", "第3段", "第4段"],
      },
    ],
  },
  "water-sharing-challenge-v1": {
    id: "water-sharing-challenge-v1",
    contentKey: "2026-07-28-water-sharing",
    category: "world",
    difficulty: "challenge",
    title: "缺水時，平均分配真的公平嗎？",
    hookQuestion: "同樣減少一成用水，對每個人造成的影響相同嗎？",
    body: [
      "一座城市進入枯水期，民生、農業與產業同時面對供水減少。若一律減少相同比例，看似採用了相同規則，實際承擔的後果卻可能不同。",
      "家庭用水包含飲用與衛生等基本需要；農業用水受作物生長時程限制；產業用水則可能連動就業與供應。只比較總量，會忽略不同用途的最低需求與替代可能。",
      "較完整的分配方案，會公開基本需求、影響範圍、節水能力與資料限制，並設計可依水情更新的調整機制。",
      "公平因此不是一次算出的固定比例，而是一套理由透明、可以檢查，也能隨證據修正的程序。",
    ],
    glossary: [
      {
        term: "替代可能",
        definition: "能否改用其他方法或資源達到同一目的。",
      },
    ],
    sourceAttribution: [
      {
        publisher: "U.S. Geological Survey",
        url: "https://www.usgs.gov/water-science-school/science/what-hydrology",
        license: "Public Domain",
      },
    ],
    readingMinutes: 8,
    version: 1,
    assessment: [],
  },
});
