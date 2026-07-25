-- ============================================================
-- 测试数据播种脚本（对应 Python 版 mock_data/seed.py）
--
-- 内容：10 条测试求职者 + 10 条测试岗位（enterprise_jobs 表）+ 10 条测试匹配记录
-- 幂等：重复执行会先清理旧测试数据再重新插入（邮箱 %@test.com / 标题前缀 [测试]）
--
-- 执行方式：Navicat 中打开此文件 → 选择 xingtu 库 → 运行
--           或 docker exec -it xingtu-mysql mysql -uroot -pXingtu123 xingtu < mock_data/seed.sql
--
-- 测试账号：
--   求职者邮箱：test_js1@test.com ~ test_js10@test.com
--   统一密码：Test1234
--   岗位标题前缀：[测试]
--
-- 密码哈希说明：
--   密码 Test1234 用 bcrypt(salt_rounds=12) 预计算
--   后端 auth.py 用 bcrypt.checkpw 校验，与本文哈希完全兼容
--
-- 依赖表：
--   - jobseekers（database.py::Jobseeker）
--   - enterprise_jobs（database.py::Job，注意是 enterprise_jobs 不是 jobs）
--   - match_records（database.py::MatchRecord）
--   - enterprises（用于取 enterprise_id，若无企业用户则用兜底值 1）
-- ============================================================

-- ============================================================
-- 1. 幂等清理：删除旧的测试数据
-- ============================================================

-- 1.1 删除测试求职者关联的匹配记录
DELETE FROM `match_records`
WHERE `jobseeker_id` IN (
  SELECT id FROM `jobseekers` WHERE `email` LIKE '%@test.com'
);

-- 1.2 删除测试岗位关联的匹配记录（标题前缀 [测试]）
DELETE FROM `match_records`
WHERE `job_id` IN (
  SELECT id FROM `enterprise_jobs` WHERE `title` LIKE '[测试]%'
);

-- 1.3 删除测试求职者
DELETE FROM `jobseekers` WHERE `email` LIKE '%@test.com';

-- 1.4 删除测试岗位
DELETE FROM `enterprise_jobs` WHERE `title` LIKE '[测试]%';

-- ============================================================
-- 2. 插入 10 条测试求职者（密码统一 Test1234）
-- ============================================================
-- 字段对应 database.py::Jobseeker
INSERT INTO `jobseekers`
(`email`, `phone`, `username`, `password`, `real_name`, `gender`, `age`, `education`, `school`, `city`, `target_city`, `expected_salary`, `target_position`, `experience`, `skills`, `bio`, `projects`)
VALUES
('test_js1@test.com',  NULL, '张明', '$2b$12$23ebjtKvruY/dyhr.bh2AOltTug6A48HMuCUYZYJCjlvKhIZwjpde', '张明', '男', 26, '本科', '北京邮电大学',   '北京', '北京', '20K-30K', '前端开发工程师',   '3年', 'React,Vue,TypeScript,HTML5,CSS3',           '3年前端经验，擅长 React 生态和组件库开发', '[]'),
('test_js2@test.com',  NULL, '李华', '$2b$12$23ebjtKvruY/dyhr.bh2AOltTug6A48HMuCUYZYJCjlvKhIZwjpde', '李华', '男', 28, '硕士', '清华大学',         '北京', '北京', '30K-40K', '后端开发工程师',   '5年', 'Java,Python,MySQL,Redis,Spring Boot',       '5年后端经验，高并发系统设计，微服务架构', '[]'),
('test_js3@test.com',  NULL, '王芳', '$2b$12$23ebjtKvruY/dyhr.bh2AOltTug6A48HMuCUYZYJCjlvKhIZwjpde', '王芳', '女', 25, '本科', '中山大学',         '广州', '深圳', '15K-25K', '数据分析师',       '2年', 'Python,SQL,Tableau,Pandas,Excel',           '2年数据分析经验，擅长用户行为分析和可视化', '[]'),
('test_js4@test.com',  NULL, '陈杰', '$2b$12$23ebjtKvruY/dyhr.bh2AOltTug6A48HMuCUYZYJCjlvKhIZwjpde', '陈杰', '男', 30, '硕士', '北京大学',         '北京', '北京', '35K-50K', '全栈开发工程师',   '7年', 'React,Node.js,Python,PostgreSQL,Docker',    '7年全栈经验，从0到1搭建过多个百万级用户产品', '[]'),
('test_js5@test.com',  NULL, '刘洋', '$2b$12$23ebjtKvruY/dyhr.bh2AOltTug6A48HMuCUYZYJCjlvKhIZwjpde', '刘洋', '男', 27, '硕士', '浙江大学',         '杭州', '北京', '40K-60K', 'AI应用开发工程师', '4年', 'Python,PyTorch,TensorFlow,LLM,LangChain',   '4年AI开发经验，大模型微调和RAG应用落地', '[]'),
('test_js6@test.com',  NULL, '赵琳', '$2b$12$23ebjtKvruY/dyhr.bh2AOltTug6A48HMuCUYZYJCjlvKhIZwjpde', '赵琳', '女', 24, '本科', '复旦大学',         '上海', '杭州', '12K-18K', '产品经理',         '1年', 'Axure,Figma,数据分析,用户研究,原型设计',     '1年产品经验，专注B端SaaS产品方向', '[]'),
('test_js7@test.com',  NULL, '孙强', '$2b$12$23ebjtKvruY/dyhr.bh2AOltTug6A48HMuCUYZYJCjlvKhIZwjpde', '孙强', '男', 29, '本科', '华中科技大学',     '武汉', '上海', '35K-45K', 'Go后端工程师',     '6年', 'Go,Java,Kubernetes,Docker,MySQL',           '6年后端经验，云原生和容器化架构', '[]'),
('test_js8@test.com',  NULL, '周敏', '$2b$12$23ebjtKvruY/dyhr.bh2AOltTug6A48HMuCUYZYJCjlvKhIZwjpde', '周敏', '女', 25, '本科', '中国美术学院',     '杭州', '广州', '15K-22K', 'UI设计师',         '3年', 'Figma,Sketch,Photoshop,Illustrator,动效设计', '3年UI设计经验，互联网产品视觉设计和设计系统', '[]'),
('test_js9@test.com',  NULL, '吴磊', '$2b$12$23ebjtKvruY/dyhr.bh2AOltTug6A48HMuCUYZYJCjlvKhIZwjpde', '吴磊', '男', 28, '硕士', '上海交通大学',     '上海', '北京', '30K-40K', '数据工程师',       '5年', 'Spark,Hive,Python,SQL,Airflow',             '5年数据工程经验，离线/实时数仓建设和ETL开发', '[]'),
('test_js10@test.com', NULL, '郑雪', '$2b$12$23ebjtKvruY/dyhr.bh2AOltTug6A48HMuCUYZYJCjlvKhIZwjpde', '郑雪', '女', 24, '本科', '南京大学',         '南京', '深圳', '12K-18K', '测试开发工程师',   '2年', 'Python,Selenium,JMeter,Pytest,接口测试',     '2年测试经验，自动化测试框架搭建和CI/CD集成', '[]');

-- ============================================================
-- 3. 插入 10 条测试岗位（enterprise_jobs 表）
-- ============================================================
-- enterprise_id 取已注册企业用户的第一个 id（兜底 1）
-- 注意：表名是 enterprise_jobs（不是 jobs），避免和爬虫整合表冲突
INSERT INTO `enterprise_jobs`
(`enterprise_id`, `title`, `description`, `location`, `salary_min`, `salary_max`, `salary_range`, `education`, `experience`, `skills_required`, `status`)
VALUES
((SELECT COALESCE((SELECT id FROM `enterprises` ORDER BY id LIMIT 1), 1)), '[测试]AI应用开发工程师',   '负责大模型应用研发，包括RAG系统搭建、Prompt工程优化和LLM微调', '北京', 30, 50, '30K-50K', '硕士', '3-5年', 'Python,PyTorch,TensorFlow,LLM,LangChain',       'active'),
((SELECT COALESCE((SELECT id FROM `enterprises` ORDER BY id LIMIT 1), 1)), '[测试]高级前端开发工程师', '负责公司核心产品前端架构设计和组件库建设，推动React技术栈落地', '北京', 25, 40, '25K-40K', '本科', '3-5年', 'React,TypeScript,Vite,Webpack,CSS3',             'active'),
((SELECT COALESCE((SELECT id FROM `enterprises` ORDER BY id LIMIT 1), 1)), '[测试]后端开发工程师',     '负责交易系统后端开发，高并发场景下的服务设计和性能优化',       '上海', 25, 35, '25K-35K', '本科', '3-5年', 'Java,Spring Boot,MySQL,Redis,RabbitMQ',          'active'),
((SELECT COALESCE((SELECT id FROM `enterprises` ORDER BY id LIMIT 1), 1)), '[测试]数据分析师',         '负责用户增长数据分析，搭建指标体系和数据看板，输出业务洞察',   '深圳', 15, 25, '15K-25K', '本科', '1-3年', 'Python,SQL,Tableau,Pandas,Excel',                'active'),
((SELECT COALESCE((SELECT id FROM `enterprises` ORDER BY id LIMIT 1), 1)), '[测试]全栈开发工程师',     '负责SaaS平台全栈开发，从前端到后端到部署的端到端交付',         '北京', 35, 50, '35K-50K', '本科', '5-7年', 'React,Node.js,Python,PostgreSQL,Docker',         'active'),
((SELECT COALESCE((SELECT id FROM `enterprises` ORDER BY id LIMIT 1), 1)), '[测试]产品经理',           '负责B端SaaS产品规划与设计，推动产品迭代和用户增长',            '杭州', 20, 30, '20K-30K', '本科', '3-5年', 'Axure,Figma,数据分析,用户研究,原型设计',         'active'),
((SELECT COALESCE((SELECT id FROM `enterprises` ORDER BY id LIMIT 1), 1)), '[测试]Go后端工程师',       '负责云原生平台后端开发，微服务架构设计和K8s容器编排',          '上海', 35, 50, '35K-50K', '本科', '5-7年', 'Go,Kubernetes,Docker,MySQL,gRPC',               'active'),
((SELECT COALESCE((SELECT id FROM `enterprises` ORDER BY id LIMIT 1), 1)), '[测试]UI设计师',           '负责产品界面视觉设计和交互设计，维护和迭代设计系统',           '广州', 15, 22, '15K-22K', '本科', '1-3年', 'Figma,Sketch,Photoshop,Illustrator,动效设计',    'active'),
((SELECT COALESCE((SELECT id FROM `enterprises` ORDER BY id LIMIT 1), 1)), '[测试]数据工程师',         '负责数据仓库建设和ETL开发，保障数据质量和数据管道稳定',       '北京', 30, 40, '30K-40K', '硕士', '3-5年', 'Spark,Hive,Python,SQL,Airflow',                 'active'),
((SELECT COALESCE((SELECT id FROM `enterprises` ORDER BY id LIMIT 1), 1)), '[测试]测试开发工程师',     '负责自动化测试框架开发和维护，推动CI/CD流程中的质量保障',     '深圳', 15, 20, '15K-20K', '本科', '1-3年', 'Python,Selenium,JMeter,Pytest,接口测试',         'closed');

-- ============================================================
-- 4. 插入 10 条测试匹配记录
-- ============================================================
-- 通过子查询关联：用 email 查 jobseeker_id，用 title 查 job_id
-- 注意：每条岗位 title 在测试数据中唯一，可以用来关联
-- 测试分数仅用于联调，后续匹配引擎就绪后会被真实分数覆盖
INSERT INTO `match_records`
(`job_id`, `jobseeker_id`, `match_score`, `skill_match`, `exp_match`, `salary_match`, `status`)
VALUES
((SELECT id FROM `enterprise_jobs` WHERE title='[测试]AI应用开发工程师'   ORDER BY id DESC LIMIT 1),
 (SELECT id FROM `jobseekers`       WHERE email='test_js5@test.com'),
 92, 95, 88, 90, 'accepted'),

((SELECT id FROM `enterprise_jobs` WHERE title='[测试]高级前端开发工程师' ORDER BY id DESC LIMIT 1),
 (SELECT id FROM `jobseekers`       WHERE email='test_js1@test.com'),
 88, 90, 85, 88, 'pending'),

((SELECT id FROM `enterprise_jobs` WHERE title='[测试]后端开发工程师'     ORDER BY id DESC LIMIT 1),
 (SELECT id FROM `jobseekers`       WHERE email='test_js2@test.com'),
 85, 88, 85, 82, 'pending'),

((SELECT id FROM `enterprise_jobs` WHERE title='[测试]数据分析师'         ORDER BY id DESC LIMIT 1),
 (SELECT id FROM `jobseekers`       WHERE email='test_js3@test.com'),
 78, 80, 72, 82, 'pending'),

((SELECT id FROM `enterprise_jobs` WHERE title='[测试]全栈开发工程师'     ORDER BY id DESC LIMIT 1),
 (SELECT id FROM `jobseekers`       WHERE email='test_js4@test.com'),
 91, 93, 90, 90, 'accepted'),

((SELECT id FROM `enterprise_jobs` WHERE title='[测试]产品经理'           ORDER BY id DESC LIMIT 1),
 (SELECT id FROM `jobseekers`       WHERE email='test_js6@test.com'),
 72, 75, 65, 76, 'pending'),

((SELECT id FROM `enterprise_jobs` WHERE title='[测试]Go后端工程师'       ORDER BY id DESC LIMIT 1),
 (SELECT id FROM `jobseekers`       WHERE email='test_js7@test.com'),
 86, 88, 85, 85, 'pending'),

((SELECT id FROM `enterprise_jobs` WHERE title='[测试]UI设计师'           ORDER BY id DESC LIMIT 1),
 (SELECT id FROM `jobseekers`       WHERE email='test_js8@test.com'),
 81, 85, 78, 80, 'rejected'),

((SELECT id FROM `enterprise_jobs` WHERE title='[测试]数据工程师'         ORDER BY id DESC LIMIT 1),
 (SELECT id FROM `jobseekers`       WHERE email='test_js9@test.com'),
 89, 92, 88, 87, 'pending'),

((SELECT id FROM `enterprise_jobs` WHERE title='[测试]测试开发工程师'     ORDER BY id DESC LIMIT 1),
 (SELECT id FROM `jobseekers`       WHERE email='test_js10@test.com'),
 76, 78, 72, 78, 'rejected');

-- ============================================================
-- 5. 验证导入结果
-- ============================================================
SELECT '===== 求职者 =====' AS section;
SELECT id, email, username, real_name, target_position, experience FROM `jobseekers` WHERE email LIKE '%@test.com';

SELECT '===== 岗位 =====' AS section;
SELECT id, enterprise_id, title, location, salary_range, status FROM `enterprise_jobs` WHERE title LIKE '[测试]%';

SELECT '===== 匹配记录 =====' AS section;
SELECT mr.id, j.title AS job_title, js.email AS jobseeker_email,
       mr.match_score, mr.skill_match, mr.exp_match, mr.salary_match, mr.status
FROM `match_records` mr
JOIN `enterprise_jobs` j ON mr.job_id = j.id
JOIN `jobseekers` js ON mr.jobseeker_id = js.id
WHERE j.title LIKE '[测试]%' OR js.email LIKE '%@test.com'
ORDER BY mr.id;
