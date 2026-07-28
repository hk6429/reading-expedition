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
  "water-cycle-guided-v1": {
    id: "water-cycle-guided-v1",
    contentKey: "2026-07-28-water-cycle",
    category: "science",
    difficulty: "guided",
    textType: "vernacular",
    title: "一滴水為什麼總在旅行？",
    hookQuestion: "落下來的雨，下一站一定是河流嗎？",
    body: [
      "我們常在課本上看見一個圓形箭頭，表示水從地面到天空，再回到地面。這張圖能提醒我們水會持續移動，卻也可能讓人誤以為每一滴水都依照同一條路線前進。實際上，水可能以液態、固態或氣態存在，也可能暫時停留在海洋、河流、土壤、地下、大氣或冰雪之中。",
      "水循環的一個重要動力是陽光。海洋、湖泊與河川表面的液態水受熱後會蒸發，變成看不見的水蒸氣；植物吸收水分之後，也會把部分水分送入大氣。這兩條路都讓地表的水進入空氣，但來源與過程不完全相同，閱讀示意圖時不能只注意其中一條箭頭。",
      "水蒸氣升高並冷卻後，會凝結成許多細小水滴，形成我們看見的雲。當雲中的水以雨或雪回到地表，旅程仍沒有結束：它可能流向河海、滲入地下、被植物吸收，或在合適的條件下再次進入大氣。水在各處停留的時間不同，去向也不只有一種。",
      "因此，把水循環想成一張有許多交叉路徑的網，比只背誦「蒸發、凝結、降水」三個詞更有幫助。閱讀圖表時，可以逐一追問：水現在是什麼狀態？暫時停在哪裡？接著可能往哪裡移動？只要能用文章中的機制說明箭頭，就不是單純記住圖形，而是真的理解水如何不斷改變與移動。",
    ],
    glossary: [
      { term: "凝結", definition: "氣體冷卻後變成液體的過程。" },
    ],
    sourceAttribution: [
      {
        publisher: "NASA Science",
        url: "https://science.nasa.gov/kids/earth/what-is-the-water-cycle/",
        license: "美國聯邦政府公開資訊；圖片權利另計",
      },
    ],
    readingMinutes: 6,
    version: 1,
    assessment: [
      {
        id: "water-cycle-guided-q1-v1",
        type: "comprehension",
        prompt: "文章中的水蒸氣主要如何形成？",
        options: [
          "液態水受熱蒸發，植物也釋出水分",
          "雲直接變成地下水",
          "冰只要移動就變成氣體",
          "河流把水推到天空",
        ],
      },
      {
        id: "water-cycle-guided-q2-v1",
        type: "inference",
        prompt: "作者為什麼提醒讀者不要只把水循環想成固定圓圈？",
        options: [
          "水會在多種狀態、停留處與路徑之間移動",
          "所有水滴都會同時沿著同一條路移動",
          "水循環只有蒸發而沒有凝結與降水",
          "圓形圖完全不能表示任何循環概念",
        ],
      },
      {
        id: "water-cycle-guided-q3-v1",
        type: "evidence",
        prompt: "哪一段最能支持「水循環不是只有一條路」？",
        options: ["第1段", "第2段", "第3段", "第4段"],
      },
    ],
  },
  "community-clues-guided-v1": {
    id: "community-clues-guided-v1",
    contentKey: "2026-07-28-community-clues",
    category: "humanities",
    difficulty: "guided",
    textType: "classical",
    title: "一張舊照片，能告訴我們什麼？",
    hookQuestion: "看見照片裡的人和街道，就等於知道完整故事嗎？",
    body: [
      "昔有學子觀邑中舊影，見市肆、郵人、車夫與眾民作息，欲由此知地方之舊事。",
      "師曰：「毋遽斷其人之身分與心意。當先察影中人物、器用、文字與處所，錄其實見者。」",
      "既察，乃可據衣服、工具及屋宇推其所為；然影外之人事，未必盡入鏡中，故推論不可視為定論。",
      "又取地圖、訪談及他影互證，分所見、所推與所疑。由是知舊物不自言全貌，善讀者因其跡而能問得更深。",
    ],
    glossary: [
      { term: "邑", definition: "城鎮、地方。" },
      { term: "市肆", definition: "市場與店鋪。" },
      { term: "遽", definition: "急忙、立刻。" },
      { term: "屋宇", definition: "房屋、建築。" },
      { term: "互證", definition: "以不同資料互相比對證明。" },
    ],
    sourceAttribution: [
      {
        publisher: "Library of Congress",
        url: "https://www.loc.gov/classroom-materials/community-people-and-places/",
        license: "教學觀念可引用；個別館藏權利狀態需逐件確認",
      },
    ],
    readingMinutes: 6,
    version: 1,
    assessment: [
      {
        id: "community-clues-guided-q1-v1",
        type: "comprehension",
        prompt: "文章建議分析舊照片時，第一步做什麼？",
        options: [
          "先列出確實看見的線索",
          "直接猜人物的心情",
          "只相信照片上的文字",
          "先決定唯一答案",
        ],
      },
      {
        id: "community-clues-guided-q2-v1",
        type: "inference",
        prompt: "依本文，下列何者最接近「推論不可視為定論」的原因？",
        options: [
          "影像只留下部分線索，鏡頭外仍有人事未被記錄",
          "舊影中的人物一定故意隱藏真實身分",
          "地圖與訪談永遠比影像更正確",
          "只要年代久遠，所有資料都失去價值",
        ],
      },
      {
        id: "community-clues-guided-q3-v1",
        type: "evidence",
        prompt: "哪一段最能支持「照片不等於完整故事」？",
        options: ["第1段", "第2段", "第3段", "第4段"],
      },
    ],
  },
});
