import os, uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine, Column, Integer, String, DateTime, func
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv('DATABASE_URL', 'mysql+pymysql://root:xingtu123@localhost:3307/xingtu')

engine = create_engine(DATABASE_URL, pool_size=5, pool_recycle=3600)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(200), unique=True, nullable=True)
    phone = Column(String(50), unique=True, nullable=True)
    username = Column(String(100), default='')
    password = Column(String(200), nullable=False)
    role = Column(String(20), nullable=False, default='jobseeker')
    avatar = Column(String(500), default='')
    # ─── 个人信息字段 ───
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
    skills = Column(String(500), default='')  # 逗号分隔
    bio = Column(String(500), default='')
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class VerifyCode(Base):
    __tablename__ = 'verify_codes'
    id = Column(Integer, primary_key=True, autoincrement=True)
    target = Column(String(200), nullable=False)
    code = Column(String(10), nullable=False)
    created_at = Column(DateTime, default=func.now())

def init_db():
    Base.metadata.create_all(bind=engine)

def get_session():
    return SessionLocal()

def create_user(email, phone, password, role, username=''):
    import bcrypt
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    session = get_session()
    try:
        user = User(email=email, phone=phone, username=username or (email or phone or '').split('@')[0], password=hashed, role=role)
        session.add(user); session.commit()
        return {'id': user.id, 'email': user.email, 'phone': user.phone, 'username': user.username, 'role': user.role}
    except Exception as e:
        session.rollback()
        if 'Duplicate' in str(e): raise ValueError('邮箱或手机号已注册')
        raise
    finally:
        session.close()

def get_user_by_login(login):
    session = get_session()
    user = session.query(User).filter((User.email == login) | (User.phone == login)).first()
    session.close()
    if not user: return None
    return dict(id=user.id, email=user.email, phone=user.phone, username=user.username, password=user.password, role=user.role)

import jwt
JWT_SECRET = os.getenv('JWT_SECRET', 'xingtu-secret-key-2026')
JWT_ALGO = 'HS256'

def create_token(user_id, role):
    return jwt.encode({'user_id': user_id, 'role': role, 'exp': datetime.now(timezone.utc) + timedelta(days=7), 'iat': datetime.now(timezone.utc), 'jti': str(uuid.uuid4())}, JWT_SECRET, algorithm=JWT_ALGO)

def verify_token(token):
    try: return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError: raise ValueError('登录已过期')
    except jwt.InvalidTokenError: raise ValueError('无效的登录凭证')
