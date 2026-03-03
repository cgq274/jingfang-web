# 经方网站：Git 方案部署（推送到 GitHub + 服务器拉取）

按本文做完后，代码在 GitHub（或 Gitee），服务器用 `git clone` 获取代码，后续更新用 `git pull` 即可。

---

## 〇、本机安装 Git（Windows）

若本机还没有 Git，先安装再执行后面的步骤。

1. **下载**：打开 [https://git-scm.com/download/win](https://git-scm.com/download/win)，下载 64-bit 安装包。
2. **安装**：双击运行，一路 **Next** 即可（默认选项即可）。其中 “Adjusting your PATH environment” 建议选 **Git from the command line and also from 3rd-party software**，这样 PowerShell 里可以直接用 `git`。
3. **验证**：安装完成后**重新打开** PowerShell，执行：
   ```powershell
   git --version
   ```
   若显示类似 `git version 2.xx.x` 即安装成功。

然后从下面「一、本机：创建仓库并首次推送」继续。

---

## 一、本机：创建仓库并首次推送

### 1. 在 GitHub 上建仓库

1. 登录 [GitHub](https://github.com)，右上角 **+** → **New repository**
2. **Repository name**：`jingfang-web`（或任意）
3. 选 **Private**（推荐）或 Public
4. **不要**勾选 “Add a README file”
5. 点 **Create repository**

记下仓库地址，例如：`https://github.com/你的用户名/jingfang-web.git`

### 2. 本机已有 .gitignore 和 .env.example

项目根目录已有 `.gitignore`，会排除：

- `backend/.env`（密钥）
- `backend/certs/*.pem`（证书）
- `backend/node_modules/`

`backend/.env.example` 已提交，服务器上可复制为 `.env` 再填写真实值。

### 3. 在本机项目目录初始化 Git 并推送

在 **PowerShell** 里进入项目根目录，执行（把仓库地址换成你的）：

```powershell
cd D:\program_data\website\v2\jingfang-web

git init
git add .
git commit -m "Initial commit: jingfang-web"
git branch -M main
git remote add origin https://github.com/你的用户名/jingfang-web.git
git push -u origin main
```

若用 SSH 地址（`git@github.com:用户名/jingfang-web.git`），把最后两行改成：

```powershell
git remote add origin git@github.com:你的用户名/jingfang-web.git
git push -u origin main
```

推送时按提示登录 GitHub（或配置好 SSH key）。完成后代码已在远程仓库。

---

## 二、服务器：克隆项目并配置

### 1. 安装 Git（若未装）

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y git

# CentOS
sudo yum install -y git
```

### 2. 克隆仓库

选一个目录（如 `/var/www` 或 `/opt`），在**服务器**上执行（仓库地址换成你的）：

```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/你的用户名/jingfang-web.git
cd jingfang-web
```

若为**私有仓库**，需先配置认证：

- **HTTPS**：`git clone` 时提示输入 GitHub 用户名和 Personal Access Token（在 GitHub → Settings → Developer settings → Personal access tokens 创建）。
- **SSH**：在服务器上生成 SSH key 并加到 GitHub，然后用 `git clone git@github.com:用户名/jingfang-web.git`。

### 3. 安装依赖

```bash
cd /var/www/jingfang-web/backend
npm install
cd ..
```

### 4. 配置 .env（服务器上单独配置，不来自 Git）

```bash
cd /var/www/jingfang-web/backend
cp .env.example .env
nano .env
```

按实际环境填写：`PAYMENT_BASE_URL`、支付宝/微信等。保存退出（nano：`Ctrl+O` 回车，`Ctrl+X`）。

### 5. 放置证书（若用支付宝/微信支付）

`.env` 里若配置了 `*_KEY_PATH=./certs/xxx.pem`，需要把本机的证书传到服务器，**不要**放进 Git：

在**本机** PowerShell 执行（把 `服务器IP` 换成实际 IP）：

```powershell
scp D:\program_data\website\v2\jingfang-web\backend\certs\alipay_private_key.pem root@服务器IP:/var/www/jingfang-web/backend/certs/
scp D:\program_data\website\v2\jingfang-web\backend\certs\alipay_public_key.pem root@服务器IP:/var/www/jingfang-web/backend/certs/
```

微信证书同理，按需上传到 `backend/certs/`。

### 6. 启动应用

```bash
cd /var/www/jingfang-web
pm2 start backend/app.js --name jingfang
pm2 save
pm2 startup
```

按 [DEPLOY-CLI.md](DEPLOY-CLI.md) 配置 Nginx 反向代理和 HTTPS（推荐 acme.sh + 腾讯云 DNS API，国内/未备案适用）。

---

## 三、后续更新部署（推荐流程）

改完代码后，在本机：

```powershell
cd D:\program_data\website\v2\jingfang-web
git add .
git commit -m "更新说明"
git push
```

在**服务器**上：

```bash
cd /var/www/jingfang-web
git pull
cd backend && npm install
pm2 restart jingfang
```

---

## 四、可选：服务器上保存 .env 备份

避免误覆盖 `.env`，可备份一份：

```bash
cp /var/www/jingfang-web/backend/.env /var/www/jingfang-web/backend/.env.bak
```

以后若 `.env` 被改坏，可用 `cp .env.bak .env` 恢复。

---

## 常见问题

- **git clone 提示 403 / 无权限**：私有仓库需在服务器配置 GitHub 认证（Token 或 SSH key）。
- **服务器上没有 .env**：必须手动 `cp .env.example .env` 并编辑，`.env` 不会从 Git 拉取。
- **证书 404**：确保用 `scp` 把本机 `backend/certs/` 下的 `.pem` 传到服务器对应目录。

完成以上步骤后，你的网站即通过 Git 方案部署；之后以“本机改代码 → push → 服务器 pull + npm install + pm2 restart”为主流程即可。
