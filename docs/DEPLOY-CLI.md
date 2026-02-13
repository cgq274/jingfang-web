# 经方网站 命令行部署指南

本指南教你如何不依赖 1Panel 等面板，纯命令行部署 jingfang-web 项目。

---

## 前置准备

- Linux 服务器（Ubuntu 20.04+ / CentOS 7+ 等）
- SSH  root 或 sudo 权限
- 域名已解析到服务器 IP

---

## 第一步：安装 Node.js

### Ubuntu / Debian

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt update
sudo apt install -y nodejs
```

### CentOS / RHEL

```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
```

验证：

```bash
node -v   # v20.x.x
npm -v
```

---

## 第二步：安装 Nginx

### Ubuntu / Debian

```bash
sudo apt update
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### CentOS / RHEL

```bash
sudo yum install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## 第三步：安装 PM2

```bash
sudo npm install -g pm2
```

---

## 第四步：上传项目并安装依赖

任选一种方式把项目放到服务器上，再在服务器上安装依赖、配置 `.env`。

---

### 方式 A：Git 拉取（适合代码已在 Git 仓库）

**在服务器上**执行（SSH 登录后）：

```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone <你的仓库地址> jingfang-web
cd jingfang-web
```

把 `<你的仓库地址>` 换成实际地址，例如 `https://github.com/你的用户名/jingfang-web.git`。

---

### 方式 B：本地上传（适合当前就在本机开发、没有推送到 Git）

**1. 在本地 Windows 电脑上**打开 PowerShell，执行（把 `服务器IP` 换成你服务器的实际 IP）：

```powershell
scp -r D:\program_data\website\v2\jingfang-web root@服务器IP:/var/www/
```

- 会提示输入服务器 root 密码（或你用的用户密码）。
- 若你的项目不在 `D:\program_data\website\v2\jingfang-web`，把路径改成你本机的实际路径。
- 若服务器上没有 `/var/www` 目录，先 SSH 登录服务器执行 `sudo mkdir -p /var/www`。

**2. 上传完成后，在服务器上**执行：

```bash
cd /var/www/jingfang-web
```

---

### 安装依赖（两种方式完成后都在服务器执行）

在服务器上进入后端目录并安装 npm 依赖：

```bash
cd /var/www/jingfang-web/backend
npm install
cd ..
```

---

### 配置 .env

在服务器上：

```bash
cd /var/www/jingfang-web/backend
cp .env.example .env
nano .env   # 或 vi .env
```

至少把下面这一项改成你的域名（不要带末尾斜杠）：

```env
PAYMENT_BASE_URL=https://你的域名.com
```

其他项（数据库、支付等）按需填写。保存退出：
- **nano**：`Ctrl+O` 回车，再 `Ctrl+X`
- **vi**：按 `i` 编辑，改完后 `Esc`，输入 `:wq` 回车

---

## 第五步：启动 Node 应用

```bash
cd /var/www/jingfang-web
pm2 start backend/app.js --name jingfang
pm2 save
pm2 startup
```

按 `pm2 startup` 输出提示执行那一行 `sudo env PATH=...` 命令，以开机自启。

验证：

```bash
pm2 status
curl http://127.0.0.1:3000/api/ping
# 应返回 {"message":"backend ok"}
```

---

## 第六步：配置 Nginx 反向代理

### 创建站点配置

**Ubuntu / Debian**（/etc/nginx/sites-available/）：

```bash
sudo nano /etc/nginx/sites-available/jingfang
```

**CentOS / RHEL**（/etc/nginx/conf.d/）：

```bash
sudo nano /etc/nginx/conf.d/jingfang.conf
```

写入以下内容（把 `你的域名.com` 改成实际域名）：

```nginx
server {
    listen 80;
    server_name 你的域名.com www.你的域名.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 启用站点（仅 Ubuntu/Debian 有 sites-enabled）

```bash
sudo ln -s /etc/nginx/sites-available/jingfang /etc/nginx/sites-enabled/
```

### 测试并重载 Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 第七步：配置 HTTPS（Let's Encrypt）

```bash
# Ubuntu / Debian
sudo apt install -y certbot python3-certbot-nginx

# CentOS 7
sudo yum install -y certbot python3-certbot-nginx

# CentOS 8+
sudo dnf install -y certbot python3-certbot-nginx
```

申请证书：

```bash
sudo certbot --nginx -d 你的域名.com -d www.你的域名.com
```

按提示填写邮箱、同意条款。完成后会自动配置 HTTPS 并设置续期。

---

## 第八步：放行防火墙端口

### 使用 ufw（Ubuntu）

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 使用 firewalld（CentOS）

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

若用云服务器，还需在云控制台安全组中放行 80、443。

---

## 第九步：验证

浏览器访问 `https://你的域名.com`，应能正常打开网站。

---

## 常用运维命令

| 操作         | 命令                                                 |
|--------------|------------------------------------------------------|
| 查看状态     | `pm2 status`                                         |
| 查看日志     | `pm2 logs jingfang`                                  |
| 重启应用     | `pm2 restart jingfang`                               |
| 更新部署     | 见下方「更新代码」                                   |

### 更新代码

```bash
cd /var/www/jingfang-web
git pull
cd backend && npm install
pm2 restart jingfang
```

---

## 可选：创建更新脚本

```bash
sudo nano /var/www/jingfang-web/deploy.sh
```

写入：

```bash
#!/bin/bash
set -e
cd /var/www/jingfang-web
git pull
cd backend && npm install
pm2 restart jingfang
echo "部署完成"
```

赋予执行权限并执行：

```bash
chmod +x /var/www/jingfang-web/deploy.sh
# 以后更新：./deploy.sh
```

---

## 常见问题

### Nginx 启动失败（Job for nginx.service failed）

1. **看具体错误**：
   ```bash
   sudo systemctl status nginx.service
   sudo journalctl -xeu nginx.service --no-pager
   ```
2. **检查配置语法**：
   ```bash
   sudo nginx -t
   ```
   若报错会指出哪个文件、哪一行有问题，按提示修改后保存再 `sudo systemctl start nginx`。
3. **80 端口被占用**：
   ```bash
   sudo ss -tlnp | grep :80
   ```
   若被 Apache、其他 Nginx 或面板占用，需先停掉该服务或改 Nginx 监听端口。
4. **Ubuntu/Debian 启用站点后冲突**：若在 `sites-enabled/` 里有多余的 `default` 且也监听 80，可先禁用：
   ```bash
   sudo rm /etc/nginx/sites-enabled/default
   sudo nginx -t && sudo systemctl start nginx
   ```

### 502 Bad Gateway

- 检查 PM2：`pm2 status`、`pm2 logs jingfang`
- 检查端口：`ss -tlnp | grep 3000` 或 `netstat -tlnp | grep 3000`

### 数据库连接失败

- 检查 `backend/config/db.js` 配置
- 远程数据库需放行 3306 端口

### SSL 申请失败

- 确认 80 端口可从公网访问
- 确认域名已正确解析到本机 IP
