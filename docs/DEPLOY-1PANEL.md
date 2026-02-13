# 经方网站 1Panel 部署指南

本指南教你如何在 1Panel 上部署 jingfang-web 项目。

---

## 前置准备

- 已有一台 Linux 服务器（推荐 Ubuntu 20.04+ / CentOS 7+）
- 服务器已安装 1Panel（未安装请先执行官网一键安装脚本）
- 已有域名，并已将域名 A 记录解析到服务器 IP
- 能通过 SSH 连接到服务器

---

## 第一步：安装 1Panel（如未安装）

```bash
curl -sSL https://resource.fit2cloud.com/1panel/package/quick_start.sh -o quick_start.sh && bash quick_start.sh
```

安装完成后，按提示在浏览器打开 `http://服务器IP:端口`，完成初始化设置。

---

## 第二步：安装 Node.js 运行环境

1Panel 默认不带 Node.js，需要先安装：

1. 进入 1Panel 后台 → **主机** → **应用商店**
2. 搜索 **Node.js**，点击安装（选择合适版本，推荐 18 或 20）
3. 或使用 1Panel 自带的 **终端**，执行：

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# CentOS
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# 验证
node -v   # 应显示 v20.x.x
npm -v
```

---

## 第三步：上传项目代码

### 方式 A：1Panel 文件管理上传

1. 进入 **文件** → 选择一个目录（如 `/opt/jingfang-web`）
2. 点击 **上传**，将本地项目压缩为 `jingfang-web.zip` 后上传
3. 右键解压

### 方式 B：Git 拉取（推荐）

1. 进入 **终端**，执行：

```bash
sudo mkdir -p /opt/jingfang-web
cd /opt/jingfang-web
sudo git clone <你的仓库地址> .
# 如果没有 Git：sudo apt install -y git  # Ubuntu
```

### 方式 C：本地上传后通过 SCP

在本地 PowerShell 执行：

```powershell
scp -r D:\program_data\website\v2\jingfang-web root@你的服务器IP:/opt/
```

---

## 第四步：安装项目依赖并配置环境

在 1Panel **终端** 中执行：

```bash
cd /opt/jingfang-web

# 安装后端依赖
cd backend && npm install && cd ..

# 如未安装 PM2，全局安装
sudo npm install -g pm2
```

### 配置 .env 文件

1. 进入 **文件** → `/opt/jingfang-web/backend/`
2. 若没有 `.env`，复制 `.env.example` 为 `.env`
3. 编辑 `.env`，至少修改：

```env
PAYMENT_BASE_URL=https://你的域名.com
```

其他支付相关（微信、支付宝）按需配置。

---

## 第五步：启动 Node 应用

在 **终端** 执行：

```bash
cd /opt/jingfang-web
pm2 start backend/app.js --name jingfang

# 设置开机自启
pm2 save
pm2 startup
# 按提示执行输出的命令（通常是 sudo env PATH=... pm2 startup systemd ...）
```

查看状态：

```bash
pm2 status
pm2 logs jingfang   # 查看日志
```

此时应用已在 `http://127.0.0.1:3000` 运行。

---

## 第六步：在 1Panel 中添加网站（反向代理）

1. 进入 **网站** → **创建网站**
2. 选择 **反向代理**
3. 填写：
   - **主域名**：`你的域名.com`
   - **备注**：经方网站（可选）
4. 点击 **确认** 创建

5. 在网站列表中，找到刚创建的站点，点击 **设置**
6. 在 **反向代理** 配置中，设置：
   - **代理名称**：默认或自定义
   - **目标地址**：`http://127.0.0.1:3000`
   - **发送域名**：`$host`（或留空）

7. 保存后，Nginx 会自动重载

---

## 第七步：配置 HTTPS（SSL 证书）

1. 在 **网站** 列表，点击该站点右侧 **设置**
2. 进入 **SSL** 选项卡
3. 选择 **Let's Encrypt**，填写邮箱，勾选域名
4. 点击 **申请**，等待证书申请完成
5. 可选：开启 **强制 HTTPS**

---

## 第八步：放行端口（如未放行）

1. 进入 **主机** → **防火墙**
2. 确保放行：**80**、**443**、**1Panel 面板端口**

若使用云服务器，还需在云控制台安全组中放行 80、443。

---

## 第九步：验证部署

1. 浏览器访问：`https://你的域名.com`
2. 应能打开网站首页
3. 测试注册、登录、课程等功能

---

## 常用运维命令（在 1Panel 终端执行）

| 操作         | 命令                    |
|--------------|-------------------------|
| 查看运行状态 | `pm2 status`            |
| 查看日志     | `pm2 logs jingfang`     |
| 重启应用     | `pm2 restart jingfang`  |
| 停止应用     | `pm2 stop jingfang`     |
| 更新代码后   | `cd /opt/jingfang-web && git pull && cd backend && npm install && pm2 restart jingfang` |

---

## 常见问题

### 1. 访问域名显示 502 Bad Gateway

- 检查 PM2 是否在运行：`pm2 status`
- 检查应用是否监听 3000 端口：`pm2 logs jingfang`

### 2. 数据库连接失败

- 确认 `backend/config/db.js` 中数据库地址、用户名、密码正确
- 若数据库在远程服务器，确认服务器防火墙/安全组放行 3306 端口

### 3. 静态资源或 API 404

- 本项目前后端同一端口，由 Express 统一提供，一般不会出现此问题
- 确认反向代理目标为 `http://127.0.0.1:3000`

### 4. 支付回调失败

- 确认 `.env` 中 `PAYMENT_BASE_URL` 为 `https://你的域名.com`（不要带尾部斜杠）
- 确认已配置 HTTPS，微信/支付宝要求回调地址为 HTTPS

---

完成以上步骤后，网站即可在 1Panel 环境下正常运行。
