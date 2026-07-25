-- ============================================================
-- 管理员账号播种脚本（对应 Python 版 mock_data/seed_admin.py）
--
-- 默认账号: admin@xingtu.com / Admin1234
-- 幂等：已存在则更新密码，不存在则插入
--
-- 执行方式：Navicat 中打开此文件 → 选择 xingtu 库 → 运行
--           或 docker exec -it xingtu-mysql mysql -uroot -pXingtu123 xingtu < mock_data/seed_admin.sql
--
-- 密码哈希说明：
--   密码 Admin1234 用 bcrypt(salt_rounds=12) 预计算
--   后端 auth.py 用 bcrypt.checkpw 校验，与本文哈希完全兼容
--   如需重置密码：重新生成 bcrypt 哈希替换下方字符串即可
-- ============================================================

-- 1. 创建 admins 表（如果不存在，结构同 database.py::Admin）
CREATE TABLE IF NOT EXISTS `admins` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(200) NOT NULL,
  `username` VARCHAR(100) DEFAULT '',
  `password` VARCHAR(200) NOT NULL COMMENT 'bcrypt 加密',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_admins_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员账号表';

-- 2. 幂等播种：已存在则更新密码，不存在则插入
INSERT INTO `admins` (`email`, `username`, `password`)
VALUES (
  'admin@xingtu.com',
  '系统管理员',
  '$2b$12$xZ9Qyw024nsAzyzLQMU5s.Tkm6.CSv3Fh.4eYUHlBFSeOvdk54XdC'  -- bcrypt('Admin1234')
)
ON DUPLICATE KEY UPDATE
  `username` = VALUES(`username`),
  `password` = VALUES(`password`);

-- 3. 验证
SELECT id, email, username, created_at, updated_at FROM `admins` WHERE email='admin@xingtu.com';

-- 提示：管理员登录接口 POST /api/auth/admin/login
-- 请求体：{"email":"admin@xingtu.com","password":"Admin1234"}
