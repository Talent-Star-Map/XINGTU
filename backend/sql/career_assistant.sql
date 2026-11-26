-- 小星智能体私有会话、记忆和岗位简历绑定。按项目方式B手动执行。

-- 不执行自动create_all，不修改既有简历。上线前备份。

-- 对应 services/career_schema.py；回滚前先关闭career入口并保留资料备份。

SET NAMES utf8mb4;


CREATE TABLE IF NOT EXISTS career_facts (
	id VARCHAR(32) NOT NULL COMMENT '唯一标识',
	owner VARCHAR(64) NOT NULL COMMENT '已验证身份 jobseeker:id',
	kind VARCHAR(50) NOT NULL COMMENT '资料类别',
	fact_key VARCHAR(200) NOT NULL COMMENT '资料名称',
	value LONGTEXT NOT NULL COMMENT '用户事实JSON',
	source LONGTEXT NOT NULL COMMENT '原始来源JSON',
	source_key VARCHAR(64) NOT NULL COMMENT '来源哈希',
	evidence LONGTEXT NOT NULL COMMENT '原文证据JSON',
	confirmed INTEGER NOT NULL COMMENT '是否经用户确认',
	status VARCHAR(24) NOT NULL COMMENT '资料或任务状态',
	created_at DATETIME(6) NOT NULL COMMENT '创建时间UTC',
	updated_at DATETIME(6) NOT NULL COMMENT '更新时间UTC',
	PRIMARY KEY (id),
	CONSTRAINT uq_career_fact_source UNIQUE (owner, kind, fact_key, source_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小星私有求职助手';


CREATE TABLE IF NOT EXISTS career_messages (
	id VARCHAR(32) NOT NULL COMMENT '唯一标识',
	owner VARCHAR(64) NOT NULL COMMENT '已验证身份 jobseeker:id',
	thread_id VARCHAR(32) NOT NULL COMMENT '所属私有会话',
	`role` VARCHAR(16) NOT NULL COMMENT '消息角色',
	content LONGTEXT NOT NULL COMMENT '私有消息正文',
	metadata LONGTEXT NOT NULL COMMENT '会话设置和目标岗位',
	created_at DATETIME(6) NOT NULL COMMENT '创建时间UTC',
	PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小星私有求职助手';


CREATE TABLE IF NOT EXISTS career_runs (
	id VARCHAR(32) NOT NULL COMMENT '唯一标识',
	owner VARCHAR(64) NOT NULL COMMENT '已验证身份 jobseeker:id',
	thread_id VARCHAR(32) NOT NULL COMMENT '所属私有会话',
	job_key VARCHAR(100) NOT NULL COMMENT '目标实际岗位标识',
	idempotency_key VARCHAR(160) NOT NULL COMMENT '请求幂等标识',
	status VARCHAR(32) NOT NULL COMMENT '资料或任务状态',
	payload LONGTEXT NOT NULL COMMENT '可恢复任务状态JSON',
	created_at DATETIME(6) NOT NULL COMMENT '创建时间UTC',
	updated_at DATETIME(6) NOT NULL COMMENT '更新时间UTC',
	PRIMARY KEY (id),
	CONSTRAINT uq_career_run_request UNIQUE (owner, idempotency_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小星私有求职助手';


CREATE TABLE IF NOT EXISTS career_threads (
	id VARCHAR(32) NOT NULL COMMENT '唯一标识',
	owner VARCHAR(64) NOT NULL COMMENT '已验证身份 jobseeker:id',
	title VARCHAR(200) NOT NULL COMMENT '会话标题',
	metadata LONGTEXT NOT NULL COMMENT '会话设置和目标岗位',
	active_run_id VARCHAR(32) COMMENT '当前运行任务，跨进程互斥',
	created_at DATETIME(6) NOT NULL COMMENT '创建时间UTC',
	updated_at DATETIME(6) NOT NULL COMMENT '更新时间UTC',
	PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小星私有求职助手';


CREATE TABLE IF NOT EXISTS resume_target_bindings (
	id VARCHAR(32) NOT NULL COMMENT '唯一标识',
	owner VARCHAR(64) NOT NULL COMMENT '已验证身份 jobseeker:id',
	resume_id INTEGER NOT NULL COMMENT '简历中心简历ID',
	run_id VARCHAR(32) NOT NULL COMMENT '唯一生成任务',
	job_snapshot LONGTEXT NOT NULL COMMENT '生成时岗位快照JSON',
	provenance LONGTEXT NOT NULL COMMENT '字段级来源JSON',
	created_at DATETIME(6) NOT NULL COMMENT '创建时间UTC',
	PRIMARY KEY (id),
	UNIQUE (run_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小星私有求职助手';

CREATE INDEX ix_career_threads_owner ON career_threads (owner);
CREATE INDEX ix_career_messages_thread_id ON career_messages (thread_id);
CREATE INDEX ix_career_run_queue ON career_runs (status, updated_at);
