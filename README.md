# Taiping Blue｜太平藍

GitHub Pages 展示網站與 GitHub API 作品管理後台。前台沿用原始 `index.html`，後台可直接新增、編輯、刪除、重置作品及上傳圖片，資料會更新到同一個儲存庫。

## 線上網址

- 前台：<https://miyu9200.github.io/taiping-blue/>
- 作品管理後台：<https://miyu9200.github.io/taiping-blue/backend/admin.html>

## 後台使用方式

1. 使用具備此儲存庫寫入權限的 GitHub 帳號建立 Fine-grained Personal Access Token。
2. Token 只需要 `taiping-blue` 儲存庫的 `Contents: Read and write`，以及必要的 `Metadata: Read-only`。
3. 在後台輸入自己的 Token 登入。每次儲存會直接提交商品 JSON 或圖片檔案，GitHub Pages 完成更新後前台即可看到變更。

請勿共用 Token；每位組員都應使用自己的 GitHub 帳號與 Token。Token 只暫存在目前瀏覽器分頁中。

## 專案結構

- `index.html`：GitHub Pages 前台入口。
- `backend/admin.html`：作品管理後台。
- `backend/data/products.json`：目前展示作品資料。
- `backend/data/default-products.json`：重置預設作品時使用的資料。
- `.nojekyll`：讓 GitHub Pages 直接提供靜態檔案。
