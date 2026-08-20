-- ═══════════════════════════════════════════════════════════════
-- llm_configs 表 — 模型配置表（方式B：手动建表）
-- ═══════════════════════════════════════════════════════════════
-- 用途：管理员端「模型配置」页面维护，LLM 路由层读取（大模型/小模型/多模态）
-- 对应 ORM 模型：backend/database.py::LlmConfig
-- 建表方式：在 Navicat 中手动执行（与 diagnosis_history 等一致，不参与 create_all 自动建表）
--
-- ⚠️ 变更规范：
--   · 新增/修改字段时，同步更新本文件 + database.py 的 LlmConfig 模型
--   · 所有字段必须写 COMMENT 说明
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS llm_configs (
  id           INT PRIMARY KEY AUTO_INCREMENT COMMENT '自增主键',
  config_key   VARCHAR(50) NOT NULL UNIQUE COMMENT '配置项名：global_enabled/mock_mode/strong_model/fast_model/vision_model/xxx_api_key 等（唯一）',
  config_value VARCHAR(500) NOT NULL COMMENT '配置值：模型名 / API Key / 开关值（0或1）等',
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间（保存配置时自动刷新）'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='模型配置表 — LLM 路由层配置（管理员端模型配置页面维护）';
