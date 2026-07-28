import { journeyRewardForActiveDay } from "../domain/journey-progression.js";

const TITLES = Object.freeze([
  "墨海來潮", "無字航圖", "三路分流", "行舟與登樓", "第一盞義燈",
  "神行急報", "百步摘句", "真假潮痕", "數字有腳", "誰在說話",
  "因果繩結", "舊聞新衣", "缺角的地圖", "明辨樓成", "眾聲入港",
  "交換一盞燈", "不同的公平", "看見沉默者", "共守一口井", "遠方的鄰人",
  "聚義成橋", "回看來時路", "把疑問留下", "一卷連一卷", "知識入城",
  "修築自己的路", "為未來留燈", "新航圖展開", "萬卷同流", "浮城啟航",
]);

const STORIES = Object.freeze([
  "濁墨潮沖散了書寨。武松請你帶回第一份可信文證，為浮城立下地基。",
  "吳用攤開一張無字航圖：來源與日期，將決定知識能不能安全入港。",
  "三條航線在雲海上亮起。今天的選擇，會成為你第一張個人航圖。",
  "行舟與登樓只是兩種路徑。魯智深提醒：選適合今天的，不代表能力高低。",
  "第一盞義燈在城門亮起。你找到的文證，讓居民知道什麼消息值得相信。",
  "戴宗送來一封急報。先辨認日期與脈絡，才不會讓舊聞披著新衣進城。",
  "吳用邀你挑出一段真正承重的句子，首週文證卷也將在今夜展開。",
  "武松沿著潮痕追查來源。相似的說法，不一定指向同一個事實。",
  "百工水寨傳來數字爭議。單位、比例與基準，都是不能漏看的腳印。",
  "一封匿名書信藏著立場。辨清誰在說話，第二張航圖便會浮現。",
  "軍師望臺掛起因果繩結。先後發生的兩件事，不一定互為原因。",
  "舊聞換了標題再次入港。你必須比對日期，才能辨認它的真正來處。",
  "天下驛站收到一張缺角地圖。缺少的資料，有時比已知答案更重要。",
  "明辨樓落成。回看兩週航程，你已開始形成自己的閱讀策略。",
  "不同人物的聲音同時湧入港口。把觀點分開，才能看見爭議全貌。",
  "扈三娘請你交換一盞義燈：先理解別人的理由，再說出自己的判斷。",
  "同一把尺不一定帶來公平。今天的任務，是找出誰承受了不同影響。",
  "魯智深指向人群後方。沒有被引述的人，也可能是理解事件的重要線索。",
  "眾人要共守一口井。資料、需求與規則，必須一起放上桌面。",
  "天下驛站收到遠方回信。陌生人的生活，正在與我們的選擇相互連結。",
  "全班蒐集的文證搭成一座橋。沒有排名，只有一塊塊共同放下的石材。",
  "宋江翻開舊卷。回看曾經修正的地方，能看見自己真正學會的策略。",
  "吳用留下一個沒有標準答案的問題，邀你把疑問收藏進自己的城。",
  "一篇文章牽出另一篇。當文證彼此連結，城市便不再只是孤立的建築。",
  "讀過的知識開始在浮城裡工作：書樓、望臺、水寨與驛站各有用途。",
  "你不必照著別人的路修城。選擇收藏什麼，會慢慢長成自己的閱讀樣子。",
  "扈三娘把一盞燈留在城牆。它不會熄滅，只等下一次好奇心回來。",
  "新的航圖展開，舊城市仍完整保留。下一步，是把不同領域連成路。",
  "萬卷在四座地標之間流動。你讀過的文證，已經成為城市的共同記憶。",
  "浮城離開墨海，向下一航季啟程。三十日成果將被封入個人閱征卷軸。",
]);

const STORY_UNLOCKS = Object.freeze({
  3: "個人三路航圖",
  5: "第一盞義燈",
  7: "首週文證卷",
  10: "立場羅盤",
  14: "明辨回顧卷",
  17: "公平之橋",
  21: "班級聚義橋",
  24: "萬卷連結圖",
  27: "未來義燈",
  30: "個人閱征卷軸",
});

const MENTORS = Object.freeze(["武松", "吳用", "魯智深", "扈三娘", "宋江"]);

function phaseFor(activeDay) {
  if (activeDay <= 7) return "安家";
  if (activeDay <= 14) return "明辨";
  if (activeDay <= 21) return "聚義";
  return "開城";
}

export const chapterCatalog = Object.freeze(
  TITLES.map((title, index) => {
    const activeDay = index + 1;
    const phase = phaseFor(activeDay);
    const reward = journeyRewardForActiveDay(activeDay);
    return Object.freeze({
      id: `chapter-${String(activeDay).padStart(2, "0")}`,
      activeDay,
      phase,
      title,
      story: STORIES[index],
      mentor: MENTORS[index % MENTORS.length],
      rewardType: reward.type,
      rewardTitle: reward.title,
      unlock: STORY_UNLOCKS[activeDay] ?? null,
      review: [7, 14, 21, 30].includes(activeDay),
      skippable: true,
      blocksReading: false,
    });
  }),
);

export function chapterForActiveDay(activeDay) {
  const safeDay = Math.min(Math.max(Number(activeDay) || 1, 1), 30);
  return chapterCatalog[safeDay - 1];
}
