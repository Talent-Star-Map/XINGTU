-- ============================================================
-- 学习数据三张表的建表脚本
--
-- user_skills / diagnosis_history / learning_progress
--
-- ⚠️ 这三张表的历史：routers/learning_api.py 从一开始就是用裸 SQL 访问的，
--    既没有写进 database.py 的 ORM 模型，backend/sql/ 里也一直没有对应 DDL。
--    后果是「新建一个干净的本地库」时它们不会被 create_all 建出来，
--    只能手工建 —— 而手工建又不知道字段。
--    本文件就是补这个洞，字段按 learning_api.py 里的 SELECT / INSERT 逐列对齐。
--    已有数据的库不用跑（表已存在，CREATE TABLE IF NOT EXISTS 会跳过）。
--
-- 执行方式：
--   Navicat 中打开此文件 → 选择 xingtu 库 → 运行
--   或 docker exec -i xingtu-mysql mysql -uroot -p<密码> xingtu < sql/learning.sql
-- ============================================================

-- ── 技能掌握状态 ────────────────────────────────
-- learning_api.py: GET/POST /api/learning/skills
CREATE TABLE IF NOT EXISTS `user_skills` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`     INT NOT NULL COMMENT '求职者/企业 id',
  `job_id`      INT NULL COMMENT '关联岗位；NULL 表示通用技能（非某岗位专属）',
  `skill_name`  VARCHAR(128) NOT NULL COMMENT '已归一化的技能名（skill_synonyms.canonical_name）',
  `mastered`    TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0 未掌握 / 1 已掌握',
  `mastered_at` DATETIME NULL COMMENT '掌握时间；置为未掌握时置 NULL',
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_user` (`user_id`),
  KEY `idx_user_skill` (`user_id`, `skill_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户技能掌握状态';

-- ── 人岗诊断历史 ────────────────────────────────
-- learning_api.py: GET/POST /api/learning/history
CREATE TABLE IF NOT EXISTS `diagnosis_history` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`         INT NOT NULL,
  `job_id`          INT NOT NULL COMMENT '岗位 id（爬虫主表 jobs.id）',
  `job_title`       VARCHAR(255) DEFAULT '',
  `job_company`     VARCHAR(255) DEFAULT '',
  `job_location`    VARCHAR(255) DEFAULT '',
  `job_salary`      VARCHAR(64)  DEFAULT '',
  `overall`         DECIMAL(5,2) DEFAULT 0 COMMENT '总体匹配度 0-100',
  `grade`           VARCHAR(16)  DEFAULT '',
  `have_count`      INT DEFAULT 0 COMMENT '命中技能数',
  `miss_count`      INT DEFAULT 0 COMMENT '缺失技能数',
  `skills`          LONGTEXT NULL COMMENT 'JSON: {have:[], miss:[], extra:[]}',
  `phases`          LONGTEXT NULL COMMENT 'JSON: 学习阶段数组（lib/learningPhases）',
  `recommendations` LONGTEXT NULL COMMENT 'JSON: 推荐数组',
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_user_created` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='人岗诊断历史';

-- ── 学习进度 ────────────────────────────────────
-- learning_api.py: GET/POST /api/learning/progress
CREATE TABLE IF NOT EXISTS `learning_progress` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`       INT NOT NULL,
  `job_id`        INT NULL,
  `skill_name`    VARCHAR(128) NOT NULL,
  `status`        VARCHAR(16) NOT NULL DEFAULT 'pending' COMMENT 'pending / learning / mastered',
  `study_minutes` INT NOT NULL DEFAULT 0 COMMENT '累计学习分钟数',
  `started_at`    DATETIME NULL,
  `mastered_at`   DATETIME NULL,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_user` (`user_id`),
  KEY `idx_user_job_skill` (`user_id`, `job_id`, `skill_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='技能学习进度';

-- 验证
SELECT TABLE_NAME, TABLE_COMMENT FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'xingtu'
  AND TABLE_NAME IN ('user_skills', 'diagnosis_history', 'learning_progress');
