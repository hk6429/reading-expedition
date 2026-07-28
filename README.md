# 萬卷浮城：梁山閱征記

國中七至九年級每日十分鐘閱讀系統。學生從世界、科學、人文三條航線選一篇，完成理解與原文文證任務，把知識逐步建成自己的萬卷浮城。介面以手機與平板優先，採 Q 版人物、國畫潑墨與水彩流動邊緣的原創水滸靈感世界。

## 專案狀態

正式環境已部署，三站共用同一個 Cloudflare Worker API 與 Production D1：

- Cloudflare Pages：https://reading-expedition-2u1.pages.dev/
- Vercel：https://reading-expedition.vercel.app/
- Netlify：https://reading-expedition.netlify.app/
- GitHub：https://github.com/hk6429/reading-expedition

## 核心功能

- 行舟卷／登樓卷雙難度，學生自行選擇。
- 每篇固定三題：找重點、想意思、找證據；手機與平板一次只顯示一題。
- 答錯可在題目頁內回看原文線索並修正一次；不以速度、排名或斷簽施壓。
- 30 個活躍日章回、四階段浮城成長與每週文證回顧。
- 本機優先、離線閱讀、匿名班級共同地標。
- 教師安全登入、雙版本校閱、退回、發布、下架與稽核紀錄。
- 教師可在本機用已登入的 Codex CLI 隨時新增主題；來源、文章與題組通過自動檢核後，仍先進教師校閱。
- 白話文依難度為 300–450／450–600 個漢字；文言文 120–300 個漢字並附 3–8 則正文內注釋。
- 命題參考會考與學測的閱讀能力層次，但明文禁止複製或改寫歷屆考題。
- 來源、授權、事實、原創度、難度、題目、安全與品質 92 分發布門檻。

## 資料邊界

- 個人閱讀位置、城市、收藏與偏好保存在這部裝置。
- 第一版不收姓名、學號、Email、學校或班級真名。
- 伺服器只保存內容、審核稽核、固定欄位匿名成效事件與達五人門檻的班級彙總。
- 不使用公開排行榜、抽卡、斷簽歸零或侵入式監控。

## 本機開發

需求：

- Node.js 24 LTS
- npm

安裝、建置與測試：

```sh
npm ci
npm run build
npm test
npm run test:e2e
```

啟動包含 Pages Functions 的本機站：

```sh
npm run dev:web
```

預設位置為 `http://127.0.0.1:8788`。

## 系統架構

- 三個靜態前端：Cloudflare Pages、Vercel、Netlify。
- 單一中央 API：Cloudflare Worker。
- 中央資料庫：Cloudflare D1，Preview 與 Production 完全分離。
- 正式環境不設內容生成排程，也不綁定雲端 AI；內容由本機 Codex CLI 人工選題與產生。
- 後端部署固定使用 `npm run deploy:worker`；`wrangler.worker.toml` 與 Pages 本機測試設定分離。
- 前端一律使用同源 `/api`；平台代理由 `READING_API_ORIGIN` 設定。

## 手動新增閱讀內容

Codex CLI 會沿用本機已登入的 ChatGPT 身分，不必把 OAuth 憑證或 API Key 寫進專案。每次自行選一個主題：

```sh
npm run content:new -- --slug moon-phases "月相為什麼會改變"
```

草稿會寫入 `content/manual/drafts/`，且不覆寫同名檔。可隨時檢查目前累積內容：

```sh
npm run content:validate
```

完成 30 組主題後，再執行完整數量與三類配額檢核，產生 D1 匯入檔：

```sh
npm run content:ready
npm run content:sql
```

每組主題保留行舟卷、登樓卷雙難度，因此 30 組會形成 60 篇正文、180 題；匯入後仍為待審稿，必須由教師核准才會上線。

## 測試

- Node 內建測試：領域、儲存、API、資料庫、生成管線、資安、效能與靜態契約。
- Playwright：手機、平板、桌機、離線、鍵盤、200% 字級、reduced motion 與完整閱讀流程。
- CI 固定 Node.js 24，Pull Request 與 main push 均執行完整測試。

## 文件

- 部署手冊：`docs/deployment.md`
- 隱私說明：`docs/privacy.md`
- 內容政策：`docs/content-policy.md`
- 來源政策：`docs/source-policy.md`
- 指標定義：`docs/verification/metric-definitions.md`
- 安全檢核：`docs/verification/security-checklist.md`
- 產品規格：`../../docs/superpowers/specs/2026-07-28-reading-expedition-water-margin-design.md`
- 實作計畫：`../../docs/superpowers/plans/2026-07-28-reading-expedition-water-margin-implementation.md`
