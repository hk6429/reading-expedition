# 三平台部署手冊

## 架構

Cloudflare Worker 是唯一內容、教師與家庭護照 API；Cloudflare Pages、Vercel、Netlify 都發布同一份 `dist/`。三個前端以同源 `/api` 代理 Worker，避免把後端網址寫進 bundle，也維持教師與家庭護照的安全 cookie、CSRF 流程。

三平台各自使用 host-only cookie，因此同一組家庭護照碼第一次在不同網域使用時，必須各登入一次；登入後共用中央 D1 的孩子、閱讀紀錄與裝備資料，不會在瀏覽器間共享 cookie。

## 環境變數名稱

- Worker secret：`TEACHER_KEY_HASH`
- 三個前端：`READING_API_ORIGIN`
- Cloudflare Worker D1 binding：`READING_DB`

文件與建置紀錄只列變數名稱，不保存值。

## Codex CLI 手動內容庫

正式環境不設定每日 AI Cron，也不綁定雲端 AI。內容由教師在本機使用已登入的 Codex CLI 人工策展，目標為 30 個閱讀主題；每個主題包含 guided 與 challenge 雙難度、每篇三題，合計 60 篇正文與 180 題。

```sh
npm run content:new -- --slug moon-phases "月相為什麼會改變"
npm run content:validate
npm run content:ready
npm run content:sql
npx wrangler d1 execute reading-expedition --remote \
  --config wrangler.worker.toml \
  --file tmp/manual-content.sql
```

`content:new` 只呼叫本機 Codex CLI，沿用既有登入狀態，不讀取、不複製也不輸出 OAuth 憑證。每一組草稿固定保存為 `content/manual/drafts/*.json`；未達 30 組、字數不足、答案不唯一、文證不在正文、來源不完整或雙難度不成立時，`content:ready` 必須失敗，不能匯入正式 D1。所有匯入內容固定為 `manual_review`，仍須教師登入後核准才能發布。

## Preview 隔離

Preview D1 與正式 D1 必須是不同資料庫；Preview Worker 只能綁 Preview D1。Vercel Preview、Netlify Draft 與 Cloudflare Pages Preview 的 `READING_API_ORIGIN` 都指向 Preview Worker，不得連正式資料庫。

## 正式順序

1. 對正式 D1 套用 migration，包含第 0009 號家庭護照與閱讀分級 migration。
2. 部署中央 Cloudflare Worker。
3. 以人工種子內容完成教師校閱與發布。
4. 部署 Cloudflare Pages。
5. 部署 Vercel Production。
6. 部署 Netlify Production。
7. 對三站加 cache-busting query 逐站驗收。

三個前端的 `/api` 路徑分工如下：

- Cloudflare Pages：建置時產生 `_redirects`，代理至 Worker。
- Vercel：由 `vercel.ts` 的 rewrite 代理至 Worker。
- Netlify：只使用 `netlify/functions/api.mjs`，建置時不產生會與函式競爭的 `_redirects`。

## 驗證

```sh
npm ci
npm test
npm run build
npm run test:e2e
git diff --check
```

正式站還要逐站驗證：

1. 首頁能看到「程度測讀」與「家庭護照」，Service Worker 為目前版本。
2. 建立一組暫時家庭護照，確認回應含安全 cookie 與 CSRF，但日誌不輸出護照碼。
3. 在另外兩個網域用同一護照碼各登入一次，確認能讀到相同孩子。
4. 從第二個網域同步狀態，第三個網域能讀到新版本。
5. 用舊版本寫入時必須回傳衝突，不能覆蓋較新的資料。
6. 刪除暫時家庭後，三個網域的原 session 都應失效。

## 正式網址

- Cloudflare Pages：`https://reading-expedition-2u1.pages.dev/`
- Vercel：`https://reading-expedition.vercel.app/`
- Netlify：`https://reading-expedition.netlify.app/`
- Worker API：`https://reading-expedition-api.hk6429.workers.dev/`
