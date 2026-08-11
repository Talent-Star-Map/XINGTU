"""
学习资源迁移脚本：创建 skill_resources 表并导入初始数据

用法：cd backend && python migrate_resources.py

从 DATABASE_URL 环境变量读取数据库连接配置（与后端一致）。
"""

import os
from urllib.parse import urlparse
from dotenv import load_dotenv
import pymysql

load_dotenv()

# 从 DATABASE_URL 解析连接配置
_db_url = os.getenv('DATABASE_URL', 'mysql+pymysql://root:xingtu123@localhost:3307/xingtu')
_parsed = urlparse(_db_url)
_db_user = _parsed.username or 'root'
_db_pass = _parsed.password or ''
_db_host = _parsed.hostname or 'localhost'
_db_port = _parsed.port or 3307
_db_name = _parsed.path.lstrip('/') or 'xingtu'

DB_CONFIG = {
    'host': _db_host,
    'port': _db_port,
    'user': _db_user,
    'password': _db_pass,
    'database': _db_name,
    'charset': 'utf8mb4',
}

# 建表 SQL
CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS skill_resources (
    id INT AUTO_INCREMENT PRIMARY KEY,
    skill_name VARCHAR(100) NOT NULL,
    resource_type VARCHAR(20) DEFAULT '文档',
    title VARCHAR(300) NOT NULL,
    url VARCHAR(500) NOT NULL,
    sort_order INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_skill_name (skill_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"""

# 初始数据：从 learning_path.py 迁移
INITIAL_DATA = [
    ("Python", "教程", "菜鸟教程 Python3", "https://www.runoob.com/python3/", 1),
    ("Python", "教程", "廖雪峰 Python 教程", "https://liaoxuefeng.com/books/python/", 2),
    ("Python", "视频", "【黑马程序员】Python入门到精通", "https://www.bilibili.com/video/BV1qW411N7FU", 3),
    ("Python", "文档", "Python官方文档", "https://docs.python.org/zh-cn/3/", 4),

    ("Java", "教程", "菜鸟教程 Java", "https://www.runoob.com/java/", 1),
    ("Java", "视频", "【黑马程序员】Java入门教程", "https://www.bilibili.com/video/BV1qW411N7FU", 2),
    ("Java", "视频", "【尚硅谷】Java零基础教程", "https://www.bilibili.com/video/BV1Kb411W75N", 3),
    ("Java", "文档", "Java官方文档", "https://docs.oracle.com/en/java/", 4),

    ("C++", "教程", "菜鸟教程 C++", "https://www.runoob.com/cplusplus/", 1),
    ("C++", "文档", "C++ Reference", "https://en.cppreference.com/", 2),
    ("C++", "视频", "【黑马程序员】C++教程", "https://www.bilibili.com/video/BV1et411b73Z", 3),

    ("JavaScript", "文档", "MDN JavaScript", "https://developer.mozilla.org/zh-CN/docs/Web/JavaScript", 1),
    ("JavaScript", "教程", "现代 JavaScript 教程", "https://zh.javascript.info/", 2),
    ("JavaScript", "视频", "【黑马程序员】JavaScript基础教程", "https://www.bilibili.com/video/BV1Y84y1L7Nn", 3),

    ("TypeScript", "文档", "TypeScript 官方文档", "https://www.typescriptlang.org/zh/docs/", 1),
    ("TypeScript", "教程", "TypeScript 入门教程", "https://ts.xcatliu.com/", 2),
    ("TypeScript", "视频", "【黑马程序员】TypeScript入门", "https://www.bilibili.com/video/BV1XY411G7Z2", 3),

    ("Vue", "文档", "Vue.js 官方文档", "https://cn.vuejs.org/guide/", 1),
    ("Vue", "课程", "Vue Mastery", "https://www.vuemastery.com/", 2),
    ("Vue", "视频", "【黑马程序员】Vue3入门到实战", "https://www.bilibili.com/video/BV1Za4y1r7KE", 3),

    ("React", "文档", "React 官方文档", "https://zh-hans.react.dev/", 1),
    ("React", "教程", "React 入门教程", "https://react-tutorial.app/", 2),
    ("React", "视频", "【黑马程序员】React18入门到实战", "https://www.bilibili.com/video/BV1FN4y1G7wY", 3),

    ("Node.js", "文档", "Node.js 官方文档", "https://nodejs.org/zh-cn/docs/", 1),
    ("Node.js", "教程", "菜鸟教程 Node.js", "https://www.runoob.com/nodejs/", 2),
    ("Node.js", "视频", "【黑马程序员】Node.js入门教程", "https://www.bilibili.com/video/BV1a34y16735", 3),

    ("机器学习", "课程", "吴恩达机器学习", "https://www.coursera.org/learn/machine-learning", 1),
    ("机器学习", "文档", "sklearn 官方文档", "https://scikit-learn.org/stable/", 2),
    ("机器学习", "视频", "【吴恩达】机器学习中文版", "https://www.bilibili.com/video/BV1Pa411X76s", 3),

    ("深度学习", "教程", "PyTorch 官方教程", "https://pytorch.org/tutorials/", 1),
    ("深度学习", "教程", "动手学深度学习", "https://zh.d2l.ai/", 2),
    ("深度学习", "视频", "【李沐】动手学深度学习", "https://www.bilibili.com/video/BV1FT4y1E74V", 3),

    ("数据分析", "课程", "Kaggle 学习", "https://www.kaggle.com/learn", 1),
    ("数据分析", "文档", "Pandas 官方文档", "https://pandas.pydata.org/docs/", 2),
    ("数据分析", "视频", "【黑马程序员】Python数据分析教程", "https://www.bilibili.com/video/BV1QH4y1G7pY", 3),

    ("MySQL", "文档", "MySQL 官方文档", "https://dev.mysql.com/doc/", 1),
    ("MySQL", "教程", "菜鸟教程 MySQL", "https://www.runoob.com/mysql/", 2),
    ("MySQL", "视频", "【黑马程序员】MySQL入门教程", "https://www.bilibili.com/video/BV1iq4y1K7FG", 3),

    ("Redis", "文档", "Redis 官方文档", "https://redis.io/docs/", 1),
    ("Redis", "教程", "Redis 入门", "https://www.runoob.com/redis/", 2),
    ("Redis", "视频", "【黑马程序员】Redis入门到实战", "https://www.bilibili.com/video/BV1Rv4y1s7Br", 3),

    ("Docker", "文档", "Docker 官方文档", "https://docs.docker.com/", 1),
    ("Docker", "教程", "Docker 入门教程", "https://vuepress.mirror.docker-practice.com/", 2),
    ("Docker", "视频", "【黑马程序员】Docker入门教程", "https://www.bilibili.com/video/BV1gr4y1m73F", 3),

    ("Git", "教程", "Progit 中文版", "https://progit2.com/", 1),
    ("Git", "文档", "Git 官方文档", "https://git-scm.com/doc", 2),
    ("Git", "视频", "【黑马程序员】Git入门教程", "https://www.bilibili.com/video/BV1QE4y1N7Gq", 3),

    ("FastAPI", "文档", "FastAPI 官方文档", "https://fastapi.tiangolo.com/zh/", 1),
    ("FastAPI", "教程", "FastAPI 教程", "https://github.com/tiangolo/fastapi", 2),
    ("FastAPI", "视频", "【黑马程序员】FastAPI入门教程", "https://www.bilibili.com/video/BV1Np4y1z7BS", 3),

    ("Flask", "文档", "Flask 官方文档", "https://flask.palletsprojects.com/", 1),
    ("Flask", "视频", "【黑马程序员】Flask入门教程", "https://www.bilibili.com/video/BV1xY4y1r7RQ", 2),

    ("Spring Boot", "文档", "Spring Boot 官方文档", "https://spring.io/projects/spring-boot", 1),
    ("Spring Boot", "视频", "【黑马程序员】SpringBoot入门到实战", "https://www.bilibili.com/video/BV1Ky4y1C7Vn", 2),
    ("Spring Boot", "视频", "【尚硅谷】SpringBoot教程", "https://www.bilibili.com/video/BV19K4y1L7MT", 3),

    ("Spring Cloud", "文档", "Spring Cloud 官方文档", "https://spring.io/projects/spring-cloud", 1),
    ("Spring Cloud", "视频", "【黑马程序员】SpringCloud入门到实战", "https://www.bilibili.com/video/BV1RT4y1G7Wq", 2),

    ("SSM", "视频", "【黑马程序员】SSM框架教程", "https://www.bilibili.com/video/BV1Ky4y1C7Vn", 1),
    ("SSM", "文档", "Spring 官方文档", "https://spring.io/projects/spring", 2),
    ("SSM", "文档", "MyBatis 官方文档", "https://mybatis.org/mybatis-3/zh/index.html", 3),

    ("SSM+Vue", "视频", "【黑马程序员】SSM+Vue全栈开发", "https://www.bilibili.com/video/BV1Ky4y1C7Vn", 1),
    ("SSM+Vue", "文档", "Spring 官方文档", "https://spring.io/projects/spring", 2),
    ("SSM+Vue", "文档", "Vue.js 官方文档", "https://cn.vuejs.org/guide/", 3),

    ("Linux", "教程", "Linux 教程", "https://www.runoob.com/linux/", 1),
    ("Linux", "教程", "鸟哥的 Linux 私房菜", "https://linux.vbird.org/", 2),
    ("Linux", "视频", "【黑马程序员】Linux入门教程", "https://www.bilibili.com/video/BV1FT4y1E74V", 3),

    ("Hadoop", "文档", "Hadoop 官方文档", "https://hadoop.apache.org/docs/", 1),
    ("Hadoop", "视频", "【尚硅谷】Hadoop入门教程", "https://www.bilibili.com/video/BV1Kt4y1d7BS", 2),

    ("Spark", "文档", "Spark 官方文档", "https://spark.apache.org/docs/latest/", 1),
    ("Spark", "视频", "【黑马程序员】Spark入门教程", "https://www.bilibili.com/video/BV1Rv4y1s7Br", 2),

    ("HTML", "文档", "MDN HTML", "https://developer.mozilla.org/zh-CN/docs/Web/HTML", 1),
    ("HTML", "视频", "【黑马程序员】HTML入门教程", "https://www.bilibili.com/video/BV1Y84y1L7Nn", 2),

    ("CSS", "文档", "MDN CSS", "https://developer.mozilla.org/zh-CN/docs/Web/CSS", 1),
    ("CSS", "视频", "【黑马程序员】CSS入门教程", "https://www.bilibili.com/video/BV1Kt4y1d7BS", 2),

    ("TensorFlow", "教程", "TensorFlow 官方教程", "https://www.tensorflow.org/tutorials", 1),
    ("TensorFlow", "视频", "【官方】TensorFlow入门教程", "https://www.bilibili.com/video/BV1FT4y1E74V", 2),

    ("PyTorch", "教程", "PyTorch 官方教程", "https://pytorch.org/tutorials/", 1),
    ("PyTorch", "视频", "【李沐】PyTorch入门到实战", "https://www.bilibili.com/video/BV1FT4y1E74V", 2),

    ("SQL", "教程", "SQL 教程", "https://www.runoob.com/sql/", 1),
    ("SQL", "视频", "【黑马程序员】MySQL之SQL入门教程", "https://www.bilibili.com/video/BV1iq4y1K7FG", 2),

    ("NoSQL", "文档", "MongoDB 官方文档", "https://www.mongodb.com/docs/", 1),
    ("NoSQL", "视频", "【黑马程序员】MongoDB入门教程", "https://www.bilibili.com/video/BV1a34y16735", 2),

    ("RabbitMQ", "文档", "RabbitMQ 官方文档", "https://www.rabbitmq.com/documentation.html", 1),
    ("RabbitMQ", "视频", "【黑马程序员】RabbitMQ入门教程", "https://www.bilibili.com/video/BV1RT4y1G7Wq", 2),

    ("Nginx", "文档", "Nginx 官方文档", "https://nginx.org/en/docs/", 1),
    ("Nginx", "视频", "【黑马程序员】Nginx入门教程", "https://www.bilibili.com/video/BV1gr4y1m73F", 2),

    ("Kubernetes", "文档", "Kubernetes 官方文档", "https://kubernetes.io/zh-cn/docs/", 1),
    ("Kubernetes", "视频", "【黑马程序员】K8s入门教程", "https://www.bilibili.com/video/BV1gr4y1m73F", 2),
]

INSERT_SQL = """
INSERT INTO skill_resources (skill_name, resource_type, title, url, sort_order)
VALUES (%s, %s, %s, %s, %s)
"""


def main():
    print("连接数据库...")
    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor()

    print("创建 skill_resources 表（如不存在）...")
    cursor.execute(CREATE_TABLE_SQL)
    conn.commit()

    # 检查是否已有数据
    cursor.execute("SELECT COUNT(*) FROM skill_resources")
    count = cursor.fetchone()[0]
    if count > 0:
        print(f"表中已有 {count} 条数据，跳过导入。如需重新导入，请先清空表：")
        print("  TRUNCATE TABLE skill_resources;")
        conn.close()
        return

    print(f"导入 {len(INITIAL_DATA)} 条学习资源...")
    cursor.executemany(INSERT_SQL, INITIAL_DATA)
    conn.commit()

    # 验证
    cursor.execute("SELECT COUNT(DISTINCT skill_name) FROM skill_resources")
    skill_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM skill_resources")
    total = cursor.fetchone()[0]
    print(f"导入完成！共 {skill_count} 个技能，{total} 条资源。")

    conn.close()


if __name__ == '__main__':
    main()
