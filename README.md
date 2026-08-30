# Taiping Blue｜太平藍

前台與作品管理後台整合的 Node.js 專案。前台沿用 `index.html`，後台由 `backend/server.js` 提供作品 CRUD、管理員登入與圖片上傳。

## 本機啟動

```powershell
npm start
```

- 前台：`http://127.0.0.1:4173/`
- 後台：`http://127.0.0.1:4173/tbx-7f3c9a2e-d4b8-6e1a`
- 本機預設密碼：`1234`

部署前請設定 `ADMIN_PASSWORD` 與 `ADMIN_PATH` 環境變數。GitHub Pages 只能提供靜態檔案；若要讓商家登入並修改作品，請部署到可執行 Node.js 的主機，讓前台與 `backend/server.js` 同時運作。

更多本機與部署說明請參考 [`README-localhost.md`](README-localhost.md)。
