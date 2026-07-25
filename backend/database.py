import os, uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine, Column, Integer, String, DateTime, func, Text, DECIMAL
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.dialects.mysql import JSON, LONGTEXT, TINYINT

DATABASE_URL = os.getenv('DATABASE_URL', 'mysql+pymysql://root:xingtu123@localhost:3307/xingtu')

engine = create_engine(DATABASE_URL, pool_size=5, pool_recycle=3600)
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

class MatchRecord(Base):
    """人岗匹配记录表 — 人才星核心数据源，岗位↔候选人匹配结果"""
    __tablename__ = 'match_records'
    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(Integer, nullable=False)                  # 关联 enterprise_jobs.id
    jobseeker_id = Column(Integer, nullable=False)            # 关联 jobseekers.id
    # 匹配度（0-100）。来源为匹配引擎；未计算时为 NULL，前端应标注"暂无匹配数据"
    match_score = Column(Integer, nullable=True)
    skill_match = Column(Integer, nullable=True)              # 技能匹配度（维度1）
    exp_match = Column(Integer, nullable=True)                # 经验匹配度（维度2）
    salary_match = Column(Integer, nullable=True)             # 薪资匹配度（维度3）
    status = Column(String(20), default='pending')            # pending/accepted/rejected
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

def init_db():
    Base.metadata.create_all(bind=engine)

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
    user = session.query(Jobseeker).filter(
        (Jobseeker.email == login) | (Jobseeker.phone == login)
    ).first()
    if user:
        result = dict(id=user.id, email=user.email, phone=user.phone,
                      username=user.username, password=user.password, role='jobseeker')
        session.close()
        return result
    user = session.query(Enterprise).filter(
        (Enterprise.email == login) | (Enterprise.phone == login)
    ).first()
    if user:
        result = dict(id=user.id, email=user.email, phone=user.phone,
                      username=user.username, password=user.password, role='enterprise')
        session.close()
        return result
    # 管理员只允许邮箱登录，无手机号字段
    user = session.query(Admin).filter(Admin.email == login).first()
    if user:
        result = dict(id=user.id, email=user.email, phone=None,
                      username=user.username or '管理员', password=user.password, role='admin')
        session.close()
        return result
    session.close()
    return None

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
