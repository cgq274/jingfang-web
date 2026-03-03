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

若项目是用 `sudo git clone` 拉取的，建议先把目录属主改为当前用户（如 ubuntu），再安装依赖，避免 EACCES：

```bash
sudo chown -R $USER:$USER /var/www/jingfang-web
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

若服务器上曾用 1Panel 部署过经方，先停掉占用 3000 端口的 1Panel Node 进程（`sudo ss -tlnp | grep 3000` 查 pid，`sudo kill <pid>` 或到 1Panel 里停用），否则 PM2 的 jingfang 无法绑定 3000。

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

**这一步在做什么**：让外网访问你域名的 80 端口时，由 Nginx 把请求转给本机 3000 端口的 Node 应用，用户只看到域名，不看到端口。

---

### 1. 确定你要用的域名

例如：`jingfangfinance.cn`。下面用「你的域名」代替，你全部替换成自己的域名即可。

---

### 2. 新建一个 Nginx 站点配置文件

**如果是 Ubuntu / Debian**，在服务器上执行：

```bash
sudo nano /etc/nginx/sites-available/jingfang
```

**如果是 CentOS / RHEL**，执行：

```bash
sudo nano /etc/nginx/conf.d/jingfang.conf
```

会打开一个空文件（或新建文件），进入编辑模式。

---

### 3. 把下面整段复制进去，并改掉「你的域名」

把下面**整段**复制到刚才打开的文件里，把**两处** `你的域名.com` 都改成你的真实域名（例如 `jingfangfinance.cn`），**不要**保留「你的域名.com」这几个字。`listen 80 default_server` 表示 80 端口的默认站点用此配置，避免被系统自带的 default 站点抢走请求。

```nginx
server {
    listen 80 default_server;
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

**示例**：若域名是 `jingfangfinance.cn`，则 `server_name` 那一行写成：

```nginx
    server_name jingfangfinance.cn www.jingfangfinance.cn;
```

其他行不用改。保存退出：
- **nano**：按 `Ctrl+O` 回车保存，再按 `Ctrl+X` 退出。

---

### 4. 启用站点（仅 Ubuntu/Debian 需要）

**只有 Ubuntu/Debian** 需要执行下面这一行；CentOS 跳过。

```bash
sudo ln -s /etc/nginx/sites-available/jingfang /etc/nginx/sites-enabled/
```

---

### 5. 检查配置并让 Nginx 重新加载

```bash
sudo nginx -t
```

若显示 `syntax is ok` 和 `test is successful`，再执行：

```bash
sudo systemctl reload nginx
```

**Ubuntu/Debian**：若之前有默认站点，先删掉再重载，否则可能 404：

```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

到此，访问 `http://你的域名` 应能打开你的网站（若 80 端口已在防火墙/安全组放行）。

---

## 第七步：配置 HTTPS（SSL 证书）

若服务器在**国内**且域名**未备案**，用 certbot 的 HTTP 验证常会失败（被运营商拦截）。推荐用 **acme.sh + 腾讯云 DNS API** 做 DNS 验证，自动申请并续期 Let's Encrypt 证书。

### 方式 A：acme.sh + 腾讯云 DNS API（推荐，国内/未备案适用）

**1. 安装 acme.sh**（用 ubuntu 用户，不要 sudo）

```bash
curl https://get.acme.sh | sh -s email=你的邮箱@example.com
source ~/.bashrc
```

**2. 在腾讯云获取 API 密钥**

登录 [腾讯云 - API 密钥管理](https://console.cloud.tencent.com/cam/capi)，新建或使用已有的 **SecretId**、**SecretKey**。

**3. 使用 Let's Encrypt 并申请证书**（变量名必须是 `Tencent_SecretId` / `Tencent_SecretKey`）

```bash
~/.acme.sh/acme.sh --set-default-ca --server letsencrypt

export Tencent_SecretId="你的SecretId"
export Tencent_SecretKey="你的SecretKey"
~/.acme.sh/acme.sh --issue --dns dns_tencent -d 你的域名.com -d www.你的域名.com
```

**4. 安装证书到本机目录（不要用 sudo 跑 acme.sh）**

```bash
mkdir -p /home/ubuntu/nginx-ssl
~/.acme.sh/acme.sh --install-cert -d 你的域名.com --ecc \
  --key-file /home/ubuntu/nginx-ssl/你的域名.com.key \
  --fullchain-file /home/ubuntu/nginx-ssl/你的域名.com.pem \
  --reloadcmd "sudo cp /home/ubuntu/nginx-ssl/你的域名.com.key /home/ubuntu/nginx-ssl/你的域名.com.pem /etc/nginx/ssl/ && sudo systemctl reload nginx"
```

**5. 复制证书到 Nginx 目录**

```bash
sudo mkdir -p /etc/nginx/ssl
sudo cp /home/ubuntu/nginx-ssl/你的域名.com.key /home/ubuntu/nginx-ssl/你的域名.com.pem /etc/nginx/ssl/
```

**6. 修改 Nginx 配置，增加 443 和证书**

编辑经方站点配置（Ubuntu：`/etc/nginx/sites-available/jingfang`），在原有 `server { ... }` 里增加 `listen 443 ssl` 和证书路径，例如：

```nginx
server {
    listen 80 default_server;
    listen 443 ssl default_server;
    server_name 你的域名.com www.你的域名.com;

    ssl_certificate     /etc/nginx/ssl/你的域名.com.pem;
    ssl_certificate_key /etc/nginx/ssl/你的域名.com.key;

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

把 `你的域名.com` 换成实际域名（如 `jingfangfinance.cn`）。保存后执行：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

**7. 云安全组放行 443**

在云控制台为实例的安全组**入方向**添加：端口 **443**，来源 **0.0.0.0/0**，协议 TCP。

完成后访问 `https://你的域名.com` 即可。

---

### 方式 B：certbot（仅当域名已备案或服务器在海外时可用）

若 80 端口可从公网正常访问（无未备案拦截），可用 certbot：

```bash
# Ubuntu / Debian
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名.com -d www.你的域名.com
```

按提示填写邮箱、同意条款。完成后 certbot 会自动为 Nginx 配置 HTTPS 并设置续期。

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

### 访问 http 返回 404，且错误里出现 /opt/1panel/... 路径

说明 3000 端口被 **1Panel 的 Node 应用**占用，而不是 PM2 的 jingfang。处理：

1. 查 3000 端口进程：`sudo ss -tlnp | grep 3000`，记下 pid。
2. 停掉该进程：`sudo kill <pid>`（或到 1Panel 里停掉对应 Node 站点）。
3. 确认 3000 已空：`sudo ss -tlnp | grep 3000` 应无输出。
4. 用 PM2 重新启动经方：`cd /var/www/jingfang-web && pm2 start backend/app.js --name jingfang`，再 `pm2 save`。

建议在 1Panel 里停用或删除占用 3000 的 Node 站点，避免重启后再次占用。

### HTTPS 访问不了

1. **Nginx 是否监听 443**：`sudo ss -tlnp | grep 443`，应有 nginx。
2. **配置里是否写了 443 和证书**：`grep -E "listen 443|ssl_certificate" /etc/nginx/sites-available/jingfang`，应有 `listen 443 ssl` 和 `ssl_certificate`、`ssl_certificate_key`。
3. **证书文件是否存在**：`ls -la /etc/nginx/ssl/`，应有 `.pem` 和 `.key`。
4. **云安全组**：入方向放行 **443** 端口（TCP，来源 0.0.0.0/0）。

若 443 未监听，按本文「第七步」在站点配置里增加 `listen 443 ssl` 和证书路径，保存后 `sudo nginx -t && sudo systemctl reload nginx`。

### 数据库连接失败

- 检查 `backend/config/db.js` 配置
- 远程数据库需放行 3306 端口

### SSL 申请失败（certbot HTTP 验证）

- 国内服务器 + 未备案域名：HTTP 验证常被拦截，改用本文「第七步 方式 A」acme.sh + 腾讯云 DNS API（DNS 验证）。
- 若用 acme.sh dns_tencent，环境变量必须是 **Tencent_SecretId**、**Tencent_SecretKey**（不是 TENCENTCLOUD_*），且不要用 sudo 跑 acme.sh。
- 确认域名已正确解析到本机 IP；云安全组放行 80、443。
