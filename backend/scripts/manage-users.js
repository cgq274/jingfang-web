/**
 * 账号管理脚本（管理员 + 普通账号）
 *
 * 功能（针对 admin-config.js 中的配置）：
 * - 若 action 为 'delete'：按用户名删除账号
 * - 否则：
 *   - 用户名不存在：创建新账号（支持 admin / member）
 *   - 用户名已存在：更新该账号的密码、手机号、邮箱、角色
 *
 * 使用方法（在 backend 目录）：
 *   node scripts/manage-users.js
 */

const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const path = require("path");

// 读取账号配置（与之前的 admin-config.js 共用）
const configPath = path.join(__dirname, "admin-config.js");
/** @type {{ username:string, password:string, phone?:string, email?:string, role?:'admin'|'member', action?:'delete' }[]} */
const accountConfigs = require(configPath);

// 数据库配置（与 config/db.js 保持一致）
const { dbConfig } = require("../config/db");

async function manageUsers() {
  let connection;
  try {
    console.log("正在连接数据库...");
    connection = await mysql.createConnection(dbConfig);
    console.log("✓ 数据库连接成功\n");

    for (let i = 0; i < accountConfigs.length; i++) {
      const cfg = accountConfigs[i];
      const username = cfg.username && String(cfg.username).trim();
      const password = cfg.password && String(cfg.password);
      const phone = cfg.phone ? String(cfg.phone).trim() : null;
      const email = cfg.email ? String(cfg.email).trim() : null;
      const role = cfg.role === "admin" ? "admin" : "member"; // 默认普通用户
      const action = cfg.action || "upsert";

      if (!username) {
        console.log(`[${i + 1}] 配置跳过：缺少用户名`);
        continue;
      }

      console.log(`[${i + 1}] 处理账号: ${username}（action=${action}, role=${role}）`);

      if (action === "delete") {
        // 删除账号
        const [result] = await connection.execute(
          "DELETE FROM users WHERE username = ?",
          [username]
        );
        if (result.affectedRows > 0) {
          console.log(`  ✓ 已删除账号 '${username}'（共 ${result.affectedRows} 条记录）`);
        } else {
          console.log(`  ℹ️ 未找到要删除的账号 '${username}'`);
        }
        console.log();
        continue;
      }

      if (!password) {
        console.log("  ⚠️ 跳过：未提供密码（非 delete 操作必须提供 password）");
        console.log();
        continue;
      }

      // upsert 逻辑（先查是否存在）
      const [rows] = await connection.execute(
        "SELECT id, username, phone, email, role FROM users WHERE username = ?",
        [username]
      );

      const hashedPassword = await bcrypt.hash(password, 10);

      if (rows.length > 0) {
        // 更新现有账号
        const existing = rows[0];
        console.log(
          `  账号已存在 (ID: ${existing.id})，执行更新（密码/手机号/邮箱/角色）...`
        );

        await connection.execute(
          "UPDATE users SET password = ?, phone = ?, email = ?, role = ? WHERE id = ?",
          [
            hashedPassword,
            phone || existing.phone,
            email || existing.email,
            role,
            existing.id,
          ]
        );
        console.log("  ✓ 更新完成");
      } else {
        // 创建新账号
        console.log("  账号不存在，创建新账号...");
        await connection.execute(
          "INSERT INTO users (username, password, phone, email, role) VALUES (?, ?, ?, ?, ?)",
          [username, hashedPassword, phone, email, role]
        );
        console.log("  ✓ 创建完成");
      }

      console.log();
    }

    // 展示所有账号
    console.log("\n当前数据库中的所有账号：");
    const [allUsers] = await connection.execute(
      "SELECT id, username, phone, email, role, created_at FROM users ORDER BY id"
    );
    if (allUsers.length === 0) {
      console.log("  (无账号)");
    } else {
      allUsers.forEach((user) => {
        console.log(
          `  - ID: ${user.id}, 用户名: ${user.username}, 手机: ${
            user.phone || "未设置"
          }, 邮箱: ${user.email || "未设置"}, 角色: ${user.role}, 创建时间: ${
            user.created_at
          }`
        );
      });
    }

    console.log("\n✓ 账号管理脚本执行完成");
  } catch (error) {
    console.error("❌ 错误:", error.message);
    console.error("错误详情:", {
      code: error.code,
      errno: error.errno,
      sqlMessage: error.sqlMessage,
    });
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log("\n数据库连接已关闭");
    }
  }
}

manageUsers();

