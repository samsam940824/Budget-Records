# Changelog

## [Unreleased] - 2026-04-15

### 🐛 Bug Fixes
- **App.tsx**: 修正全域搜尋使用 `tx.note` 不存在的欄位,改為 `tx.description`,搜尋備註才會生效。
- **App.tsx**: 修正 `useMemo` 與 `return` 寫在同一行的程式碼可讀性問題。
- **App.tsx**: 年份選單原本寫死 2024–2028,改為「當前年份 ±2、±4」動態產生,避免 2029 後失效。
- **Overview.tsx**: 「總支出」與圓餅圖原本將 `income` 也算入,現在只統計 `type === 'expense'`。
- **Overview.tsx**: 「平均每日額」原本固定除以 365,改為依當前 `timeFilter` 區間天數計算,在月/自訂區間下才正確。
- **BudgetView.tsx**: 預算花費原本一律以「整年」累計且未過濾 expense,改為依 `repeat` (daily/weekly/monthly/yearly/none) 計算當期區間,並以 `budget_reset_day` 設定月期間起始,且只計算支出。
- **BudgetView.tsx**: 預算清單顯示的期間文字原本永遠寫死「1月XX日」,改為依當期實際 start/end 顯示。
- **RecordList.tsx**: 「總支出」原本忽略時間/分類篩選並把 income 也加總,現已改為與當前 filter 一致且只計支出。每日小計同樣只算支出。
- **useTransactions.ts**: `useEffect` 依賴從整個 `user` 物件改為 `user?.id`,避免 session refresh 觸發重複 fetch。
- 移除 `package.json` 內未使用且純前端不需要的 `better-sqlite3`、`express`、`dotenv`、`@types/express`、`tsx`,縮減安裝體積與安全面。

### ✨ UX 改善
- **Optimistic UI**: 新增 / 編輯 / 刪除交易改為樂觀更新,UI 立即反應,失敗時自動 rollback,不再每次操作都重新拉整張表。
- **錯誤狀態**: `useTransactions` 新增 `error` 欄位讓 UI 可顯示載入失敗訊息,不再只 silent console.error。
- **新增交易守門**: 點選「+」時若尚未建立分類或支付方式,會提示先到「設定」建立,避免無聲失敗。
- **數字鍵盤**: 金額輸入加上 `inputMode="decimal"`,並去除瀏覽器 number spinner,手機輸入更順手。
- **無障礙與鍵盤**: 新增交易按鈕加 `aria-label`;時間選擇與搜尋 Modal 支援 Esc 關閉。

### 🧹 內部
- `useTransactions` 加上 `useCallback` 包裝 `fetchTransactions`,符合 React hooks 規範。
