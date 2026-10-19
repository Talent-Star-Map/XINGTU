-- ──────────────────────────────────────────────────────────────────
-- match_records 表升级：三维度 → 五维度
-- 新增 edu_match（学历匹配度）和 location_match（地域匹配度）两列
--
-- 在 Navicat 中执行此脚本即可，幂等（列已存在时跳过）
--
-- ⚠️ 注意：这里没有用 `ADD COLUMN IF NOT EXISTS` —— 那是 MariaDB 语法，
--    MySQL 8.0 会报 ERROR 1064。改用 information_schema 判断 + PREPARE，
--    效果一样但是纯 MySQL 语法。
-- ──────────────────────────────────────────────────────────────────

-- 新增学历匹配度列
SET @db = DATABASE();
SET @s = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `match_records` ADD COLUMN `edu_match` INT NULL COMMENT ''学历匹配度（维度4，0-100）'' AFTER `salary_match`',
  'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'match_records' AND COLUMN_NAME = 'edu_match');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 新增地域匹配度列
SET @s = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `match_records` ADD COLUMN `location_match` INT NULL COMMENT ''地域匹配度（维度5，0-100）'' AFTER `edu_match`',
  'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'match_records' AND COLUMN_NAME = 'location_match');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 验证
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'xingtu'
  AND TABLE_NAME = 'match_records'
ORDER BY ORDINAL_POSITION;
