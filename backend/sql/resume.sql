-- ═══════════════════════════════════════════════════════════════
-- AI 简历中心 4 张表（方式B：手动建表）
-- ═══════════════════════════════════════════════════════════════
-- 用途：求职者端 AI 简历中心（模板/简历/区块/分享）
-- 对应 ORM 模型：backend/database.py::ResumeBase 下的
--   ResumeTemplate / Resume / ResumeSection / ResumeShare
-- 建表方式：在 Navicat 中手动执行（不参与 create_all 自动建表）
-- ═══════════════════════════════════════════════════════════════

-- 1. 简历模板表（管理员端「简历模板管理」页面维护）
CREATE TABLE IF NOT EXISTS resume_templates (
  id           INT PRIMARY KEY AUTO_INCREMENT COMMENT '自增主键',
  name         VARCHAR(100) NOT NULL COMMENT '模板显示名（如「经典」）',
  template_key VARCHAR(50) NOT NULL UNIQUE COMMENT '模板英文key（对应前端 templates/<key>.tsx，唯一）',
  category     VARCHAR(50) DEFAULT '通用' COMMENT '分类：经典/现代/极简/创意等',
  thumbnail    VARCHAR(500) DEFAULT '' COMMENT '预览图 URL（管理员上传）',
  sort_order   INT DEFAULT 0 COMMENT '排序权重（越小越靠前）',
  is_active    TINYINT DEFAULT 1 COMMENT '上下架：1=上架，0=下架',
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='简历模板表 — 管理员端简历模板管理维护';

-- 2. 简历主表（求职者创建的简历）
CREATE TABLE IF NOT EXISTS resumes (
  id           INT PRIMARY KEY AUTO_INCREMENT COMMENT '自增主键',
  user_id      INT NOT NULL COMMENT '所属求职者（关联 jobseekers.id）',
  title        VARCHAR(200) DEFAULT '未命名简历' COMMENT '简历标题',
  template_key VARCHAR(50) DEFAULT 'classic' COMMENT '使用的模板 key',
  language     VARCHAR(10) DEFAULT 'zh' COMMENT '语言：zh/en',
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='简历主表 — 求职者创建的简历';

-- 3. 简历区块表（每份简历的 6 大区块，content 存 JSON）
CREATE TABLE IF NOT EXISTS resume_sections (
  id           INT PRIMARY KEY AUTO_INCREMENT COMMENT '自增主键',
  resume_id    INT NOT NULL COMMENT '关联 resumes.id',
  section_type VARCHAR(50) NOT NULL COMMENT '区块类型：personal_info/summary/work_experience/education/skills/projects',
  title        VARCHAR(100) NOT NULL COMMENT '区块中文标题（如「工作经历」）',
  content      JSON COMMENT '结构化内容（JSON）',
  sort_order   INT DEFAULT 0 COMMENT '排序权重',
  visible      TINYINT DEFAULT 1 COMMENT '是否可见：1/0',
  KEY idx_resume (resume_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='简历区块表 — 每份简历的区块内容';

-- 4. 简历分享表（生成分享链接 + 二维码）
CREATE TABLE IF NOT EXISTS resume_shares (
  id          INT PRIMARY KEY AUTO_INCREMENT COMMENT '自增主键',
  resume_id   INT NOT NULL COMMENT '关联 resumes.id',
  token       VARCHAR(64) NOT NULL UNIQUE COMMENT '随机 token（URL 用，唯一）',
  expire_at   DATETIME NULL COMMENT '过期时间（NULL=永久有效）',
  visit_count INT DEFAULT 0 COMMENT '访问次数',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  KEY idx_resume (resume_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='简历分享表 — 分享链接+二维码';
