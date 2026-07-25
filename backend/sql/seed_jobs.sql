-- ============================================================
-- 星图数据整合表 - 15 条种子岗位数据导入
-- 表结构按 docs/字段汇总.md 设计
-- 执行方式：Navicat 中打开此文件 → 选择 xingtu 库 → 运行
-- ============================================================

-- 1. 创建整合表（如果不存在）
CREATE TABLE IF NOT EXISTS `jobs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '全局主键',
  `data_type` TINYINT NOT NULL DEFAULT 1 COMMENT '数据类型：1=岗位(Job)，2=文章(Article)',
  `source` VARCHAR(50) COMMENT '数据来源（智联招聘、CSDN 等）',
  `source_url` VARCHAR(500) COMMENT '原始数据链接',
  `title` VARCHAR(300) COMMENT '标题（岗位=job_name，文章=article_title）',
  `skill_tags` JSON COMMENT '技能标签',
  `technology_field` VARCHAR(100) COMMENT '技术领域（岗位分类或文章技术领域）',
  `company_name` VARCHAR(200) COMMENT '公司名称（文章为NULL）',
  `city` VARCHAR(100) COMMENT '工作城市',
  `area` VARCHAR(100) COMMENT '工作地区',
  `salary_min` INT COMMENT '最低月薪（元）',
  `salary_max` INT COMMENT '最高月薪（元）',
  `salary_months` INT COMMENT '薪资发放月数',
  `education` VARCHAR(50) COMMENT '学历要求',
  `experience` VARCHAR(50) COMMENT '工作经验要求',
  `job_type` VARCHAR(50) COMMENT '工作类型（全职/实习等）',
  `company_type` VARCHAR(100) COMMENT '企业性质',
  `job_description` LONGTEXT COMMENT '岗位描述',
  `author` VARCHAR(100) COMMENT '作者',
  `summary` TEXT COMMENT '文章摘要',
  `article_type` VARCHAR(50) COMMENT '文章类型',
  `quality_score` DECIMAL(5,2) COMMENT '内容质量评分',
  `hot_score` DECIMAL(8,2) COMMENT '综合热度评分',
  `trend_score` DECIMAL(8,2) COMMENT '趋势评分',
  `view_count` INT DEFAULT 0 COMMENT '阅读量',
  `like_count` INT DEFAULT 0 COMMENT '点赞量',
  `collect_count` INT DEFAULT 0 COMMENT '收藏量',
  `comment_count` INT DEFAULT 0 COMMENT '评论量',
  `publish_time` DATETIME COMMENT '信息发布时间',
  `crawl_time` DATETIME COMMENT '数据采集时间',
  `update_time` DATETIME COMMENT '数据更新时间',
  PRIMARY KEY (`id`),
  INDEX `idx_data_type` (`data_type`),
  INDEX `idx_city` (`city`),
  INDEX `idx_title` (`title`),
  INDEX `idx_company` (`company_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据整合表（岗位+文章）';

-- 2. 清空旧数据（如果是重新导入；首次执行可注释掉）
TRUNCATE TABLE `jobs`;

-- 3. 插入 15 条种子岗位数据
-- 字段映射：title←title, company←company_name, location←city, salary"K-K"→salary_min/max(元), skills[]→skill_tags(JSON), description←job_description, source←source, collected_at←crawl_time
-- data_type=1 表示岗位；salary 解析规则："25K-40K" → 25000/40000
INSERT INTO `jobs` (`data_type`, `source`, `title`, `skill_tags`, `company_name`, `city`, `salary_min`, `salary_max`, `education`, `experience`, `job_type`, `job_description`, `publish_time`, `crawl_time`) VALUES
(1, 'Boss直聘', 'Java后端开发工程师', '["Java","Spring Boot","MyBatis","MySQL","Redis","Docker","Kubernetes","微服务","分布式","RabbitMQ","Git"]', '字节跳动', '北京', 25000, 40000, '本科', '3-5年', '全职', '负责电商核心系统后端设计与开发，参与高并发分布式系统架构优化', '2026-07-10 00:00:00', '2026-07-10 00:00:00'),
(1, 'Boss直聘', 'AI应用开发工程师', '["Python","大模型","RAG","LangChain","FastAPI","Docker","Elasticsearch","Git","Linux","AI"]', '华为', '深圳', 30000, 50000, '硕士', '2-5年', '全职', '基于大模型和RAG技术构建企业级AI应用，负责Agent框架设计与实现', '2026-07-11 00:00:00', '2026-07-11 00:00:00'),
(1, '拉勾', '大模型算法工程师', '["Python","大模型","PyTorch","TensorFlow","NLP","RAG","LangChain","AI","Linux","Docker","Git"]', '百度', '北京', 40000, 70000, '硕士', '3-5年', '全职', '负责大语言模型训练与微调，优化模型推理性能，探索Agent与多模态技术', '2026-07-11 00:00:00', '2026-07-11 00:00:00'),
(1, 'Boss直聘', '前端开发工程师', '["React","TypeScript","Vue","JavaScript","HTML","CSS","Node.js","Git","Nginx","Docker","CI/CD"]', '腾讯', '深圳', 20000, 35000, '本科', '2-4年', '全职', '负责企业级SaaS产品前端架构设计与开发，优化性能和用户体验', '2026-07-09 00:00:00', '2026-07-09 00:00:00'),
(1, '拉勾', '云原生工程师', '["Docker","Kubernetes","Go","Python","Linux","Jenkins","AWS","Nginx","微服务","分布式","CI/CD","Git"]', '阿里云', '杭州', 30000, 45000, '本科', '3-5年', '全职', '负责Kubernetes平台建设与运维，设计微服务治理方案，推动DevOps实践', '2026-07-10 00:00:00', '2026-07-10 00:00:00'),
(1, 'Boss直聘', '数据工程师', '["Python","Spark","Flink","Kafka","Hadoop","MySQL","Redis","Elasticsearch","Docker","Linux","Git"]', '美团', '北京', 28000, 45000, '本科', '3-5年', '全职', '负责大数据平台建设，ETL流程优化，实时数据处理Pipeline开发', '2026-07-08 00:00:00', '2026-07-08 00:00:00'),
(1, '拉勾', 'DevOps工程师', '["Docker","Kubernetes","Jenkins","Linux","AWS","Python","Go","Nginx","CI/CD","Git","RabbitMQ"]', '网易', '广州', 25000, 38000, '本科', '2-5年', '全职', '负责CI/CD流水线建设，容器化平台运维，监控告警体系搭建', '2026-07-11 00:00:00', '2026-07-11 00:00:00'),
(1, 'Boss直聘', 'Python后端开发', '["Python","FastAPI","Django","PostgreSQL","Redis","Docker","Kubernetes","Elasticsearch","微服务","Git","Linux"]', '小红书', '上海', 22000, 35000, '本科', '1-3年', '全职', '负责内容推荐系统后端开发，使用FastAPI + PostgreSQL，参与微服务拆分', '2026-07-10 00:00:00', '2026-07-10 00:00:00'),
(1, 'Boss直聘', '全栈开发工程师', '["React","TypeScript","Go","Python","MySQL","Redis","Docker","Kubernetes","Nginx","Git","CI/CD"]', '字节跳动', '上海', 28000, 42000, '本科', '3-5年', '全职', '负责内部工具平台全栈开发，React前端 + Go后端，参与架构设计', '2026-07-12 00:00:00', '2026-07-12 00:00:00'),
(1, '拉勾', 'AI Agent开发工程师', '["Python","大模型","LangChain","RAG","Agent","FastAPI","Docker","Kubernetes","Elasticsearch","AI","Git","Linux"]', '商汤科技', '上海', 35000, 55000, '硕士', '2-5年', '全职', '负责多Agent协作框架开发，集成大模型与工具调用，构建自主决策系统', '2026-07-12 00:00:00', '2026-07-12 00:00:00'),
(1, 'Boss直聘', 'Go后端开发工程师', '["Go","Redis","MySQL","Kafka","Docker","Kubernetes","微服务","分布式","高并发","Git","Linux","Nginx"]', '滴滴出行', '北京', 28000, 40000, '本科', '3-5年', '全职', '负责出行核心调度系统后端开发，高并发场景优化，微服务治理', '2026-07-09 00:00:00', '2026-07-09 00:00:00'),
(1, '拉勾', 'NLP算法工程师', '["Python","NLP","PyTorch","TensorFlow","大模型","RAG","Transformer","Docker","Git","Linux","AI"]', '科大讯飞', '合肥', 30000, 48000, '硕士', '2-5年', '全职', '负责自然语言处理模型研发，包括文本分类、信息抽取、对话系统', '2026-07-10 00:00:00', '2026-07-10 00:00:00'),
(1, 'Boss直聘', '测试开发工程师', '["Python","Java","Jenkins","Docker","Linux","MySQL","Git","CI/CD","Selenium","JMeter"]', '京东', '北京', 20000, 32000, '本科', '2-4年', '全职', '负责自动化测试框架开发，性能测试平台建设，CI/CD集成测试', '2026-07-08 00:00:00', '2026-07-08 00:00:00'),
(1, '拉勾', '数据库管理员(DBA)', '["MySQL","PostgreSQL","Redis","MongoDB","Linux","Docker","Kubernetes","Python","Shell","高可用"]', '蚂蚁集团', '杭州', 30000, 50000, '本科', '5年+', '全职', '负责MySQL/PostgreSQL数据库运维、性能优化、高可用架构设计', '2026-07-11 00:00:00', '2026-07-11 00:00:00'),
(1, 'Boss直聘', '安全工程师', '["Python","Go","Linux","Docker","Kubernetes","Nginx","Git","BurpSuite","Metasploit"]', '奇安信', '北京', 25000, 40000, '本科', '3-5年', '全职', '负责Web安全漏洞挖掘、渗透测试、安全架构评审，SDL流程建设', '2026-07-12 00:00:00', '2026-07-12 00:00:00');

-- 4. 验证导入结果
SELECT id, title, company_name, city, salary_min, salary_max, JSON_LENGTH(skill_tags) AS skill_count, source, crawl_time
FROM jobs
WHERE data_type = 1
ORDER BY id;
