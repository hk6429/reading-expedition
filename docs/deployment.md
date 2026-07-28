# 三平台部署手冊

## 架構

Cloudflare Worker 是唯一內容與教師 API；Cloudflare Pages、Vercel、Netlify 都發布同一份 `dist/`。三個前端以同源 `/api` 代理 Worker，避免把後端網址寫進 bundle，也維持教師安全 cookie 與 CSRF 流程。

## 環境變數名稱

- Worker secret：`TEACHER_KEY_HASH`
- Worker AI binding：`AI`
- Worker vars：`GENERATION_MODEL`、`GENERATION_MAX_RETRIES`
- 備援 OpenAI-compatible provider（非預設）：`GENERATION_API_BASE`、`GENERATION_API_KEY`
- 三個前端：`READING_API_ORIGIN`
- Cloudflare Worker D1 binding：`READING_DB`

文件與建置紀錄只列變數名稱，不保存值。

## Preview 隔離

Preview D1 與正式 D1 必須是不同資料庫；Preview Worker 只能綁 Preview D1。Vercel Preview、Netlify Draft 與 Cloudflare Pages Preview 的 `READING_API_ORIGIN` 都指向 Preview Worker，不得連正式資料庫。

## 正式順序

1. 對正式 D1 套用 migration。
2. 部署中央 Cloudflare Worker。
3. 以人工種子內容完成教師校閱與發布。
4. 部署 Cloudflare Pages。
5. 部署 Vercel Production。
6. 部署 Netlify Production。
7. 對三站加 cache-busting query 逐站驗收。

## 驗證

```sh
npm ci
npm test
npm run build
npm run test:e2e
git diff --check
```

## 正式網址

- Cloudflare Pages：`https://reading-expedition-2u1.pages.dev/`
- Vercel：`https://reading-expedition.vercel.app/`
- Netlify：`https://reading-expedition.netlify.app/`
- Worker API：`https://reading-expedition-api.hk6429.workers.dev/`
