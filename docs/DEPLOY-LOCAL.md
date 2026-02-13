# 从本机重新部署经方网站（不用 1Panel）

本指南适用于：**服务器上已按 [DEPLOY-CLI.md](DEPLOY-CLI.md) 完成首次部署**，现在要从本地 Windows 重新上传代码并更新线上站点。

---

## 一、本机准备

1. 确认本地项目可正常运行（`backend` 里 `npm start` 能起来）。
2. 如需更新环境变量（如域名、支付配置），先改好 `backend/.env`，上传时会一并覆盖服务器上的 `.env`（若你希望保留服务器上的 `.env`，见下方「保留服务器 .env」）。

---

## 二、上传项目到服务器

在 **本地 PowerShell** 中执行（把 `你的服务器IP` 换成实际 IP 或主机名）：

```powershell
# 上传整个项目目录到服务器 /var/www/
scp -r D:\program_data\website\v2\jingfang-web root@你的服务器IP:/var/www/
```

若服务器上已有旧版本，会覆盖。若部署目录不是 `/var/www`，请改成你实际路径（如 `/opt/jingfang-web` 则目标写 `/opt/`）。

---

## 三、在服务器上安装依赖并重启

SSH 登录服务器后执行：

```bash
cd /var/www/jingfang-web
cd backend && npm install && cd ..
pm2 restart jingfang
```

若无 `jingfang` 进程（首次部署），则：

```bash
cd /var/www/jingfang-web
pm2 start backend/app.js --name jingfang
pm2 save
pm2 startup
```

---

## 四、验证

```bash
pm2 status
curl http://127.0.0.1:3000/api/ping
```

浏览器访问 `https://你的域名` 检查页面和功能是否正常。

---

## 可选：保留服务器上的 .env

若不想用本机的 `.env` 覆盖服务器上的配置：

- 上传前在本机临时重命名或删除 `backend/.env`，再执行 `scp`；  
  或  
- 上传后到服务器上，用 `cp .env.bak .env` 恢复你之前备份的 `.env`，再执行 `npm install` 和 `pm2 restart jingfang`。

---

## 可选：写成本地一键脚本

在项目根目录建 `redeploy.ps1`（PowerShell），内容示例：

```powershell
$SERVER = "root@你的服务器IP"
$REMOTE_PATH = "/var/www/"

scp -r D:\program_data\website\v2\jingfang-web ${SERVER}:${REMOTE_PATH}
ssh $SERVER "cd ${REMOTE_PATH}jingfang-web/backend && npm install && cd .. && pm2 restart jingfang"
Write-Host "重新部署完成"
```

以后在本机执行 `.\redeploy.ps1` 即可完成上传 + 安装依赖 + 重启。

---

若服务器还未装 Node、Nginx、PM2 等，请先按 [DEPLOY-CLI.md](DEPLOY-CLI.md) 完成环境搭建，再按本文进行“重新部署”。
