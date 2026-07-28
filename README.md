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
- 答錯回到原文，可修正一次；不以速度、排名或斷簽施壓。
- 30 個活躍日章回、四階段浮城成長與每週文證回顧。
- 本機優先、離線閱讀、匿名班級共同地標。
- 教師安全登入、雙版本校閱、退回、發布、下架與稽核紀錄。
- 每日排程擷取核准來源，建立雙來源事實包，再生成改寫文章與題目。
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
- 每日排程：台北時間 05:00。
- 前端一律使用同源 `/api`；平台代理由 `READING_API_ORIGIN` 設定。

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
