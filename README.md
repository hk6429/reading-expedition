# 萬卷浮城：梁山閱征記

國中七至九年級每日十分鐘閱讀系統。學生從世界、科學、人文三條航線選一篇，完成理解與原文文證任務，把知識逐步建成自己的萬卷浮城。

## 專案狀態

目前正在建立第一條「閱讀、文證、修正、建城」垂直切片，尚未部署。

## 資料邊界

- 個人閱讀位置、城市、收藏與反思保存在這部裝置。
- 第一版不收姓名、學號、Email、學校或班級真名。
- 伺服器只保存已發布內容、審核紀錄與達隱私門檻的匿名班級彙總。
- 不使用公開排行榜、抽卡、斷簽歸零或侵入式監控。

## 本機開發

需求：

- Node.js 24 LTS
- npm

執行測試：

```sh
npm test
```

啟動靜態開發站：

```sh
npm run dev:web
```

## 文件

- 產品規格：`../../docs/superpowers/specs/2026-07-28-reading-expedition-water-margin-design.md`
- 實作計畫：`../../docs/superpowers/plans/2026-07-28-reading-expedition-water-margin-implementation.md`
