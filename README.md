# 升級吧 · Level Up

免費、離線優先的**技術士技能檢定學科題庫**。寫錯的自動進錯題本，快忘的排進複習，考前再用計時模擬考檢驗實力。你只管每天打開來練，該記的交給它。

**→ [levelup.tw](https://levelup.tw)**

不用註冊，沒有廣告，進度存在你自己的裝置。

---

## 為什麼有這個專案

準備技能檢定的時候，我發現自己一直在做同一件事：對著 PDF 反覆看答案，然後忘記。題目其實都是公開的，缺的不是題庫，是一條「錯了會再回來、記住了才算完成」的路徑。

所以這是一個免費的個人專案。目標不是收錄最多考科，而是**你正在考的那一科，答案是對的、練起來真的有用**。

## 怎麼運作

每天就這四步：做題、修錯、複習、模擬。哪些題該回來複習，升級吧幫你記著，你只要打開來練就好。

| | | |
|---|---|---|
| **01** | 練正式題庫 | 寫的就是官方公告的題目，一作答馬上知道對錯 |
| **02** | 修正錯題 | 寫錯的自動進錯題本，接著上次的進度一題一題修 |
| **03** | 依排程複習 | 重點變成記憶卡，照遺忘曲線在你快忘記的那天回來考你 |
| **04** | 計時模擬 | 照正式考試的題數與時間出題，寫完就知道離及格線多遠 |

支援的考科清單以站上的「選一科，馬上開始」為準；更多題庫會依需求陸續加入。

## 答案正確性

答錯的題目會被記起來，所以**一個錯的答案比沒有答案更糟**——你會把它背起來，然後在考場上發現。

官方 PDF 會把答案印在題號旁邊（`38. (2)`、複選 `39. (134)`）。所以我們自己就是權威來源，不需要第三方題庫來對答案：

- [`scripts/verifyAnswerKeys.mjs`](scripts/verifyAnswerKeys.mjs) 用 `pdftotext -layout` **獨立於匯入器**重新抽一次答案，再跟題庫比對。
- [`scripts/answerKeyVerification.test.ts`](scripts/answerKeyVerification.test.ts) 每次 `npm test` 都會重跑一次。

> **踩過的坑**：題號在每個「工作項目」內都會從 1 重新開始，所以 `17300-01-001` 和 `17300-02-001` 都是第 1 題。只用題號比對會安靜地比錯題目——曾經因此誤報 42% 的答案錯誤。**識別題目一律用 section + number。**

每個考科都會標示校對狀態，未完整校對的會清楚標記。

## 技術

React 19 + Vite + Dexie 的 PWA，部署在 Cloudflare Pages。

- **`/`** 是公開的介紹頁，**`/app`** 是 PWA 入口（`start_url`）。裝好的 App 直接開 `/app`，不會先看到行銷頁。
  已經用過的人開 `/` 也會直接進 App（`onboardingState.ts`），所以要強制看介紹頁請用 **[`/welcome`](https://levelup.tw/welcome)**。
- **進度存在本機** IndexedDB。跨裝置時才用「進度代碼」同步到 Cloudflare KV。
- **同步代碼就是帳號**：伺服器只存 `hash(secret)`，不存 secret 本身，沒有 email、沒有重設。代碼掉了就拿不回雲端副本——所以清除裝置前一定會先把代碼秀出來。
- **離線優先**：題庫下載後可離線使用；題庫 JSON 用 `StaleWhileRevalidate`，這樣答案更正能在下次開啟時就生效，而不是被快取鎖住。

```
src/            React app（domain/ 是純邏輯，沒有 DOM/Dexie/React）
functions/api/  Cloudflare Pages Functions（sync、explain）
scripts/        題庫匯入、驗證與稽核
source/         官方題庫 PDF（原始來源）
public/data/    產生出來的考科題庫
docs/           規格與設計筆記
```

## 開發

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # 含答案校對驗證
npm run lint
npm run build
```

題庫是產生出來的，不要手改 `public/data/`：

```bash
npm run import:questions   # source/*.pdf → 題庫 → 驗證答案
npm run verify:answers     # 只重跑答案校對
```

需要 `pdftotext`（`brew install poppler`）。

## 授權

**程式碼**採用 [MIT](LICENSE)，歡迎自由使用、修改與散布。

**題目內容不在此授權範圍內**：`source/` 的原始 PDF 與 `public/data/` 產生出來的題庫，都來自勞動部勞動力發展署技能檢定中心公開的學科題庫，著作權屬原單位所有，不是我能授權的東西。要重用題目本身，請自行確認官方的使用條款。

## 免責聲明

升級吧是免費的個人專案，不隸屬於也未受託於勞動部勞動力發展署技能檢定中心或任何官方機構。題目整理自官方公開的學科題庫，僅供個人練習參考；本站已盡力校對，但不保證內容完全正確、完整或為最新版本，一切請以[官方最新公告與題庫](https://techbank.wdasec.gov.tw/)為準。使用本站不保證通過檢定。各考科名稱、標章與商標均屬其各自所有權人所有。
