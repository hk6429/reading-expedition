const simpleStrategy = Object.freeze({
  world: Object.freeze({
    name: "規則作用連線法",
    purpose: "先找共同規則，再追蹤它處理了哪一種風險。",
    structureMap: "先交代問題背景，再說明規則，最後檢查規則如何維持合作。",
    steps: [
      {
        label: "圈規則",
        instruction: "找出文章中要求、允許或禁止的做法。",
        example: "條約要求南極用於和平，也保障科學合作。",
      },
      {
        label: "找風險",
        instruction: "思考每項規則想避免哪一種衝突。",
        example: "限制軍事活動，是為了避免冰原成為競爭場所。",
      },
      {
        label: "連作用",
        instruction: "用「因為……所以……」說明規則的作用。",
        example: "因為可以交換資料，所以不同國家的研究能互相核對。",
      },
    ],
    expertTip: "不要只記規則名稱，要能說出它處理的問題。",
    selfCheck: "我能否指出一項規則、它面對的風險與產生的作用？",
  }),
  science: Object.freeze({
    name: "光源視角模型",
    purpose: "固定光源，再追蹤觀察位置改變後看見的差異。",
    structureMap: "先說明月光來源，再解釋位置變化，最後用月相順序檢查模型。",
    steps: [
      {
        label: "固定光源",
        instruction: "先確認太陽持續照亮月球的一半。",
        example: "不同月相時，月球都不是自己發光。",
      },
      {
        label: "移動位置",
        instruction: "找出月球繞地球移動後，觀察方向如何改變。",
        example: "位置改變時，地球看見的受光比例也跟著改變。",
      },
      {
        label: "排除誤解",
        instruction: "用固定模型檢查常見說法。",
        example: "月相不是月球變形，也不是每天發生月食。",
      },
    ],
    expertTip: "每次都問：光從哪裡來？我從哪裡看？",
    selfCheck: "我能否用太陽、地球與月球的位置解釋亮面比例？",
  }),
  humanities: Object.freeze({
    name: "所見推論雙欄法",
    purpose: "把材料中直接看見的線索，和根據線索提出的推論分開。",
    structureMap: "先看材料版本，再觀察圖面內容，最後說明空白與誤差也能成為線索。",
    steps: [
      {
        label: "只記所見",
        instruction: "先寫下材料直接呈現的文字、人物、地點或符號。",
        example: "照片裡看見店鋪與車夫，先不猜他們的心情。",
      },
      {
        label: "標示推論",
        instruction: "提出解釋時，同時說明依據與不確定處。",
        example: "衣著可以幫助推測年代，卻不能單獨證明人物身分。",
      },
      {
        label: "交叉核對",
        instruction: "再找地圖、訪談或其他材料互相比較。",
        example: "用同時期地圖確認照片中的道路是否真的存在。",
      },
    ],
    expertTip: "材料沒有拍到或畫出的部分，不等於不存在。",
    selfCheck: "我能否把一句判斷拆成直接所見與仍待查證的推論？",
  }),
});

export const levelReadingsById = Object.freeze({
  "old-photo-launch-v1": Object.freeze({
    id: "old-photo-launch-v1",
    contentKey: "level-launch-old-photo",
    category: "humanities",
    difficulty: "guided",
    level: "launch",
    supportMode: "guided",
    textType: "vernacular",
    title: "舊照片沒有說完的故事",
    hookQuestion: "照片裡看得見的線索，等於事情的全部嗎？",
    body: [
      "小安在地方館看見一張老街照片。畫面裡有店鋪、推車、招牌和幾位路人。他立刻說：「以前這條街一定非常熱鬧，每個人都靠做生意生活。」老師沒有直接說他錯，只請他先把照片中真正看見的事寫下來。",
      "小安重新觀察後，記下店門開著、路旁停著推車、招牌上有文字。至於街道是否每天都熱鬧、路人的工作是什麼，照片本身沒有完整回答。這些想法可以成為推論，卻不能當成已經證明的事實。",
      "老師又找來同一時期的地圖、報紙與居民訪談。不同材料互相比較後，小安才知道照片只留下某個時間、某個角度的畫面。善用舊照片，不是急著替它補完故事，而是分清楚哪些是所見、哪些是推論，還有哪些問題需要繼續查證。",
      "最後，小安把筆記分成三欄：第一欄寫「照片看見的」，第二欄寫「我根據線索想到的」，第三欄寫「還要查什麼」。這樣一來，照片不再只是懷舊的畫面，而成為能夠提問、比較與修正想法的歷史材料。",
    ],
    glossary: [
      {
        term: "推論",
        definition: "根據已知線索，推想可能的情況。",
        example: "看見地面潮溼，可以推論剛下過雨，但仍需其他線索確認。",
      },
      {
        term: "查證",
        definition: "尋找其他資料，檢查原本的說法是否可靠。",
        example: "他查閱地圖，查證照片中的道路位置。",
      },
    ],
    sourceAttribution: [
      {
        publisher: "Library of Congress",
        url: "https://www.loc.gov/classroom-materials/community-people-and-places/",
        license: "教學方法參考；本文為原創改寫",
      },
    ],
    readingMinutes: 5,
    version: 1,
    readingStrategy: simpleStrategy.humanities,
    assessment: [
      {
        id: "old-photo-launch-q1",
        type: "comprehension",
        prompt: "老師第一次請小安做什麼？",
        options: [
          "先記下照片中真正看見的線索",
          "先查出每位路人的姓名",
          "先決定老街是否非常熱鬧",
          "先把照片中的招牌重新畫一遍",
        ],
      },
      {
        id: "old-photo-launch-q2",
        type: "inference",
        prompt: "為什麼不能只靠一張照片認定每個人都靠做生意生活？",
        options: [
          "照片只保留部分時間與角度，沒有完整說明人物生活",
          "照片中的招牌文字一定已經模糊",
          "老街上的推車通常不屬於店家",
          "地圖一定比照片記錄得更完整",
        ],
      },
      {
        id: "old-photo-launch-q3",
        type: "evidence",
        prompt: "哪一句最能支持「照片不等於完整故事」？",
        options: [
          "畫面裡有店鋪、推車、招牌和幾位路人",
          "老師沒有直接說他錯",
          "照片只留下某個時間、某個角度的畫面",
          "招牌上有文字",
        ],
      },
    ],
  }),
  "antarctic-voyage-v1": Object.freeze({
    id: "antarctic-voyage-v1",
    contentKey: "level-voyage-antarctic",
    category: "world",
    difficulty: "guided",
    level: "voyage",
    supportMode: "guided",
    textType: "vernacular",
    title: "各國如何把南極留給和平與科學？",
    hookQuestion: "主權爭議沒有消失，各國為什麼仍能合作？",
    body: [
      "南極洲看似遠離日常生活，卻不是沒有政治問題。二十世紀中葉，已有國家提出彼此重疊的領土主張，各國也陸續派出科學隊。南極可能成為共同研究地，也可能因主權與軍事競爭而緊張。今天人們常說南極被留給和平與科學，這並非自然形成，而是各國同意先用共同規則管理行動。",
      "一九五七至一九五八年的國際地球物理年，讓不同國家的科學家在南極合作觀測。十二個曾參與相關活動的國家，於一九五九年在華盛頓簽署《南極條約》，條約在一九六一年生效。它沒有把南極交給某個世界政府，也沒有讓各國立刻放棄原有立場，而是要求大家先遵守和平與研究規則。",
      "條約規定南極只能用於和平目的，禁止軍事基地、軍事演習與武器試驗，但軍事人員或設備若用於科學等和平任務，並非一概排除。條約也保障科學調查自由，鼓勵交換研究計畫、人員、觀測與成果。共同研究因此不只是收集知識，也讓立場不同的國家持續保持聯繫。",
      "只有口頭承諾仍不夠。締約方需要通報活動，協商國也能派觀察員進入相關區域與設施視察。公開資訊與相互查驗，使違規較難藏在遙遠冰原。條約同時保留各國原有主張，卻限制利用新活動擴大聲索。合作不必先解決所有爭議，仍可在可查驗的共同規則下進行。",
      "後來，南極條約體系又加入保護海豹、保存海洋生物資源與環境保護等安排。一九九一年簽署的《南極條約環境保護議定書》，把南極指定為致力和平與科學的自然保護區，並禁止除科學研究以外的礦產資源活動。這些規範顯示，共同治理不是簽一次條約便結束，而要隨著人類活動與環境風險持續補充。",
      "當然，規則不會讓所有問題自動消失。觀光人數、研究站運作、海洋資源與氣候變遷，都可能帶來新的壓力。真正重要的是：各國已建立定期開會、交換資料、相互查驗與修改規範的制度。即使彼此利益不同，仍能先把可合作的部分做成共同程序。",
      "因此，「把南極留給和平與科學」不是一句浪漫口號，而是一套需要不斷實踐的選擇。它承認爭議存在，卻不讓爭議成為軍事競爭的理由；它鼓勵研究，也要求研究者對環境負責。南極經驗提醒我們，合作未必從完全信任開始，有時是先建立能公開、能查驗、能修正的規則，信任才有機會慢慢累積。",
    ],
    glossary: [
      {
        term: "領土主張",
        definition: "國家宣稱某一地區屬於其主權範圍的立場。",
        example: "不同國家對同一片土地提出領土主張，可能產生爭議。",
      },
      {
        term: "締約方",
        definition: "加入條約並同意受其規範的國家。",
        example: "締約方必須按照條約內容通報相關活動。",
      },
      {
        term: "視察",
        definition: "進入區域或設施進行實際查驗。",
        example: "觀察員前往研究站視察設備用途。",
      },
    ],
    sourceAttribution: [
      {
        publisher: "Antarctic Treaty Secretariat",
        url: "https://www.ats.aq/e/antarctictreaty.html",
        license: "CC BY 4.0・事實改寫",
      },
    ],
    readingMinutes: 8,
    version: 1,
    readingStrategy: simpleStrategy.world,
    assessment: [
      {
        id: "antarctic-voyage-q1",
        type: "comprehension",
        prompt: "《南極條約》最主要建立了什麼安排？",
        options: [
          "各國先依共同規則維持和平與科學合作",
          "把南極平均分給十二個簽署國",
          "讓所有國家立刻放棄領土立場",
          "禁止任何軍事人員進入南極",
        ],
      },
      {
        id: "antarctic-voyage-q2",
        type: "inference",
        prompt: "相互視察為什麼有助於合作？",
        options: [
          "讓承諾可以被實際查驗，降低隱藏違規的可能",
          "讓觀察員直接決定各國的研究題目",
          "讓領土主張自然全部消失",
          "讓科學成果不必再公開交換",
        ],
      },
      {
        id: "antarctic-voyage-q3",
        type: "evidence",
        prompt: "哪一句最支持「合作不必先解決所有爭議」？",
        options: [
          "南極洲看似遠離日常生活",
          "共同研究因此不只是收集知識",
          "條約同時保留各國原有主張，卻限制利用新活動擴大聲索",
          "條約在一九六一年生效",
        ],
      },
    ],
  }),
  "moon-phases-voyage-v1": Object.freeze({
    id: "moon-phases-voyage-v1",
    contentKey: "level-voyage-moon-phases",
    category: "science",
    difficulty: "guided",
    level: "voyage",
    supportMode: "guided",
    textType: "vernacular",
    title: "月亮沒有變形：月相是怎麼來的？",
    hookQuestion: "同一顆月亮，為什麼每天看見的亮面不同？",
    body: [
      "連續幾晚抬頭看月亮，可能先看見細鉤般的亮邊，幾天後亮面變寬，再過一段時間成為圓月，接著又逐日縮小。月球並沒有改變形狀，雲層也無法造成每月重複的固定順序。這種規律外觀叫作月相，理解它的關鍵，是先確認光從哪裡來，再觀察太陽、地球與月球的相對位置。",
      "月球本身不會發光，月光其實是月球表面反射的陽光。太陽隨時照亮月球的一半；月球繞地球公轉時，地球上的觀察者看見受光半球的比例不斷改變。就像用手電筒照一顆球，球總有半面被照亮，但站在不同方向的人，可能看見整片、半片、細邊，或幾乎看不見亮面。",
      "從新月到下一次新月約需二十九點五天。亮面增加時，會經過眉月、上弦月與盈凸月，之後到達滿月；亮面減少時，則經過虧凸月、下弦月與殘月，再回到新月。這些名稱只是把連續變化切成方便描述的路標，天空中的亮面其實每天都在緩慢移動。",
      "月相也和月亮大約何時出現有關。新月大致和太陽同升同落；上弦月約在中午升起，傍晚常高掛天空；滿月約在日落時升起；下弦月則約在午夜升起。因此，白天看見月亮並不奇怪。日常月相也不是地球影子遮住所造成；地球影子落到月面形成的是月食，必須在特定位置對準時才會發生。",
      "要在生活中驗證這個模型，可以連續兩週在固定時間、固定地點觀察。每次記下日期、月亮方向、亮面朝向與大約高度，再把紀錄依時間排列。你會發現月亮每天出現的位置與時間都有變化，亮面朝向太陽的一側；單看一天不容易察覺的規律，放在連續紀錄裡便會逐漸清楚。",
      "觀察時也要留意限制。雲層、建築遮蔽與觀察時間不同，都可能讓某一天的紀錄缺漏；手機照片的曝光設定，甚至會把細小亮面拍得過亮。因此，一張照片不能代表完整月相週期。可靠的結論需要把多日紀錄、天文模型與實際觀察放在一起比較。",
      "理解月相的價值，不只是記住新月、上弦月與滿月的順序。更重要的是練習用同一個模型解釋多種現象：光源固定在哪裡？月球移到哪裡？觀察者從哪個方向看？只要這三個問題沒有混淆，就能判斷白天見月並不反常，也能分清月相與月食其實是不同的天文現象。",
    ],
    glossary: [
      {
        term: "月相",
        definition: "從地球看見的月球受光外觀產生的規律變化。",
        example: "新月、上弦月與滿月都是不同的月相。",
      },
      {
        term: "公轉",
        definition: "一個天體沿軌道繞另一個天體運行。",
        example: "月球公轉時，和地球、太陽的相對位置會改變。",
      },
      {
        term: "反射",
        definition: "光線碰到物體表面後改變方向。",
        example: "月球表面反射陽光，形成我們看見的月光。",
      },
    ],
    sourceAttribution: [
      {
        publisher: "NASA Science",
        url: "https://science.nasa.gov/moon/moon-phases/",
        license: "美國政府公開資訊・事實改寫",
      },
    ],
    readingMinutes: 8,
    version: 1,
    readingStrategy: simpleStrategy.science,
    assessment: [
      {
        id: "moon-phases-voyage-q1",
        type: "comprehension",
        prompt: "月相形成的主要原因是什麼？",
        options: [
          "地球看見的月球受光比例隨公轉改變",
          "月球每天改變自己的形狀",
          "雲層依固定順序遮住月球",
          "太陽只在滿月時照亮月球",
        ],
      },
      {
        id: "moon-phases-voyage-q2",
        type: "inference",
        prompt: "傍晚看見約半圓且亮面正在增加的月亮，最可能是哪一月相？",
        options: ["上弦月", "下弦月", "滿月", "新月"],
      },
      {
        id: "moon-phases-voyage-q3",
        type: "evidence",
        prompt: "哪一句最能反駁「月相都是地球影子造成」？",
        options: [
          "月光其實是月球表面反射的陽光",
          "天空中的亮面每天緩慢移動",
          "月食必須在特定位置對準時才會發生",
          "新月大致和太陽同升同落",
        ],
      },
    ],
  }),
  "historic-map-voyage-v1": Object.freeze({
    id: "historic-map-voyage-v1",
    contentKey: "level-voyage-historic-map",
    category: "humanities",
    difficulty: "guided",
    level: "voyage",
    supportMode: "guided",
    textType: "vernacular",
    title: "不準的古地圖，為什麼仍是真史料？",
    hookQuestion: "地圖上的誤差與空白，也能告訴我們歷史嗎？",
    body: [
      "打開十八世紀的臺灣古地圖，島嶼輪廓不像今天的衛星圖，山脈可能只畫成一排簡單山形，東部海岸也未完整呈現。若只把地圖當成尋路工具，它似乎不夠可靠；歷史研究卻還會追問：製圖者看見什麼、忽略什麼，又想把哪些地方納入秩序？誤差與空白有時也能成為線索。",
      "國立臺灣歷史博物館典藏一幅與清代測繪有關的臺灣地圖。館方推測這件印刷品製於十八世紀，產地是巴黎；它原本和傳教士書信及歐洲出版活動有關。這提醒我們，眼前的地圖不一定是測量現場的原稿，而可能經過傳遞、翻譯與印刷。判讀前，必須先確認版本與形成過程。",
      "圖面畫出主要城市、海岸線、河川，也標示行政中心與駐兵地點。這些醒目的符號顯示製圖者特別關注治理與交通節點，卻不能證明圖上沒有標出的地方就沒有人生活。地圖一定會取捨；被畫得詳細的區域，常和測量範圍、使用目的及當時能取得的資料有關。",
      "圖中山地間還有一條界線，界線以東部分未經實測。這片空白不能草率理解為「那裡沒有人」或「沒有歷史」，比較合理的說法是：製圖者掌握的資訊在此出現限制。閱讀古地圖時，可以把直接看見的符號放在一欄，把根據符號提出的推論放在另一欄，再用其他地圖、行政紀錄或地方材料交叉核對。",
      "古地圖的方向與比例也未必符合現代習慣。有些地圖把重要城鎮畫得特別大，把道路拉直，或依山川形勢安排版面。這不一定表示製圖者粗心，而可能是為了讓使用者快速看見行政關係、交通路線或防守位置。若只用現代精確比例評分，便會忽略地圖原本想完成的任務。",
      "同一地區若留下不同年代、不同用途的地圖，研究者便能進一步比較。某個地名突然出現，可能反映行政調整，也可能只是製圖資料變多；某條道路被強調，可能和交通、軍事或商業需求有關。這些都只是待驗證的推論，必須配合文書、地方記憶與考古材料，才不會把圖面變化直接當成歷史事實。",
      "所以，所謂「不準」要先問是對什麼目的而言。古地圖若不能拿來精確導航，仍可能忠實呈現一個時代如何分類土地、想像邊界與安排治理。讀圖的關鍵不是挑出它和現代地圖差多少，而是辨認直接證據、說明推論依據，並承認材料沒有告訴我們的部分。",
    ],
    glossary: [
      {
        term: "史料",
        definition: "可供研究與理解過去的人、事、物之材料。",
        example: "舊地圖、書信與照片都可能成為史料。",
      },
      {
        term: "測繪",
        definition: "實地測量位置、距離或方向後繪製圖件。",
        example: "測繪人員記錄河流與道路的位置。",
      },
      {
        term: "交叉核對",
        definition: "用不同來源互相比較，檢查說法是否可靠。",
        example: "研究者以行政紀錄和另一幅地圖交叉核對地名。",
      },
    ],
    sourceAttribution: [
      {
        publisher: "國立臺灣歷史博物館典藏網",
        url: "https://collections.nmth.gov.tw/CollectionContent.aspx?a=132&rno=2003.015.0041.0001",
        license: "館藏事實改寫；本文不重製圖片",
      },
    ],
    readingMinutes: 8,
    version: 1,
    readingStrategy: simpleStrategy.humanities,
    assessment: [
      {
        id: "historic-map-voyage-q1",
        type: "comprehension",
        prompt: "判讀古地圖前，文章建議先確認什麼？",
        options: [
          "地圖的版本與形成過程",
          "所有地名的現代讀音",
          "地圖是否比衛星圖美觀",
          "每位製圖者的私人生活",
        ],
      },
      {
        id: "historic-map-voyage-q2",
        type: "inference",
        prompt: "圖上行政中心特別醒目，最合理的推論是什麼？",
        options: [
          "圖面受到治理關注與使用目的影響",
          "未標行政中心的地區一定無人居住",
          "製圖者只想記錄自然景觀",
          "所有醒目符號都能直接證明全面控制",
        ],
      },
      {
        id: "historic-map-voyage-q3",
        type: "evidence",
        prompt: "哪一句最支持「地圖空白可能反映知識限制」？",
        options: [
          "島嶼輪廓不像今天的衛星圖",
          "這件印刷品的產地是巴黎",
          "界線以東部分未經實測",
          "圖面畫出主要城市與河川",
        ],
      },
    ],
  }),
});

export const levelDailyReadings = Object.freeze(
  Object.values(levelReadingsById).map(
    ({
      id,
      contentKey,
      category,
      difficulty,
      level,
      supportMode,
      textType,
      title,
      hookQuestion,
      readingMinutes,
      version,
    }) => ({
      id,
      contentKey,
      category,
      difficulty,
      level,
      supportMode,
      textType,
      title,
      hookQuestion,
      readingMinutes,
      version,
    }),
  ),
);
