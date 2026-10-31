# 正式上線步驟

這份看板不改原本本機系統，也不要求重新部署原 GAS。需要額外的 Google Cloud 與 Cloudflare 設定；未完成前只有示範模式。

## 1. Google 登入

1. 在 Google Cloud Console 建立專用專案並設定 Google Auth Platform 同意畫面。
2. 建立 OAuth 2.0 Client ID，類型選「網頁應用程式」。
3. 已授權 JavaScript 來源加入 `https://bestloveayu.github.io`，不是帶 `/d77/` 的網址。
4. 若應用處於測試狀態，將兩位成員的 Google 帳號加入測試使用者。
5. 將 Client ID 填入 `public/config.js` 的 `googleClientId` 及 `wrangler.toml` 的 `GOOGLE_CLIENT_ID`。這個 ID 是公開識別碼，不是 Client Secret。

後端會驗證 Google 簽章、簽發者、audience、有效時間、email_verified 及白名單；本版白名單限 Gmail。僅在網頁隱藏內容不是安全措施。

官方參考：https://developers.google.com/identity/gsi/web/guides/verify-google-id-token

## 2. Google 唯讀服務帳號

1. 同一專案啟用 Google Sheets API 與 Google Drive API。
2. 建立服務帳號，不需要網域委派、不需要 Gmail 權限。
3. 將業務試算表及中文規則資料夾，以「檢視者」分享給服務帳號 Email。
4. 若規則檔案不繼承資料夾權限，需確認服務帳號能檢視；不要為了看板把資料公開。
5. 產生服務帳號 JSON 金鑰，僅存入 Cloudflare Worker Secret，禁止加入 GitHub。

若組織政策不允許金鑰，先停在這裡，改用組織允許的雲端憑證方案，不要放寬原表單存取權限。

## 3. Worker 設定

安裝專案依賴並登入自己的 Cloudflare：

```powershell
npm ci
npx wrangler login
```

正式來源設定請使用 Worker Secret `SHEET_CONFIG`，不要把真實試算表 ID 或資料夾 ID 提交到公開 GitHub。儲存庫只有占位範例；設定同名 Secret 前，先移除 `wrangler.toml` 的 `SHEET_CONFIG` 範例宣告。

- `spreadsheetId`：實際業務試算表 ID，只存 Worker Secret。
- `catalogSheet`：填入實際本季品項統計分頁名稱。
- `responseSheet`：本季預購回應分頁名稱。
- `ledgerSheet`：金流進出貨總表。
- `teamSheet`、`documentsSheet`：保留目前協作分頁名稱，若雲端不同則修改。
- `rulesFolderId`：中文規則資料夾 ID，不能用原文資料夾。
- `season`：例如 `2026秋`。
- `aliases`：明確名稱對照，例如 `{"D外星人與羊":"外星人與羊"}`；不會從本機偷讀對應記憶。
- `productColumns`：必要時指定商品欄，索引從 0 開始，例如 `{"47":{"name":"Sinabyss","price":1250},"61":{"name":"葡萄銃手","price":990}}`；設定為 `false` 可排除誤判欄。只放欄位設定，不放顧客資料。

設定私密值（指令會互動詢問，勿把值寫在命令列或 GitHub）：

```powershell
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT
npx wrangler secret put ALLOWED_EMAILS
npx wrangler secret put SHEET_CONFIG
```

`GOOGLE_SERVICE_ACCOUNT` 貼上完整服務帳號 JSON；`ALLOWED_EMAILS` 填入于正與小東已確認的兩個 Gmail，以逗號分隔；`SHEET_CONFIG` 貼上填妥的來源 JSON。帳號白名單與真實來源配置均不提交 GitHub。

```powershell
npx wrangler deploy
```

部署會建立專用 Durable Object，保存已整合快照、通知及各自已讀，不修改原業務試算表。每五分鐘排程讀取。檢查 Cloudflare 的使用量與方案限制，不保證所有用量永久免費。

將回傳的 `https://...workers.dev` 網址填到 `public/config.js` 的 `apiBase`，不含結尾端點。若改用自訂 API 網域，需要同步調整 index.html 的 CSP connect-src。

官方排程參考：https://developers.cloudflare.com/workers/configuration/cron-triggers/

## 4. GitHub Pages

1. 專案內容放在 `bestloveayu/d77` 儲存庫根目錄。
2. 儲存庫 Settings → Pages → Source 選 **GitHub Actions**。
3. 推送 main 分支，或到 Actions 手動執行 `Publish read-only mobile board`。
4. 成功後以 `https://bestloveayu.github.io/d77/` 開啟。
5. 確認 OAuth JS Origin、Worker ALLOWED_ORIGIN 都是 `https://bestloveayu.github.io`。
6. 用第三個未授權帳號驗證無法讀取資料；用兩位正式帳號驗證都能讀取、已讀互不影響。

網站未設定 config 時只顯示示範入口。沒有前端可用的 Google Token，不會直接讀取原 GAS。

## 5. 手機推播（可選）

第一版支援 ntfy，不使用已停用的 LINE Notify。需先建立受存取控制保護的私人通知主題，兩人各自訂閱。

在 Worker Secret 新增 `NTFY_TARGETS`，格式如下（示例，請替換）：

```json
{"member@example.com":{"url":"https://ntfy.sh/PRIVATE_TOPIC","token":"PRIVATE_ACCESS_TOKEN"}}
```

不可使用沒有權限保護的公開主題承載私人通知。開啟看板設定後，該帳號才能勾選「手機推播」。推播僅包含一般提示，不含顧客個資。手機背景接收是否可靠，需在各自 iPhone／Android 實測。

勿擾期間不補發每則舊推播，通知中心仍保留。推播失敗只顯示於服務狀態，原訂單與金流完全不受影響。

## 6. 驗收與日後更新

- 第一份完整讀取僅建立基準，不把所有歷史訂單通知一次。
- 比對 3 位顧客、3 款庫存、2 份規則與原試算表，確定欄位解析正確才日常使用。
- 表單追加或改名後，更新欄位設定或 aliases；資料無法唯一對應時不猜測。
- 不在手機看板執行重新配貨、回填訂購量、寄信、下單或金流修復。
- 前端更新不要重設 Durable Object 名稱 `shared-v1`，避免遺失通知基準及已讀。
- 公開 GitHub 只提交程式與圖像。真實資料快照、帳號白名單、服務金鑰均不提交。
