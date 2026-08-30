# Taiping Blue｜太平藍

前台與作品管理後台整合的太平藍展示專案。前台沿用 `index.html`；GitHub Pages 版本由 `backend/admin.html` 透過 GitHub Contents API 更新 `backend/data/products.json`，不需要常駐 Node.js 服務。

## GitHub Pages 展示版

將儲存庫設為 Public（GitHub Free 的 Pages 方案），到 **Settings → Pages** 選擇 `main` 分支與根目錄 `/`。網站網址會是 `https://miyu9200.github.io/taiping-blue/`。

後台展示頁：`https://miyu9200.github.io/taiping-blue/backend/admin.html`

後台需要一組 GitHub Fine-grained Personal Access Token，且對此儲存庫開啟 **Contents: Read and write** 權限。每次新增、編輯、刪除或重置會直接提交 `backend/data/products.json`；GitHub Pages 更新可能需要短暫等待。

## 本機啟動（舊版 Node API）

```powershell
npm start
```

- 前台：`http://127.0.0.1:4173/`
- 後台：`http://127.0.0.1:4173/tbx-7f3c9a2e-d4b8-6e1a`
- 本機預設密碼：`1234`

部署前請設定 `ADMIN_PASSWORD` 與 `ADMIN_PATH` 環境變數。這個本機 Node API 版本仍可用於 localhost 測試；GitHub Pages 展示版則使用上方的 GitHub API 管理模式。

更多本機與部署說明請參考 [`README-localhost.md`](README-localhost.md)。
