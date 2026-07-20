"""
管理员账号播种脚本 — 为 admins 表初始化一个默认管理员账号

用法:
    cd backend && python -m mock_data.seed_admin
    docker exec xingtu-api python -m mock_data.seed_admin

特点:
    - 幂等：重复运行不会产生重复账号，已存在则更新密码
    - 默认账号: admin@xingtu.com / Admin1234
"""
import sys
import os

# 确保能导入 backend 根目录下的 database 模块
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import bcrypt
from database import Admin, get_session, init_db

DEFAULT_ADMIN = {
    'email': 'admin@xingtu.com',
    'username': '系统管理员',
    'password': 'Admin1234',  # 满足注册校验（8位+大小写+数字）
}


def seed_admin():
    """初始化默认管理员账号（幂等）"""
    # 确保表已创建
    init_db()
    session = get_session()
    try:
        # 查找是否已存在该邮箱的管理员
        admin = session.query(Admin).filter(Admin.email == DEFAULT_ADMIN['email']).first()
        hashed = bcrypt.hashpw(DEFAULT_ADMIN['password'].encode(), bcrypt.gensalt()).decode()

        if admin:
            # 已存在则更新密码和用户名（保证幂等）
            admin.password = hashed
            admin.username = DEFAULT_ADMIN['username']
            action = '已更新'
        else:
            # 新增管理员
            admin = Admin(
                email=DEFAULT_ADMIN['email'],
                username=DEFAULT_ADMIN['username'],
                password=hashed,
            )
            session.add(admin)
            action = '已创建'

        session.commit()
        print(f'[完成] 管理员账号 {action}:')
        print(f'  邮箱:   {DEFAULT_ADMIN["email"]}')
        print(f'  用户名: {DEFAULT_ADMIN["username"]}')
        print(f'  密码:   {DEFAULT_ADMIN["password"]}')
        print(f'\n  可登录管理员端 → /api/auth/admin/login')
    except Exception as e:
        session.rollback()
        print(f'[错误] 创建管理员失败: {e}')
        raise
    finally:
        session.close()


if __name__ == '__main__':
    seed_admin()
