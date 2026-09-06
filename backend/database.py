import os, uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine, Column, Integer, String, DateTime, func, Text, DECIMAL
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.dialects.mysql import JSON, LONGTEXT, TINYINT

DATABASE_URL = os.getenv('DATABASE_URL', 'mysql+pymysql://root:xingtu123@localhost:3307/xingtu')

# connect_args charset=utf8mb4：双保险，确保读写连接走 UTF-8，避免中文双编码
engine = create_engine(DATABASE_URL, pool_size=5, pool_recycle=1800,
                       pool_pre_ping=True, pool_timeout=10,
                       connect_args={"charset": "utf8mb4", "connect_timeout": 10})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class Jobseeker(Base):
    __tablename__ = 'jobseekers'
    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(200), unique=True, nullable=True)
    phone = Column(String(50), unique=True, nullable=True)
    username = Column(String(100), default='')
    password = Column(String(200), nullable=False)
    avatar = Column(String(500), default='')
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    # 个人信息字段
    real_name = Column(String(100), default='')
    gender = Column(String(10), default='')
    age = Column(Integer, nullable=True)
    education = Column(String(50), default='')
    school = Column(String(200), default='')
    city = Column(String(100), default='')
    target_city = Column(String(100), default='')
    expected_salary = Column(String(50), default='')
    target_position = Column(String(200), default='')
    experience = Column(String(100), default='')
    skills = Column(String(500), default='')
    bio = Column(String(500), default='')
    projects = Column(String(2000), default='[]')

class Enterprise(Base):
    __tablename__ = 'enterprises'
    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(200), unique=True, nullable=True)
    phone = Column(String(50), unique=True, nullable=True)
    username = Column(String(100), default='')
    password = Column(String(200), nullable=False)
    avatar = Column(String(500), default='')
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    # 企业字段
    company_name = Column(String(200), default='')
    industry = Column(String(100), default='')
    company_size = Column(String(50), default='')
    company_desc = Column(String(1000), default='')
    company_website = Column(String(500), default='')
    company_logo = Column(String(500), default='')
    company_benefits = Column(String(500), default='')
    verified = Column(Integer, default=0)
    city = Column(String(100), default='')

class Admin(Base):
    """管理员账号表 — 支撑管理员端登录与质检 API 鉴权"""
    __tablename__ = 'admins'
    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(200), unique=True, nullable=False)         # 登录用邮箱
    username = Column(String(100), default='')                       # 显示名
    password = Column(String(200), nullable=False)                   # bcrypt 加密
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class ReviewTask(Base):
    """管理员人工审核任务表 — AI 生成内容(new_job / skill_change)review gate

    与 SQL 字段对照见 backend/sql/review_tasks.sql。
    - target_id 存 Neo4j 节点 id(:Job.id 或 :ChangeEvent.change_id),字符串
    - content_snapshot / modified_content 都是 JSON,Model 上用 JSON 列存 dict
    """
    __tablename__ = 'review_tasks'
    id = Column(Integer, primary_key=True, autoincrement=True)
    task_type = Column(String(20), nullable=False)               # new_job | skill_change
    target_id = Column(String(64), nullable=False)               # Neo4j 节点 id
    target_kind = Column(String(20), nullable=False)             # Job | ChangeEvent
    content_snapshot = Column(JSON, nullable=False)
    modified_content = Column(JSON)
    status = Column(String(20), default='pending')               # pending|approved|rejected|modified
    reviewer_id = Column(Integer)
    review_comment = Column(Text)
    created_at = Column(DateTime, default=func.now())
    reviewed_at = Column(DateTime)

class VerifyCode(Base):
    __tablename__ = 'verify_codes'
    id = Column(Integer, primary_key=True, autoincrement=True)
    target = Column(String(200), nullable=False)
    code = Column(String(10), nullable=False)
    created_at = Column(DateTime, default=func.now())

class Job(Base):
    """企业发布的岗位表 — 支撑企业端岗位管理、人才星岗位下拉、仪表盘

    注意：表名用 enterprise_jobs（不是 jobs），避免和同事部署的
    爬虫整合表 `jobs`（含 data_type/source/crawl_time 等字段）冲突。
    求职者端浏览市场岗位走 jobs 表（爬虫数据），企业端发布岗位走本表。
    """
    __tablename__ = 'enterprise_jobs'
    id = Column(Integer, primary_key=True, autoincrement=True)
    enterprise_id = Column(Integer, nullable=False)          # 关联 enterprises.id，谁发布的
    title = Column(String(200), nullable=False)               # 岗位名称，如"AI应用开发工程师"
    description = Column(String(2000), default='')           # 岗位描述
    location = Column(String(100), default='')               # 工作城市
    salary_min = Column(Integer, nullable=True)              # 薪资下限（K 为单位）
    salary_max = Column(Integer, nullable=True)               # 薪资上限（K 为单位）
    salary_range = Column(String(50), default='')            # 展示用字符串，如"30K-50K"
    education = Column(String(50), default='')               # 学历要求
    experience = Column(String(100), default='')             # 经验要求，如"3-5年"
    skills_required = Column(String(500), default='')        # 要求技能（逗号分隔）
    status = Column(String(20), default='active')            # active/closed/draft
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class CrawledJob(Base):
    """爬虫整合主表 — 求职者端浏览市场岗位/文章的核心数据源

    表结构按 docs/字段汇总.md 设计，由同事部署的爬虫服务写入。
    data_type=1 表示岗位，data_type=2 表示文章。
    与 enterprise_jobs 区别：
      - jobs（本表）= 爬虫采集的真实市场岗位/文章，求职者端浏览用
      - enterprise_jobs = 企业端自己发布的岗位，企业端管理用
    """
    __tablename__ = 'jobs'
    id = Column(Integer, primary_key=True, autoincrement=True)
    data_type = Column(TINYINT, nullable=False, default=1)    # 1=岗位, 2=文章
    source = Column(String(50))                               # 数据来源（Boss/拉勾/CSDN 等）
    source_url = Column(String(500))                          # 原始数据链接
    title = Column(String(300), index=True)                   # 标题（岗位名/文章标题）
    skill_tags = Column(JSON)                                 # 技能标签（JSON 数组）
    technology_field = Column(String(100))                    # 技术领域
    company_name = Column(String(200), index=True)            # 公司名称（文章为 NULL）
    city = Column(String(100), index=True)                    # 工作城市
    area = Column(String(100))                                # 工作地区
    salary_min = Column(Integer)                              # 最低月薪（元）
    salary_max = Column(Integer)                              # 最高月薪（元）
    salary_months = Column(Integer)                           # 薪资发放月数
    education = Column(String(50))                            # 学历要求
    experience = Column(String(50))                           # 工作经验要求
    job_type = Column(String(50))                             # 工作类型（全职/实习等）
    company_type = Column(String(100))                        # 企业性质
    job_description = Column(LONGTEXT)                        # 岗位描述
    author = Column(String(100))                              # 作者（文章用）
    summary = Column(Text)                                    # 文章摘要
    article_type = Column(String(50))                         # 文章类型
    quality_score = Column(DECIMAL(5, 2))                     # 内容质量评分
    hot_score = Column(DECIMAL(8, 2))                         # 综合热度评分
    trend_score = Column(DECIMAL(8, 2))                       # 趋势评分
    view_count = Column(Integer, default=0)                   # 阅读量
    like_count = Column(Integer, default=0)                   # 点赞量
    collect_count = Column(Integer, default=0)                # 收藏量
    comment_count = Column(Integer, default=0)                # 评论量
    publish_time = Column(DateTime)                           # 信息发布时间
    crawl_time = Column(DateTime)                             # 数据采集时间
    update_time = Column(DateTime)                            # 数据更新时间

class SkillResource(Base):
    """技能学习资源表 — 管理后台维护，求职端学习中心展示"""
    __tablename__ = 'skill_resources'
    id = Column(Integer, primary_key=True, autoincrement=True)
    skill_name = Column(String(100), nullable=False, index=True)       # 技能名称，如"Python"
    resource_type = Column(String(20), default='文档')                  # 类型：文档/教程/视频/课程/搜索
    title = Column(String(300), nullable=False)                         # 资源标题
    url = Column(String(500), nullable=False)                           # 资源链接
    sort_order = Column(Integer, default=0)                             # 排序权重（越小越靠前）
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


# LlmConfig 使用「方式B」（手动建表），不参与 Base.metadata.create_all 自动建表。
# 表结构见 backend/sql/llm_configs.sql，需在 Navicat 手动执行创建（与 diagnosis_history 等一致）。
# 变更任何字段时，同步更新 backend/sql/llm_configs.sql 并在此模型 + 字段说明处保持一致。
LlmConfigBase = declarative_base()

class LlmConfig(LlmConfigBase):
    """模型配置表 — 管理员端「模型配置」页面维护，LLM 路由层读取

    配置项（config_key）：
        global_enabled        总开关（1/0）
        mock_mode             Mock 模式（1=开发期假数据，0=真实调用）
        provider              全局 Provider 组合描述（如 deepseek+qwen，仅展示）
        strong_provider       大模型 Provider 名（deepseek/openai-compatible/...）
        strong_model          大模型名（如 deepseek-chat）
        strong_base_url       大模型 API 地址
        strong_api_key        大模型 API Key
        fast_provider         小模型 Provider 名
        fast_model            小模型名（如 qwen-turbo）
        fast_base_url         小模型 API 地址
        fast_api_key          小模型 API Key
        vision_provider       多模态 Provider 名（预留）
        vision_model          多模态模型名（预留）
        vision_base_url       多模态 API 地址（预留）
        vision_api_key        多模态 API Key（预留）

    读取优先级：llm_configs 表 → .env（兼容 DEEPSEEK_API_KEY 等）→ 代码默认值

    字段说明：
        id            自增主键
        config_key    配置项名（唯一，如 strong_model）
        config_value  配置值（模型名 / API Key / 开关值等）
        updated_at    更新时间（保存时自动刷新）
    """
    __tablename__ = 'llm_configs'
    id = Column(Integer, primary_key=True, autoincrement=True)
    config_key = Column(String(50), unique=True, nullable=False)       # 配置项名
    config_value = Column(String(500), nullable=False)                 # 配置值
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


# ─── AI 简历中心（方式B手动建表，建表 SQL 见 backend/sql/resume.sql）─────────
ResumeBase = declarative_base()

class ResumeTemplate(ResumeBase):
    """简历模板表 — 管理员端「简历模板管理」页面维护

    字段说明：
        id          自增主键
        name        模板显示名（如「经典」）
        template_key 模板英文 key（对应前端 components/resume/preview/templates/<key>.tsx，唯一）
        category    分类（经典/现代/极简/创意等）
        thumbnail   预览图 URL（管理员上传）
        sort_order  排序权重（越小越靠前）
        is_active   上下架（1=上架，0=下架）
        created_at  创建时间
        updated_at  更新时间
    """
    __tablename__ = 'resume_templates'
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    template_key = Column(String(50), unique=True, nullable=False)
    category = Column(String(50), default='通用')
    thumbnail = Column(String(500), default='')
    sort_order = Column(Integer, default=0)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class Resume(ResumeBase):
    """简历主表 — 求职者创建的简历

    字段说明：
        id           自增主键
        user_id      所属求职者（关联 jobseekers.id）
        title        简历标题（如「AI应用开发工程师 - AI生成简历」）
        template_key 使用的模板 key
        language     语言（zh/en）
        created_at   创建时间
        updated_at   更新时间
    """
    __tablename__ = 'resumes'
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    title = Column(String(200), default='未命名简历')
    template_key = Column(String(50), default='classic')
    language = Column(String(10), default='zh')
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class ResumeSection(ResumeBase):
    """简历区块表 — 每份简历的 6 大区块内容（content 存 JSON）

    字段说明：
        id           自增主键
        resume_id    关联 resumes.id
        section_type 区块类型：personal_info/summary/work_experience/education/skills/projects
        title        区块中文标题（如「工作经历」）
        content      结构化内容（JSON）
        sort_order   排序权重
        visible      是否可见（1/0）
    """
    __tablename__ = 'resume_sections'
    id = Column(Integer, primary_key=True, autoincrement=True)
    resume_id = Column(Integer, nullable=False, index=True)
    section_type = Column(String(50), nullable=False)
    title = Column(String(100), nullable=False)
    content = Column(JSON)
    sort_order = Column(Integer, default=0)
    visible = Column(Integer, default=1)


class ResumeShare(ResumeBase):
    """简历分享表 — 生成分享链接 + 二维码

    字段说明：
        id          自增主键
        resume_id   关联 resumes.id
        token       随机 token（URL 用，唯一）
        expire_at   过期时间（NULL=永久有效）
        visit_count 访问次数
        created_at  创建时间
    """
    __tablename__ = 'resume_shares'
    id = Column(Integer, primary_key=True, autoincrement=True)
    resume_id = Column(Integer, nullable=False, index=True)
    token = Column(String(64), unique=True, nullable=False)
    expire_at = Column(DateTime, nullable=True)
    visit_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=func.now())


class MatchRecord(Base):
    """人岗匹配记录表 — 人才星核心数据源，岗位↔候选人匹配结果

    五维度评分体系（2026-08 升级）:
        技能(skill) + 经验(exp) + 学历(edu) + 地域(location) + 薪资(salary)
    旧的三维度字段保留兼容，新增 edu_match / location_match 两列。
    """
    __tablename__ = 'match_records'
    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(Integer, nullable=False)                  # 关联 enterprise_jobs.id
    jobseeker_id = Column(Integer, nullable=False)            # 关联 jobseekers.id
    # 匹配度（0-100）。来源为匹配引擎；未计算时为 NULL，前端应标注"暂无匹配数据"
    match_score = Column(Integer, nullable=True)
    skill_match = Column(Integer, nullable=True)              # 技能匹配度（维度1）
    exp_match = Column(Integer, nullable=True)                # 经验匹配度（维度2）
    salary_match = Column(Integer, nullable=True)             # 薪资匹配度（维度3）
    edu_match = Column(Integer, nullable=True)                # 学历匹配度（维度4 — 新增）
    location_match = Column(Integer, nullable=True)           # 地域匹配度（维度5 — 新增）
    status = Column(String(20), default='pending')            # pending/accepted/rejected
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class Message(Base):
    """沟通消息表 — 企业端"发起沟通"后的对话记录

    企业 HR 与求职者之间的一对一聊天消息。
    关联 match_records 确定沟通上下文（岗位+候选人）。
    """
    __tablename__ = 'messages'
    id = Column(Integer, primary_key=True, autoincrement=True)
    match_record_id = Column(Integer, nullable=False, index=True)  # 关联 match_records.id
    sender_type = Column(String(20), nullable=False)               # 'enterprise' 或 'jobseeker'
    sender_id = Column(Integer, nullable=False)                    # 发送者 ID
    content = Column(String(2000), nullable=False)                 # 消息内容
    is_read = Column(Integer, default=0)                           # 0=未读, 1=已读
    created_at = Column(DateTime, default=func.now())

def init_db():
    # create_all 已自带 checkfirst,但多表 FK 顺序可能与已有表冲突导致 1050
    # 失败时不阻塞启动 — 真正缺表由运维补 DDL
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:  # noqa: BLE001
        print(f'[WARN] init_db 失败(可能表已存在),继续启动: {e}')

def get_session():
    return SessionLocal()

def create_user(email, phone, password, role, username=''):
    import bcrypt
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    session = get_session()
    try:
        if role == 'enterprise':
            user = Enterprise(
                email=email, phone=phone,
                username=username or (email or phone or '').split('@')[0],
                password=hashed
            )
        else:
            user = Jobseeker(
                email=email, phone=phone,
                username=username or (email or phone or '').split('@')[0],
                password=hashed
            )
        session.add(user); session.commit()
        return {'id': user.id, 'email': user.email, 'phone': user.phone,
                'username': user.username, 'role': role}
    except Exception as e:
        session.rollback()
        if 'Duplicate' in str(e): raise ValueError('邮箱或手机号已注册')
        raise
    finally:
        session.close()

def get_user_by_login(login):
    session = get_session()
    try:
        user = session.query(Jobseeker).filter(
            (Jobseeker.email == login) | (Jobseeker.phone == login)
        ).first()
        if user:
            return dict(id=user.id, email=user.email, phone=user.phone,
                        username=user.username, password=user.password, role='jobseeker')
        user = session.query(Enterprise).filter(
            (Enterprise.email == login) | (Enterprise.phone == login)
        ).first()
        if user:
            return dict(id=user.id, email=user.email, phone=user.phone,
                        username=user.username, password=user.password, role='enterprise')
        # 管理员只允许邮箱登录，无手机号字段
        user = session.query(Admin).filter(Admin.email == login).first()
        if user:
            return dict(id=user.id, email=user.email, phone=None,
                        username=user.username or '管理员', password=user.password, role='admin')
        return None
    finally:
        session.close()

def get_user_model_by_role(role):
    """根据 role 返回对应的模型类"""
    if role == 'enterprise':
        return Enterprise
    return Jobseeker

import jwt

JWT_SECRET = os.getenv('JWT_SECRET', '')
JWT_ALGO = 'HS256'

def _validate_jwt_secret():
    """生产环境强制要求 32+ 字节密钥

    启动时检查：
    - 如果 JWT_SECRET 为空或短于 32 字节，抛出 RuntimeError
    - 确保 HS256 算法的最低安全强度（RFC 7518 §3.2）
    """
    if len(JWT_SECRET) < 32:
        raise RuntimeError(
            f'JWT_SECRET 必须至少 32 字节（当前 {len(JWT_SECRET)} 字节）。'
            f'请设置环境变量：export JWT_SECRET=<至少32字符的随机字符串>'
        )

_validate_jwt_secret()

def create_token(user_id, role):
    return jwt.encode({
        'user_id': user_id, 'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(days=7),
        'iat': datetime.now(timezone.utc),
        'jti': str(uuid.uuid4())
    }, JWT_SECRET, algorithm=JWT_ALGO)

def verify_token(token):
    try: return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError: raise ValueError('登录已过期')
    except jwt.InvalidTokenError: raise ValueError('无效的登录凭证')


# ────────────────────────────────────────────────────────────────
# Neo4j 知识图谱驱动（岗位为主体）
# ────────────────────────────────────────────────────────────────
_NEO4J_DRIVER = None

def get_neo4j_uri() -> str:
    return os.getenv('NEO4J_URI', 'bolt://localhost:7687')

def get_neo4j_auth() -> tuple:
    return (
        os.getenv('NEO4J_USER', 'neo4j'),
        os.getenv('NEO4J_PASSWORD', 'Xingtu123'),
    )

def get_neo4j_database() -> str:
    return os.getenv('NEO4J_DATABASE', 'neo4j')


def get_neo4j_driver():
    """同步 Bolt 驱动。脚本和阻塞调用使用。"""
    global _NEO4J_DRIVER
    if _NEO4J_DRIVER is None:
        from neo4j import GraphDatabase
        _NEO4J_DRIVER = GraphDatabase.driver(
            get_neo4j_uri(),
            auth=get_neo4j_auth(),
            max_connection_lifetime=3600,
        )
    return _NEO4J_DRIVER


def close_neo4j():
    global _NEO4J_DRIVER
    if _NEO4J_DRIVER is not None:
        _NEO4J_DRIVER.close()
        _NEO4J_DRIVER = None


# ────────────────────────────────────────────────────────────────
# LangChain LLM / Embeddings 单例（按需懒加载）
# ────────────────────────────────────────────────────────────────
_LLM_STRONG = None
_LLM_FAST = None
_OPENAI_EMBED = None


def get_llm_strong():
    """强档 LLM（归因 / Reporter / 决策建议）。优先 DeepSeek，fallback OpenAI。"""
    global _LLM_STRONG
    if _LLM_STRONG is None:
        from langchain_openai import ChatOpenAI
        api_key = os.getenv('DEEPSEEK_API_KEY') or os.getenv('OPENAI_API_KEY')
        base_url = os.getenv('DEEPSEEK_BASE_URL') or os.getenv('OPENAI_BASE_URL')
        model = os.getenv('DEEPSEEK_MODEL', 'deepseek-chat')
        if not api_key or api_key.startswith('你的'):
            raise RuntimeError('LLM 未配置：请在 .env 设置 DEEPSEEK_API_KEY 或 OPENAI_API_KEY')
        _LLM_STRONG = ChatOpenAI(
            model=model,
            api_key=api_key,
            base_url=base_url,
            temperature=0.3,
            streaming=True,
        )
    return _LLM_STRONG


def get_llm_fast():
    """快档 LLM（clarifier / task decomposer 等短推理）。"""
    global _LLM_FAST
    if _LLM_FAST is None:
        from langchain_openai import ChatOpenAI
        api_key = os.getenv('DEEPSEEK_API_KEY') or os.getenv('OPENAI_API_KEY')
        base_url = os.getenv('DEEPSEEK_BASE_URL') or os.getenv('OPENAI_BASE_URL')
        model = os.getenv('DEEPSEEK_MODEL', 'deepseek-chat')
        if not api_key or api_key.startswith('你的'):
            raise RuntimeError('LLM 未配置：请在 .env 设置 DEEPSEEK_API_KEY 或 OPENAI_API_KEY')
        _LLM_FAST = ChatOpenAI(
            model=model,
            api_key=api_key,
            base_url=base_url,
            temperature=0.0,
            streaming=False,
        )
    return _LLM_FAST


def get_openai_embeddings():
    """OpenAI text-embedding-3-small 1536 维。"""
    global _OPENAI_EMBED
    if _OPENAI_EMBED is None:
        from langchain_openai import OpenAIEmbeddings
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key or api_key.startswith('你的'):
            raise RuntimeError('Embedding 未配置：请在 .env 设置 OPENAI_API_KEY')
        _OPENAI_EMBED = OpenAIEmbeddings(
            model=os.getenv('OPENAI_EMBED_MODEL', 'text-embedding-3-small'),
            api_key=api_key,
            base_url=os.getenv('OPENAI_BASE_URL'),
            dimensions=1536,
        )
    return _OPENAI_EMBED
