import os, uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine, Column, Integer, String, DateTime, func
from sqlalchemy.orm import declarative_base, sessionmaker

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

class VerifyCode(Base):
    __tablename__ = 'verify_codes'
    id = Column(Integer, primary_key=True, autoincrement=True)
    target = Column(String(200), nullable=False)
    code = Column(String(10), nullable=False)
    created_at = Column(DateTime, default=func.now())

class Job(Base):
    """企业发布的岗位表 — 支撑企业端岗位管理、人才星岗位下拉、仪表盘"""
    __tablename__ = 'jobs'
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

class MatchRecord(Base):
    """人岗匹配记录表 — 人才星核心数据源，岗位↔候选人匹配结果"""
    __tablename__ = 'match_records'
    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(Integer, nullable=False)                  # 关联 jobs.id
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
    session.close()
    return None

def get_user_model_by_role(role):
    """根据 role 返回对应的模型类"""
    if role == 'enterprise':
        return Enterprise
    return Jobseeker

import jwt
JWT_SECRET = os.getenv('JWT_SECRET', 'xingtu-secret-key-2026')
JWT_ALGO = 'HS256'

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
