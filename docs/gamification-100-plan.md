# 萬卷浮城：100 項遊戲化改版證據稽核

本文件逐項對照目前程式與測試。狀態定義：`✅` 驗收準則已有直接實作與測試證據；`🚫` 明確禁止，且已有防退步契約。稽核不以相近功能補數，也不把檔案存在視為功能完成。

本次稽核結果：96 項完成、4 項禁止並受測試保護。

## 四個實際評估視角

- **八角理論／倫理動機**：以使命、成長、創造、擁有感與社會合作支持學習；刻意排除稀缺、隨機、損失焦慮、公開排名與斷簽懲罰。
- **閱讀評量迴圈**：從讀前預測與策略，到段落導航、文證定位、診斷修正、遷移與間隔複習，獎勵只承認可解釋的學習證據。
- **班級合作與隱私**：共同任務採匿名角色、結構化投票、隱私門檻與聚合品質指標；不公開個人貢獻，也不收姓名、答案或自由文字。
- **家庭與城市長期參與**：家庭卡、故事章回、知識房、作品集與備份支援長期參與；休息、換週與回歸皆不清零，選擇可隨時調整。

## A. 身分、任務與自主性（001–025）

| ID | 狀態 | 修改需求 | 驗收準則／稽核結論 | 證據 |
|---|---|---|---|---|
| G001 | ✅ | 首次任務序章 | 同一畫面明列閱讀、找文證、建城三步驟，並提供略過按鈕。 | `src/ui/mission-dashboard.js`<br>`test/static/mission-dashboard.test.mjs` |
| G002 | ✅ | 閱讀者身分選擇 | 探索者、偵察者、策展者均為閱讀姿態，明示不代表程度高低。 | `src/ui/mission-dashboard.js`<br>`test/static/mission-dashboard.test.mjs` |
| G003 | ✅ | 今日學習意圖 | 可選主旨、推論或文證，選擇會回寫首頁任務設定。 | `src/ui/mission-dashboard.js`<br>`test/domain/gamification-profile.test.mjs` |
| G004 | ✅ | 閱讀時間預算 | 可選 5、10、15 分鐘，文案明示完成多少都算練習，無倒數。 | `src/ui/mission-dashboard.js`<br>`test/static/mission-dashboard.test.mjs` |
| G005 | ✅ | 內容類別偏好 | 可選世界、科學、人文或不限，並可再次修改。 | `src/domain/gamification-profile.js`<br>`test/domain/gamification-profile.test.mjs` |
| G006 | ✅ | 個人化續讀卡 | 未完成文章會顯示篇名與上次閱讀段落。 | `src/ui/mission-dashboard.js`<br>`test/static/mission-dashboard.test.mjs` |
| G007 | ✅ | 溫和回歸任務 | 相隔七日只提供從一小段回歸，明示不補進度、不歸零。 | `src/domain/gamification-profile.js`<br>`test/domain/gamification-profile.test.mjs` |
| G008 | ✅ | 每週閱讀目標 | 白名單為 0、1、3、5、7，0 顯示本週休息且不形成缺口。 | `src/domain/gamification-profile.js`<br>`test/domain/gamification-profile.test.mjs` |
| G009 | ✅ | 每週能力目標 | 主旨、推論、文證可作為每週練習焦點。 | `src/ui/mission-dashboard.js`<br>`test/static/mission-dashboard.test.mjs` |
| G010 | ✅ | 週目標進度 | 依本地週起點與當週唯一閱讀計算，不修改歷史紀錄。 | `src/domain/gamification-profile.js`<br>`test/domain/gamification-profile.test.mjs` |
| G011 | ✅ | 確定獎勵預覽 | 顯示下一活躍日固定獎勵，明示不是隨機結果。 | `src/ui/mission-dashboard.js`<br>`test/static/mission-dashboard.test.mjs` |
| G012 | ✅ | 能力裝備說明 | 每件裝備皆顯示能力說明與實際使用動作。 | `src/ui/mission-dashboard.js`<br>`test/domain/ability-mastery.test.mjs` |
| G013 | ✅ | 下一故事預覽 | 顯示下一個固定故事解鎖日，無倒數與過期。 | `src/ui/mission-dashboard.js`<br>`test/domain/journey-progression.test.mjs` |
| G014 | ✅ | 故事檔案入口 | details 故事檔案可回看已收藏章回，無連續登入條件。 | `src/ui/mission-dashboard.js`<br>`test/static/mission-dashboard.test.mjs` |
| G015 | ✅ | 本機城市命名 | 最長 20 字、移除尖括號，專用 localStorage 僅保存白名單欄位。 | `src/domain/gamification-profile.js`<br>`test/domain/gamification-profile.test.mjs` |
| G016 | ✅ | 城市外觀選擇 | 三種等價主題使用固定色彩，明示無稀有度。 | `src/domain/gamification-profile.js`<br>`test/domain/gamification-profile.test.mjs` |
| G017 | ✅ | 知識房間摘要 | 依城市文證投資分別統計世界、科學、人文三間知識房。 | `src/ui/mission-dashboard.js`<br>`test/static/mission-dashboard.test.mjs` |
| G018 | ✅ | 第二季說明 | 30 個活躍日後開新航季，舊城市、文證與徽章保留。 | `src/ui/mission-dashboard.js`<br>`test/domain/active-days.test.mjs` |
| G019 | ✅ | 精熟徽章 | 裝備解鎖來自能力成功證據，UI 明示只與自己比較。 | `src/domain/ability-mastery.js`<br>`test/domain/ability-mastery.test.mjs` |
| G020 | ✅ | 今日休息選項 | 首頁有「今天先休息」，完成頁有「今天先到這裡」。 | `src/ui/assessment-view.js`<br>`tests/e2e/assessment.spec.js` |
| G021 | ✅ | 學習作品集匯出 | 城市頁提供 JSON 匯出，包裝含資料字典與隱私說明。 | `src/domain/portfolio-export.js`<br>`test/domain/portfolio-export.test.mjs` |
| G022 | ✅ | 不歸零承諾 | 任務板明示休息與跨週不刪除既有成果。 | `src/ui/mission-dashboard.js`<br>`test/static/mission-dashboard.test.mjs` |
| G023 | ✅ | 不公開排名承諾 | 個人任務板明示不設公開排名。 | `src/ui/mission-dashboard.js`<br>`test/security/gamification-red-lines.test.mjs` |
| G024 | ✅ | 選擇可逆 | 身分、意圖、時間、類別、週目標均以可重按選項更新。 | `src/domain/gamification-profile.js`<br>`test/domain/gamification-profile.test.mjs` |
| G025 | ✅ | 任務面板無障礙 | fieldset／legend、button、aria-pressed、progressbar、aria-live 均已接線。 | `src/ui/mission-dashboard.js`<br>`test/static/mission-dashboard.test.mjs` |

## B. 閱讀與作答學習迴圈（026–050）

| ID | 狀態 | 修改需求 | 驗收準則／稽核結論 | 證據 |
|---|---|---|---|---|
| G026 | ✅ | 讀前預測 | 僅接受白名單結構化預測並保存在 sessionStorage。 | `src/domain/reading-quest.js`<br>`test/domain/reading-quest.test.mjs` |
| G027 | ✅ | 先選閱讀策略 | 開讀前可選主旨、因果、比較、文證等白名單策略。 | `src/ui/learning-loop.js`<br>`test/domain/reading-quest.test.mjs` |
| G028 | ✅ | 當篇時間計畫 | 只接受 5、10、15 分鐘，無逾時懲罰。 | `src/domain/reading-quest.js`<br>`test/domain/reading-quest.test.mjs` |
| G029 | ✅ | 段落路標 | 每段呈現段落序號、總段數與依類別衍生的閱讀階段。 | `src/ui/learning-loop.js`<br>`test/static/learning-loop.test.mjs` |
| G030 | ✅ | 段落完成旗標 | 手動旗標寫入當次 session，重開當次頁面可還原。 | `src/domain/reading-quest.js`<br>`test/domain/reading-quest.test.mjs` |
| G031 | ✅ | 詞彙收藏袋 | 只收藏文章既有核准詞條，保存在本機。 | `src/ui/learning-loop.js`<br>`test/domain/reading-quest.test.mjs` |
| G032 | ✅ | 焦點段落模式 | 可突出單一段落，也可關閉回復全文。 | `src/domain/reading-quest.js`<br>`test/domain/reading-quest.test.mjs` |
| G033 | ✅ | 文章結構圖 | 依文章類別將段落階段組成可掃讀結構圖。 | `src/domain/reading-quest.js`<br>`test/domain/reading-quest.test.mjs` |
| G034 | ✅ | 來源雷達 | 顯示來源總數、發布者數量、資料類型數量及逐筆發布者、類型、網域與授權。 | `src/ui/learning-loop.js`<br>`test/static/learning-loop.test.mjs`<br>`test/domain/reading-quest.test.mjs` |
| G035 | ✅ | 中途檢核 | 過半時出現非阻斷的主旨自我檢核。 | `src/ui/learning-loop.js`<br>`test/static/learning-loop.test.mjs` |
| G036 | ✅ | 鷹架淡出 | 可手動淡出或恢復段落提示，並有狀態宣告。 | `src/ui/learning-loop.js`<br>`test/static/learning-loop.test.mjs` |
| G037 | ✅ | 閱讀完成地圖 | 文末列出段落階段與完成標記，保留策略軌跡。 | `src/ui/learning-loop.js`<br>`test/static/learning-loop.test.mjs` |
| G038 | ✅ | 作答前信心量尺 | 每題有四級結構化信心選項並保留當次狀態。 | `src/ui/learning-loop.js`<br>`test/domain/reading-quest.test.mjs` |
| G039 | ✅ | 兩層提示階梯 | 第一層提示能力策略，第二層要求回到已定位段落。 | `src/ui/learning-loop.js`<br>`test/static/learning-loop.test.mjs` |
| G040 | ✅ | 先定位文證 | 作答區先提供段落選擇，選擇後才記錄查看文證。 | `src/ui/learning-loop.js`<br>`test/domain/reading-quest.test.mjs` |
| G041 | ✅ | 錯誤類型代碼 | 依理解、推論、文證顯示可解釋錯誤代碼。 | `src/domain/reading-quest.js`<br>`test/domain/reading-quest.test.mjs` |
| G042 | ✅ | 修正抽屜 | 錯題集中顯示回段落、比對詞語、換選項三步。 | `src/ui/learning-loop.js`<br>`test/static/learning-loop.test.mjs` |
| G043 | ✅ | 文證已查看狀態 | 當題查看狀態寫入 session，結果頁彙整查看題數。 | `src/ui/learning-loop.js`<br>`test/domain/reading-quest.test.mjs` |
| G044 | ✅ | 轉化應用題 | 完成後只能選預先定義的遷移任務，不收自由文字。 | `src/ui/learning-loop.js`<br>`test/domain/reading-quest.test.mjs` |
| G045 | ✅ | 間隔複習建議 | 由完成日產生隔 1、3、7 日的複習節點。 | `src/domain/reading-quest.js`<br>`test/domain/reading-quest.test.mjs` |
| G046 | ✅ | 三軸結果 | 理解、推論、文證分軸顯示正確與修正數。 | `src/ui/learning-loop.js`<br>`test/domain/reading-quest.test.mjs` |
| G047 | ✅ | 修正成長回饋 | 比較首次與最終結果，明示修正帶來的進步。 | `src/ui/learning-loop.js`<br>`test/static/learning-loop.test.mjs` |
| G048 | ✅ | 重試檢查點 | 由實際錯題逐題產生能力、錯誤代碼與文證段落接續指引，不要求全文重讀。 | `src/domain/reading-quest.js`<br>`test/domain/reading-quest.test.mjs`<br>`test/static/learning-loop.test.mjs` |
| G049 | ✅ | 當次選擇保留 | 答案、信心、提示與文證段落保存在當次 session。 | `src/domain/reading-quest.js`<br>`test/domain/reading-quest.test.mjs` |
| G050 | ✅ | 學習迴圈無障礙 | 高對比、焦點、reduced-motion、aria-live 與鍵盤契約已涵蓋。 | `src/theme/accessibility.css`<br>`test/static/learning-loop.test.mjs` |

## C. 班級共同任務（051–065）

| ID | 狀態 | 修改需求 | 驗收準則／稽核結論 | 證據 |
|---|---|---|---|---|
| G051 | ✅ | 週次由伺服器計算 | period 由伺服器時鐘產生，忽略用戶端任意值。 | `worker/src/api/classroom.js`<br>`test/api/classroom.test.mjs` |
| G052 | ✅ | 永久地標與週任務分離 | 歷史總量與當週 aggregate 分欄計算。 | `worker/src/api/classroom.js`<br>`test/api/classroom.test.mjs` |
| G053 | ✅ | 週任務目標契約 | API 回傳 weeklyMissionTarget 與 weeklyRemainingToGoal。 | `worker/src/api/classroom.js`<br>`test/api/classroom.test.mjs` |
| G054 | ✅ | 週進度自然換週 | repository 依 ISO 週查詢，不改寫舊週貢獻。 | `worker/src/db/repository.js`<br>`test/api/repository.test.mjs` |
| G055 | ✅ | 週進度介面 | 學生進度條使用 weeklyValidReadings／missionProgress。 | `src/ui/class-view.js`<br>`tests/e2e/class-coop.spec.js` |
| G056 | ✅ | 小班隱私分桶 | 未達門檻只回安全 progress band，精確人數與細分欄位不回傳。 | `worker/src/api/classroom.js`<br>`test/api/classroom.test.mjs` |
| G057 | ✅ | 班級任務三選一 | 老師可選共同篇數、類別平衡、能力練習並 POST 結構化代碼。 | `src/ui/classroom-management.js`<br>`test/static/class-mission-ui.test.mjs` |
| G058 | ✅ | 學生匿名投票 | 僅接受三種代碼，結果達隱私門檻才回傳與顯示。 | `worker/src/api/classroom.js`<br>`test/api/class-missions.test.mjs` |
| G059 | ✅ | 匿名合作角色 | 探路、查證、整理依匿名權杖與週期決定，不含姓名。 | `src/domain/class-mission.js`<br>`test/domain/class-mission.test.mjs` |
| G060 | ✅ | 匿名觀點牆 | 結束單只接受三個代碼，失敗保留重試，分布受門檻保護。 | `src/ui/class-view.js`<br>`tests/e2e/class-coop.spec.js` |
| G061 | ✅ | 拼圖閱讀任務 | 三類完成片段只在門檻後顯示，不列個人。 | `src/ui/class-view.js`<br>`test/static/class-mission-ui.test.mjs` |
| G062 | ✅ | 共同完成動畫 | 匿名任務鍵確保只播一次，reduced-motion 下維持靜態訊息。 | `src/domain/class-mission.js`<br>`test/domain/class-mission.test.mjs` |
| G063 | ✅ | 類別平衡圖 | 門檻後顯示世界、科學、人文三類分布；門檻前完全隱藏。 | `src/ui/class-view.js`<br>`test/domain/class-mission.test.mjs` |
| G064 | ✅ | 能力平衡圖 | 門檻後顯示理解、推論、文證聚合；門檻前完全隱藏。 | `src/ui/class-view.js`<br>`test/static/class-mission-ui.test.mjs` |
| G065 | ✅ | 班級任務可解釋性 | 呈現週期、目標、有效閱讀定義、門檻與隱私說明。 | `src/domain/class-mission.js`<br>`test/domain/class-mission.test.mjs` |

## D. 教師、家庭與可攜性（066–080）

| ID | 狀態 | 修改需求 | 驗收準則／稽核結論 | 證據 |
|---|---|---|---|---|
| G066 | ✅ | 教師能力熱圖 | 只在門檻後呈現班級聚合能力，不列學生。 | `src/ui/classroom-management.js`<br>`tests/e2e/teacher-classrooms.spec.js` |
| G067 | ✅ | 十分鐘介入卡 | 依最低能力產生 10 分鐘活動，按鈕與列印樣式只輸出目前介入卡。 | `src/ui/classroom-management.js`<br>`test/static/class-mission-ui.test.mjs` |
| G068 | ✅ | 班級碼深連結 | 深連結僅含 #/class?code=短期班級碼，不含姓名或識別。 | `src/domain/class-mission.js`<br>`test/domain/class-mission.test.mjs` |
| G069 | ✅ | 教師指派任務 | 文章、能力、路線與可選期限均採嚴格結構化 payload，期限不扣分、不倒數。 | `src/ui/classroom-management.js`<br>`test/api/class-missions.test.mjs` |
| G070 | ✅ | 差異化路線 | 引導、獨立與兩者等價均明示相同完成標準。 | `src/ui/classroom-management.js`<br>`test/static/class-mission-ui.test.mjs` |
| G071 | ✅ | 結束單 | 只接受三個策略理解代碼，不接受自由文字或額外欄位。 | `worker/src/api/classroom.js`<br>`test/api/class-missions.test.mjs` |
| G072 | ✅ | 家庭具體稱讚卡 | 依修正、查看文證或自主節奏產生具體稱讚。 | `src/domain/family-report.js`<br>`test/domain/family-report.test.mjs` |
| G073 | ✅ | 家庭對話卡 | 依卡關能力產生可口頭討論題，不需上傳。 | `src/domain/family-report.js`<br>`test/domain/family-report.test.mjs` |
| G074 | ✅ | 家庭共同目標 | 可選只陪伴、一週一次或三次，明示不比較、不扣進度。 | `src/ui/family-view.js`<br>`test/domain/family-report.test.mjs` |
| G075 | ✅ | 家庭故事卡 | 家庭報告由孩子城市的最新 storyUnlocks 產生已解鎖章回共讀提問卡。 | `src/ui/family-view.js`<br>`src/domain/family-report.js`<br>`test/domain/family-report.test.mjs` |
| G076 | ✅ | 作品集可讀匯出 | 匯出包含資料字典、能力證據、完整狀態與隱私說明。 | `src/domain/portfolio-export.js`<br>`test/domain/portfolio-export.test.mjs` |
| G077 | ✅ | 備份健康提醒 | 依 0、1、5、10 等本機成果里程碑溫和提醒，可略過。 | `src/domain/backup-health.js`<br>`test/domain/backup-health.test.mjs` |
| G078 | ✅ | 離線週包 | 最多保存七篇正文與題目資料，UI 明示圖片及線上評分限制。 | `src/storage/offline-pack.js`<br>`test/storage/offline-pack.test.mjs` |
| G079 | ✅ | 匯入重算獎勵 | 匯入後由有效閱讀重建材料、建築與能力，不信任任意獎勵欄位。 | `src/storage/local-store.js`<br>`test/storage/local-store.test.mjs` |
| G080 | ✅ | 跨裝置衝突說明 | 先比較本機／雲端來源、版本與時間，再由家長選擇並可先備份。 | `src/ui/family-view.js`<br>`test/static/family-conflict-explanation.test.mjs` |

## E. 無障礙、福祉、安全與品質（081–100）

| ID | 狀態 | 修改需求 | 驗收準則／稽核結論 | 證據 |
|---|---|---|---|---|
| G081 | ✅ | 易讀模式 | 可切換短行寬、較大行距與段距，偏好保存在本機。 | `src/theme/accessibility.css`<br>`test/static/learning-loop.test.mjs` |
| G082 | ✅ | 高對比模式 | 實際 CSS 色票的文字、控制項、焦點與圖表均以對比函式重算並達 WCAG AA。 | `src/theme/accessibility.css`<br>`src/domain/reading-quest.js`<br>`test/static/high-contrast-audit.test.mjs` |
| G083 | ✅ | 語音朗讀 | 使用 speechSynthesis，需手動啟動並提供暫停、繼續、停止。 | `src/ui/learning-loop.js`<br>`test/static/learning-loop.test.mjs` |
| G084 | ✅ | 行動拇指操作列 | 小螢幕使用底部 sticky 操作列並預留正文底部空間。 | `src/theme/accessibility.css`<br>`tests/e2e/mobile-tablet.spec.js` |
| G085 | ✅ | 減少動態完整覆蓋 | 全域動畫與轉場在 reduced-motion 下縮至單次極短時間，新班級動畫另行停用。 | `src/theme/motion.css`<br>`tests/e2e/accessibility.spec.js` |
| G086 | ✅ | 可見焦點 | 互動控制使用一致的三像素外框與 offset，鍵盤主流程有 E2E。 | `src/theme/accessibility.css`<br>`tests/e2e/accessibility.spec.js` |
| G087 | ✅ | 狀態不只靠顏色 | 正誤、選取、進度與完成均有文字、符號或邊線線索。 | `src/theme/accessibility.css`<br>`test/static/learning-loop.test.mjs` |
| G088 | ✅ | 觸控目標 | 閱讀、作答、班級與備份主要控制項設為至少 44px。 | `src/theme/accessibility.css`<br>`test/static/backup-dialog-accessibility.test.mjs` |
| G089 | ✅ | 平實語言 | 學習介面禁止羞辱、隨機獎勵與賭博式詞彙，錯誤訊息提供下一步。 | `src/ui/learning-loop.js`<br>`test/security/gamification-red-lines.test.mjs` |
| G090 | 🚫 | 禁止排行榜與抽箱 | 靜態契約掃描 UI／domain，阻止 leaderboard、loot box、rarity。 | `src/ui/mission-dashboard.js`<br>`test/security/gamification-red-lines.test.mjs` |
| G091 | 🚫 | 禁止連續天數懲罰 | 程式明示不歸零，安全測試阻止 streak reset 與 missed reward。 | `src/domain/gamification-profile.js`<br>`test/security/gamification-red-lines.test.mjs` |
| G092 | 🚫 | 禁止公開個人貢獻 | 班級回應僅提供門檻後聚合，UI 明示不列個人。 | `worker/src/api/classroom.js`<br>`test/api/classroom.test.mjs` |
| G093 | 🚫 | 禁止上傳自由文字與身分 | 班級貢獻、投票、結束單只接受白名單欄位並拒絕姓名／答案／反思。 | `src/domain/class-contribution.js`<br>`test/security/gamification-red-lines.test.mjs` |
| G094 | ✅ | 一次性完成證明 | 通過作答才簽發短效證明，簽章、到期與 nonce 重播皆驗證。 | `worker/src/api/assessment.js`<br>`test/api/classroom.test.mjs` |
| G095 | ✅ | 每週標準內容鍵 | 班級貢獻以 canonicalContentKey 去重，同篇不同版本／模式只計一次。 | `src/storage/class-contribution-queue.js`<br>`test/storage/class-contribution-queue.test.mjs` |
| G096 | ✅ | 貢獻速率限制 | 匿名權杖每分鐘 3 次、班級每分鐘 120 次，超限回 429。 | `worker/src/api/classroom.js`<br>`test/api/classroom.test.mjs` |
| G097 | ✅ | 異常貢獻過濾 | 作答開始時間由伺服器簽章，過快完成、重複內容、重播與過期證明均不計入聚合。 | `worker/src/api/assessment.js`<br>`worker/src/api/classroom.js`<br>`test/api/assessment.test.mjs`<br>`test/api/classroom.test.mjs` |
| G098 | ✅ | 等價題池 | 三項能力各有至少兩個白名單題框，同 session 穩定且不改評分語義。 | `src/domain/assessment-variants.js`<br>`test/domain/assessment-variants.test.mjs` |
| G099 | ✅ | 學習品質指標 | 教師僅見首次正確、修正成功、文證查看、遷移完成四項門檻後聚合率。 | `worker/src/api/classroom.js`<br>`test/api/class-missions.test.mjs` |
| G100 | ✅ | 明確同意的最小遙測 | 匿名統計預設關閉，UI 可退出；隱私文件列出用途、五欄、45 日保留與排程清除。 | `src/ui/usage-guide.js`<br>`test/static/privacy-opt-in.test.mjs`<br>`docs/privacy.md` |

## 完成判定

- 96 項功能驗收均有直接程式與測試證據；G090–G093 是刻意禁止的設計，其完成意義是禁止規則持續受契約測試保護。
- 此表驗證程式庫內功能證據；部署成功與正式網址實測由部署／驗收流程另行提供紀錄。
