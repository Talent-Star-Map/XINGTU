"""
测试数据播种脚本 — 为 jobs / match_records / jobseekers 表填充联调用测试数据

用法:
    cd backend && python -m mock_data.seed          # 本地运行（DATABASE_URL 指向 localhost:3307）
    docker exec xingtu-api python -m mock_data.seed  # 容器内运行

特点:
    - 幂等：重复运行不会产生重复数据，会先清理旧测试数据再重新插入
    - 测试账号统一密码: Test1234
    - 所有测试求职者邮箱后缀 @test.com，岗位标题前缀 [测试]，便于识别和清理
"""
import sys
import os

# 确保能导入 backend 根目录下的 database 模块
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import bcrypt
from database import Jobseeker, Job, MatchRecord, get_session

# ─── 测试求职者数据（10 条，覆盖前端/后端/AI/数据/产品/设计/测试等方向）──────────
TEST_JOBSEEKERS = [
    # (email, username, real_name, gender, age, education, school, city, target_city, expected_salary, target_position, experience, skills, bio)
    ('test_js1@test.com',  '张明',  '张明',  '男', 26, '本科', '北京邮电大学',     '北京', '北京', '20K-30K', '前端开发工程师',   '3年',  'React,Vue,TypeScript,HTML5,CSS3',           '3年前端经验，擅长 React 生态和组件库开发'),
    ('test_js2@test.com',  '李华',  '李华',  '男', 28, '硕士', '清华大学',         '北京', '北京', '30K-40K', '后端开发工程师',   '5年',  'Java,Python,MySQL,Redis,Spring Boot',       '5年后端经验，高并发系统设计，微服务架构'),
    ('test_js3@test.com',  '王芳',  '王芳',  '女', 25, '本科', '中山大学',         '广州', '深圳', '15K-25K', '数据分析师',       '2年',  'Python,SQL,Tableau,Pandas,Excel',           '2年数据分析经验，擅长用户行为分析和可视化'),
    ('test_js4@test.com',  '陈杰',  '陈杰',  '男', 30, '硕士', '北京大学',         '北京', '北京', '35K-50K', '全栈开发工程师',   '7年',  'React,Node.js,Python,PostgreSQL,Docker',    '7年全栈经验，从0到1搭建过多个百万级用户产品'),
    ('test_js5@test.com',  '刘洋',  '刘洋',  '男', 27, '硕士', '浙江大学',         '杭州', '北京', '40K-60K', 'AI应用开发工程师', '4年',  'Python,PyTorch,TensorFlow,LLM,LangChain',   '4年AI开发经验，大模型微调和RAG应用落地'),
    ('test_js6@test.com',  '赵琳',  '赵琳',  '女', 24, '本科', '复旦大学',         '上海', '杭州', '12K-18K', '产品经理',         '1年',  'Axure,Figma,数据分析,用户研究,原型设计',     '1年产品经验，专注B端SaaS产品方向'),
    ('test_js7@test.com',  '孙强',  '孙强',  '男', 29, '本科', '华中科技大学',     '武汉', '上海', '35K-45K', 'Go后端工程师',     '6年',  'Go,Java,Kubernetes,Docker,MySQL',           '6年后端经验，云原生和容器化架构'),
    ('test_js8@test.com',  '周敏',  '周敏',  '女', 25, '本科', '中国美术学院',     '杭州', '广州', '15K-22K', 'UI设计师',         '3年',  'Figma,Sketch,Photoshop,Illustrator,动效设计', '3年UI设计经验，互联网产品视觉设计和设计系统'),
    ('test_js9@test.com',  '吴磊',  '吴磊',  '男', 28, '硕士', '上海交通大学',     '上海', '北京', '30K-40K', '数据工程师',       '5年',  'Spark,Hive,Python,SQL,Airflow',             '5年数据工程经验，离线/实时数仓建设和ETL开发'),
    ('test_js10@test.com', '郑雪',  '郑雪',  '女', 24, '本科', '南京大学',         '南京', '深圳', '12K-18K', '测试开发工程师',   '2年',  'Python,Selenium,JMeter,Pytest,接口测试',     '2年测试经验，自动化测试框架搭建和CI/CD集成'),
]

# ─── 测试岗位数据（10 条，enterprise_id=2 对应当前已注册的企业用户）──────────────
TEST_JOBS = [
    # (title, description, location, salary_min, salary_max, salary_range, education, experience, skills_required, status)
    ('[测试]AI应用开发工程师',   '负责大模型应用研发，包括RAG系统搭建、Prompt工程优化和LLM微调', '北京', 30, 50, '30K-50K', '硕士', '3-5年', 'Python,PyTorch,TensorFlow,LLM,LangChain',       'active'),
    ('[测试]高级前端开发工程师', '负责公司核心产品前端架构设计和组件库建设，推动React技术栈落地', '北京', 25, 40, '25K-40K', '本科', '3-5年', 'React,TypeScript,Vite,Webpack,CSS3',             'active'),
    ('[测试]后端开发工程师',     '负责交易系统后端开发，高并发场景下的服务设计和性能优化',       '上海', 25, 35, '25K-35K', '本科', '3-5年', 'Java,Spring Boot,MySQL,Redis,RabbitMQ',          'active'),
    ('[测试]数据分析师',         '负责用户增长数据分析，搭建指标体系和数据看板，输出业务洞察',   '深圳', 15, 25, '15K-25K', '本科', '1-3年', 'Python,SQL,Tableau,Pandas,Excel',                'active'),
    ('[测试]全栈开发工程师',     '负责SaaS平台全栈开发，从前端到后端到部署的端到端交付',         '北京', 35, 50, '35K-50K', '本科', '5-7年', 'React,Node.js,Python,PostgreSQL,Docker',         'active'),
    ('[测试]产品经理',           '负责B端SaaS产品规划与设计，推动产品迭代和用户增长',            '杭州', 20, 30, '20K-30K', '本科', '3-5年', 'Axure,Figma,数据分析,用户研究,原型设计',         'active'),
    ('[测试]Go后端工程师',       '负责云原生平台后端开发，微服务架构设计和K8s容器编排',          '上海', 35, 50, '35K-50K', '本科', '5-7年', 'Go,Kubernetes,Docker,MySQL,gRPC',               'active'),
    ('[测试]UI设计师',           '负责产品界面视觉设计和交互设计，维护和迭代设计系统',           '广州', 15, 22, '15K-22K', '本科', '1-3年', 'Figma,Sketch,Photoshop,Illustrator,动效设计',    'active'),
    ('[测试]数据工程师',         '负责数据仓库建设和ETL开发，保障数据质量和数据管道稳定',       '北京', 30, 40, '30K-40K', '硕士', '3-5年', 'Spark,Hive,Python,SQL,Airflow',                 'active'),
    ('[测试]测试开发工程师',     '负责自动化测试框架开发和维护，推动CI/CD流程中的质量保障',     '深圳', 15, 20, '15K-20K', '本科', '1-3年', 'Python,Selenium,JMeter,Pytest,接口测试',         'closed'),
]

# ─── 测试匹配记录（10 条，关联上述岗位与求职者，含测试用匹配分数）────────────────
# (job_index, jobseeker_index, match_score, skill_match, exp_match, salary_match, status)
# 分数为测试用途，后续匹配引擎就绪后将被真实分数覆盖
TEST_MATCHES = [
    (0, 4, 92, 95, 88, 90, 'accepted'),   # AI开发岗 ↔ 刘洋(AI方向)  高度匹配
    (1, 0, 88, 90, 85, 88, 'pending'),    # 前端岗   ↔ 张明(前端)    匹配良好
    (2, 1, 85, 88, 85, 82, 'pending'),    # 后端Java ↔ 李华(后端)    匹配良好
    (3, 2, 78, 80, 72, 82, 'pending'),    # 数据分析 ↔ 王芳(数据)    中等匹配
    (4, 3, 91, 93, 90, 90, 'accepted'),   # 全栈岗   ↔ 陈杰(全栈)    高度匹配
    (5, 5, 72, 75, 65, 76, 'pending'),    # 产品岗   ↔ 赵琳(产品)    中等偏低
    (6, 6, 86, 88, 85, 85, 'pending'),    # Go后端   ↔ 孙强(Go)      匹配良好
    (7, 7, 81, 85, 78, 80, 'rejected'),   # UI设计   ↔ 周敏(UI)      匹配良好但已拒绝
    (8, 8, 89, 92, 88, 87, 'pending'),    # 数据工程 ↔ 吴磊(数据工程) 匹配良好
    (9, 9, 76, 78, 72, 78, 'rejected'),   # 测试岗   ↔ 郑雪(测试)    中等匹配已关闭
]

TEST_PASSWORD = 'Test1234'  # 测试统一密码，满足注册校验（8位+大小写+数字）


def seed():
    """执行播种：清理旧测试数据 → 插入新测试数据"""
    session = get_session()
    try:
        # ── 1. 幂等清理：删除旧的测试数据 ──
        old_js = session.query(Jobseeker).filter(Jobseeker.email.like('%@test.com')).all()
        old_js_ids = [j.id for j in old_js]
        if old_js_ids:
            # 先删匹配记录（外键依赖），再删求职者
            session.query(MatchRecord).filter(MatchRecord.jobseeker_id.in_(old_js_ids)).delete(synchronize_session=False)
            session.query(Jobseeker).filter(Jobseeker.id.in_(old_js_ids)).delete(synchronize_session=False)
        # 清理测试岗位（标题前缀 [测试]）
        old_jobs = session.query(Job).filter(Job.title.like('[测试]%')).all()
        old_job_ids = [j.id for j in old_jobs]
        if old_job_ids:
            session.query(MatchRecord).filter(MatchRecord.job_id.in_(old_job_ids)).delete(synchronize_session=False)
            session.query(Job).filter(Job.id.in_(old_job_ids)).delete(synchronize_session=False)
        session.commit()
        print(f'[清理] 已删除旧测试数据: {len(old_js)} 求职者, {len(old_jobs)} 岗位')

        # ── 2. 插入测试求职者（10 条）──
        hashed = bcrypt.hashpw(TEST_PASSWORD.encode(), bcrypt.gensalt()).decode()
        js_ids = []  # 记录插入后的 id
        for (email, username, real_name, gender, age, edu, school, city, tcity, salary, pos, exp, skills, bio) in TEST_JOBSEEKERS:
            js = Jobseeker(
                email=email, phone=None, username=username, password=hashed,
                real_name=real_name, gender=gender, age=age, education=edu, school=school,
                city=city, target_city=tcity, expected_salary=salary, target_position=pos,
                experience=exp, skills=skills, bio=bio,
            )
            session.add(js)
            session.flush()  # flush 以获取自增 id
            js_ids.append(js.id)
        session.commit()
        print(f'[插入] {len(js_ids)} 条测试求职者 → jobseekers 表 (密码: {TEST_PASSWORD})')

        # ── 3. 插入测试岗位（10 条，enterprise_id=2）──
        # 查询当前企业用户 id（兜底：若无则用 1）
        ent = session.query(__import__('database').Enterprise).first()
        ent_id = ent.id if ent else 2
        job_ids = []
        for (title, desc, loc, smin, smax, srange, edu, exp, skills_req, status) in TEST_JOBS:
            job = Job(
                enterprise_id=ent_id, title=title, description=desc, location=loc,
                salary_min=smin, salary_max=smax, salary_range=srange, education=edu,
                experience=exp, skills_required=skills_req, status=status,
            )
            session.add(job)
            session.flush()
            job_ids.append(job.id)
        session.commit()
        print(f'[插入] {len(job_ids)} 条测试岗位 → jobs 表 (enterprise_id={ent_id})')

        # ── 4. 插入测试匹配记录（10 条，含测试分数）──
        for (ji, jsi, score, skill, exp_m, salary_m, status) in TEST_MATCHES:
            mr = MatchRecord(
                job_id=job_ids[ji], jobseeker_id=js_ids[jsi],
                match_score=score, skill_match=skill, exp_match=exp_m, salary_match=salary_m,
                status=status,
            )
            session.add(mr)
        session.commit()
        print(f'[插入] {len(TEST_MATCHES)} 条测试匹配记录 → match_records 表 (含测试分数)')

        # ── 5. 汇总 ──
        print('\n===== 播种完成 =====')
        print(f'  求职者:  {len(js_ids)} 条  (邮箱 test_js1~10@test.com, 密码 {TEST_PASSWORD})')
        print(f'  岗位:    {len(job_ids)} 条  (标题前缀 [测试], enterprise_id={ent_id})')
        print(f'  匹配记录: {len(TEST_MATCHES)} 条  (分数 {min(m[2] for m in TEST_MATCHES)}-{max(m[2] for m in TEST_MATCHES)}, 状态 pending/accepted/rejected)')
    except Exception as e:
        session.rollback()
        print(f'[错误] 播种失败: {e}')
        raise
    finally:
        session.close()


if __name__ == '__main__':
    seed()
