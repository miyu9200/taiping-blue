# 太平藍 Taiping Blue 本機版

這個專案直接使用原本的 `index.html` 作為唯一前端入口，沒有另外建立新的前端 index.html。畫面、版面、圖片、文字與既有互動均保留；localhost 可使用 Node API，GitHub Pages 展示版則由後台透過 GitHub API 更新商品 JSON。

## 專案位置

- `index.html`：前端頁面，也是 localhost 提供的首頁。
- `0830.html`：組員最新前端版本的保留參考檔；本次視覺更新已合併到 `index.html`，不會直接作為服務入口。
- `backend/server.js`：本機 Node.js API、管理員工作階段、作品 CRUD、圖片驗證與檔案儲存。
- `backend/data/products.json`：作品資料；目前已同步 `0830.html` 的 15 件作品。
- `backend/uploads/`：上傳圖片檔案。
- `package.json`：本機啟動指令。

## 管理後台

管理入口已改成不容易被直接猜到的路徑：

`http://127.0.0.1:4173/tbx-7f3c9a2e-d4b8-6e1a`

本機未設定 `ADMIN_PASSWORD` 時，登入密碼是 `1234`。部署前請一定設定正式密碼；也可以用 `ADMIN_PATH` 環境變數替換管理路徑。網址隱蔽只能降低被猜到的機率，實際保護仍由後端登入驗證提供。

## 啟動 localhost

在 PowerShell 執行：

```powershell
cd C:\Users\ssoo3\Desktop\Program
# 本機未設定 ADMIN_PASSWORD 時，預設密碼為 1234
# 部署或要自訂密碼時，再取消註解並改成正式密碼：
# $env:ADMIN_PASSWORD = "your-secure-password"
npm start
```

再瀏覽 `http://127.0.0.1:4173/`。

公開頁面從 `GET /api/products` 讀取資料。管理者登入後可以新增、編輯、刪除、重置預設作品及上傳圖片，修改會直接同步到前台；後台不再提供 JSON 匯出／匯入按鈕。密碼只放在目前 PowerShell 工作階段的環境變數中，不會寫進程式碼。

本次同步時，`0830.html` 的第一件作品原本引用 `input_file_0.png`，但目前專案資料夾沒有這個檔案，因此已改用現有有效圖片網址，避免前台出現破圖；日後補回原圖時可直接在管理後台編輯該作品替換圖片。

## 未來部署 GitHub 的注意事項

GitHub 儲存庫可以同時放前端與後端，但 GitHub Pages 只能提供靜態前端，不能執行 `backend/server.js`。若要讓商家登入後新增作品並立即顯示在前台，請將整個專案部署到可執行 Node.js 的同一個服務（例如支援 Node 的主機），由同一個服務同時提供 `/`、管理路徑與 `/api/*`。正式環境還應加入 HTTPS、資料庫、雲端物件儲存、CSRF 防護、速率限制與正式帳號管理。
