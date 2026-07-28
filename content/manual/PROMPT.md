# 手動閱讀主題生成規格

你是台灣國中閱讀教材編輯。請為「{{TOPIC}}」建立一組可匯入閱讀遠征的 JSON 草稿，識別碼使用 `{{SLUG}}`，日期使用 `{{DATE}}`。

必要規格：

1. 只使用可追溯的政府、學術、博物館、公共媒體或原始機構來源；不可捏造網址、數字、人物、日期、因果或引文。
2. 不複製來源長段落，只取事實後以繁體中文重新編寫，並清楚保存來源與授權狀態。
3. 產生 guided 與 challenge 兩份正文，共用同一事實包。
4. 白話文每篇正文 300～600 個漢字；文言文每篇 120～300 個漢字並附 3～8 則正文內注釋。未特別需要時使用白話文。
5. challenge 必須比 guided 增加篇幅、句子整合或詞彙負荷。
6. 每篇固定三題，依序為 comprehension、inference、evidence；每題四個選項且只有一個最佳答案。
7. 每題保存正解、解析、三個不同的干擾理由，以及正文內可逐字對應的 evidenceSpan。
8. `hardGateStatus` 固定為 `passed`，`publicationStatus` 固定為 `manual_review`，`qualityScore` 固定為 100，`version` 固定為 1。
9. 所有 ID 都以 `{{SLUG}}` 為前綴，不得與其他主題共用。
10. 只輸出符合指定 JSON Schema 的物件，不要輸出 Markdown 或補充說明。
