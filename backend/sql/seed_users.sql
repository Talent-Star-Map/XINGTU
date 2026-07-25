-- ============================================================
-- 测试用户播种脚本 — 为求职者端和企业端各创建一个测试账号
--
-- 求职者账号: Xing / Xing123
-- 企业端账号: Tu   / Tu123
-- 幂等：已存在则更新密码，不存在则插入
--
-- 执行方式：Navicat 中打开此文件 → 选择 xingtu 库 → 运行
--           或 docker exec -it xingtu-mysql mysql -uroot -pXingtu123 xingtu < sql/seed_users.sql
--
-- 密码哈希说明：
--   密码 Xing123 / Tu123 用 bcrypt(salt_rounds=12) 预计算
--   后端 auth.py 用 bcrypt.checkpw 校验，与本文哈希完全兼容
--   如需重置密码：重新生成 bcrypt 哈希替换下方字符串即可
--   生成命令: python -c "import bcrypt; print(bcrypt.hashpw('新密码'.encode(), bcrypt.gensalt()).decode())"
-- ============================================================

-- ============================================================
-- 1. 求职者账号: Xing / Xing123
-- ============================================================
INSERT INTO `jobseekers`
(`email`, `phone`, `username`, `password`, `real_name`, `gender`, `age`, `education`, `school`, `city`, `target_city`, `expected_salary`, `target_position`, `experience`, `skills`, `bio`, `projects`)
VALUES
(
  'xing@test.com',
  NULL,
  'Xing',
  '$2b$12$PACs6N58XvgJRiBhkgE6PujdRJgh5fEk8Qj3GeHf0b/H1SsHJm.dK',  -- bcrypt('Xing123')
  '星图测试用户',
  '男',
  26,
  '本科',
  '测试大学',
  '北京',
  '北京',
  '20K-30K',
  '全栈开发工程师',
  '3年',
  'React,TypeScript,Node.js,Python,MySQL,Docker',
  '星图求职者端测试账号，用于联调和功能验证',
  '[]'
)
ON DUPLICATE KEY UPDATE
  `username`        = VALUES(`username`),
  `password`        = VALUES(`password`),
  `real_name`       = VALUES(`real_name`),
  `gender`          = VALUES(`gender`),
  `age`             = VALUES(`age`),
  `education`       = VALUES(`education`),
  `school`          = VALUES(`school`),
  `city`            = VALUES(`city`),
  `target_city`     = VALUES(`target_city`),
  `expected_salary` = VALUES(`expected_salary`),
  `target_position` = VALUES(`target_position`),
  `experience`      = VALUES(`experience`),
  `skills`          = VALUES(`skills`),
  `bio`             = VALUES(`bio`);

-- ============================================================
-- 2. 企业端账号: Tu / Tu123
-- ============================================================
INSERT INTO `enterprises`
(`email`, `phone`, `username`, `password`, `company_name`, `industry`, `company_size`, `company_desc`, `company_website`, `company_benefits`, `verified`, `city`)
VALUES
(
  'tu@test.com',
  NULL,
  'Tu',
  '$2b$12$cabfxQ0Hf7bbW0tS1I7cGufje6Zp0Gpkiv6CX21LEXaKU2lCEi7fW',  -- bcrypt('Tu123')
  '星图科技有限公司',
  '科技互联网',
  '50-200人',
  '星图科技是一家专注于岗位能力图谱与人才智能匹配的人工智能公司，致力于通过大模型和知识图谱技术重构招聘流程。',
  'https://www.xingtu-tech.com',
  '五险一金,弹性工作,免费三餐,股票期权,年度旅游',
  1,
  '北京'
)
ON DUPLICATE KEY UPDATE
  `username`         = VALUES(`username`),
  `password`         = VALUES(`password`),
  `company_name`     = VALUES(`company_name`),
  `industry`         = VALUES(`industry`),
  `company_size`     = VALUES(`company_size`),
  `company_desc`     = VALUES(`company_desc`),
  `company_website`  = VALUES(`company_website`),
  `company_benefits` = VALUES(`company_benefits`),
  `verified`         = VALUES(`verified`),
  `city`             = VALUES(`city`);

-- ============================================================
-- 3. 验证
-- ============================================================
SELECT '===== 求职者账号 =====' AS section;
SELECT id, email, username, real_name, target_position, city FROM `jobseekers` WHERE email='xing@test.com';

SELECT '===== 企业端账号 =====' AS section;
SELECT id, email, username, company_name, industry, city FROM `enterprises` WHERE email='tu@test.com';

-- ============================================================
-- 使用说明
-- ============================================================
-- 求职者端登录：
--   入口：前端首页 → 求职者登录
--   邮箱：xing@test.com
--   密码：Xing123
--
-- 企业端登录：
--   入口：前端首页 → 企业登录
--   邮箱：tu@test.com
--   密码：Tu123
--
-- 登录接口（POST /api/auth/login）：
--   curl -X POST http://127.0.0.1:8081/api/auth/login \
--        -H "Content-Type: application/json" \
--        -d '{"login":"xing@test.com","password":"Xing123"}'
--   curl -X POST http://127.0.0.1:8081/api/auth/login \
--        -H "Content-Type: application/json" \
--        -d '{"login":"tu@test.com","password":"Tu123"}'
