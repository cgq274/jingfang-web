# 经方网站 jingfang-web

前后端一体的经方学习/课程网站（Node.js + Express + 静态前端）。

## 部署方式

- **Git 方案（推荐）**：先推送到 GitHub/Gitee，服务器 `git clone`，后续 `git pull` 更新。见 [docs/DEPLOY-GIT.md](docs/DEPLOY-GIT.md)。
- **命令行部署（不依赖 1Panel）**：见 [docs/DEPLOY-CLI.md](docs/DEPLOY-CLI.md)  
  适合：从本机把网站部署到自己的 Linux 服务器（Nginx + PM2 + Let's Encrypt）。
- **从本机重新部署/更新**：见 [docs/DEPLOY-LOCAL.md](docs/DEPLOY-LOCAL.md)  
  适合：服务器环境已按 CLI 文档配好，只需上传新代码并重启。
- 1Panel 部署：见 [docs/DEPLOY-1PANEL.md](docs/DEPLOY-1PANEL.md)（如不使用 1Panel 可忽略）。

## 本地开发

```bash
# 后端
cd backend
cp .env.example .env   # 编辑 .env 填写数据库、支付等
npm install
npm start             # 默认 http://localhost:3000
```

前端静态文件在 `frontend/`，由后端统一提供，无需单独起前端服务。
