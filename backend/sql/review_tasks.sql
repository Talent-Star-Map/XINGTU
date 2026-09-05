-- review_tasks 表 — 管理员人工审核任务表
-- 用法:在 Navicat 中执行

CREATE TABLE IF NOT EXISTS review_tasks (
  id               INT PRIMARY KEY AUTO_INCREMENT COMMENT '自增主键',
  task_type        VARCHAR(20)  NOT NULL COMMENT 'new_job / skill_change',
  target_id        VARCHAR(64)  NOT NULL COMMENT 'Neo4j 节点 id',
  target_kind      VARCHAR(20)  NOT NULL COMMENT 'Job / ChangeEvent',
  content_snapshot JSON         NOT NULL COMMENT 'AI 原始内容快照',
  modified_content JSON         COMMENT '管理员修改后内容',
  status           VARCHAR(20)  DEFAULT 'pending' COMMENT 'pending/approved/rejected/modified',
  reviewer_id      INT          COMMENT '审核人 admin.id',
  review_comment   TEXT         COMMENT '审核意见',
  created_at       DATETIME     DEFAULT CURRENT_TIMESTAMP,
  reviewed_at      DATETIME     NULL,
  INDEX idx_status     (status),
  INDEX idx_task_type  (task_type),
  INDEX idx_target     (target_kind, target_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员人工审核任务表';