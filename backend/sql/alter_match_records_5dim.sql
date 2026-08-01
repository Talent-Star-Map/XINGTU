-- ──────────────────────────────────────────────────────────────────
-- match_records 表升级：三维度 → 五维度
-- 新增 edu_match（学历匹配度）和 location_match（地域匹配度）两列
--
-- 在 Navicat 中执行此脚本即可，幂等（列已存在时跳过）
-- ──────────────────────────────────────────────────────────────────

-- 新增学历匹配度列
ALTER TABLE `match_records`
  ADD COLUMN IF NOT EXISTS `edu_match` INT NULL COMMENT '学历匹配度（维度4，0-100）' AFTER `salary_match`;

-- 新增地域匹配度列
ALTER TABLE `match_records`
  ADD COLUMN IF NOT EXISTS `location_match` INT NULL COMMENT '地域匹配度（维度5，0-100）' AFTER `edu_match`;

-- 验证
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'xingtu'
  AND TABLE_NAME = 'match_records'
ORDER BY ORDINAL_POSITION;
