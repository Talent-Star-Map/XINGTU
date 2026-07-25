"""
学习资源映射：技能 → 真实学习资源链接

@owner: 佳豪（求职端"我的"）
"""

SKILL_RESOURCES: dict[str, list[dict]] = {
    "Python": [
        {"name": "菜鸟教程 Python3", "url": "https://www.runoob.com/python3/", "type": "教程"},
        {"name": "廖雪峰 Python 教程", "url": "https://liaoxuefeng.com/books/python/", "type": "教程"},
    ],
    "Java": [
        {"name": "菜鸟教程 Java", "url": "https://www.runoob.com/java/", "type": "教程"},
        {"name": "黑马程序员 Java", "url": "https://www.itheima.com/", "type": "课程"},
    ],
    "C++": [
        {"name": "菜鸟教程 C++", "url": "https://www.runoob.com/cplusplus/", "type": "教程"},
        {"name": "C++ Reference", "url": "https://en.cppreference.com/", "type": "文档"},
    ],
    "JavaScript": [
        {"name": "MDN JavaScript", "url": "https://developer.mozilla.org/zh-CN/docs/Web/JavaScript", "type": "文档"},
        {"name": "现代 JavaScript 教程", "url": "https://zh.javascript.info/", "type": "教程"},
    ],
    "TypeScript": [
        {"name": "TypeScript 官方文档", "url": "https://www.typescriptlang.org/zh/docs/", "type": "文档"},
        {"name": "TypeScript 入门教程", "url": "https://ts.xcatliu.com/", "type": "教程"},
    ],
    "Vue": [
        {"name": "Vue.js 官方文档", "url": "https://cn.vuejs.org/guide/", "type": "文档"},
        {"name": "Vue Mastery", "url": "https://www.vuemastery.com/", "type": "课程"},
    ],
    "React": [
        {"name": "React 官方文档", "url": "https://zh-hans.react.dev/", "type": "文档"},
        {"name": "React 入门教程", "url": "https://react-tutorial.app/", "type": "教程"},
    ],
    "Node.js": [
        {"name": "Node.js 官方文档", "url": "https://nodejs.org/zh-cn/docs/", "type": "文档"},
        {"name": "菜鸟教程 Node.js", "url": "https://www.runoob.com/nodejs/", "type": "教程"},
    ],
    "机器学习": [
        {"name": "吴恩达机器学习", "url": "https://www.coursera.org/learn/machine-learning", "type": "课程"},
        {"name": "sklearn 官方文档", "url": "https://scikit-learn.org/stable/", "type": "文档"},
    ],
    "深度学习": [
        {"name": "PyTorch 官方教程", "url": "https://pytorch.org/tutorials/", "type": "教程"},
        {"name": "动手学深度学习", "url": "https://zh.d2l.ai/", "type": "教程"},
    ],
    "数据分析": [
        {"name": "Kaggle 学习", "url": "https://www.kaggle.com/learn", "type": "课程"},
        {"name": "Pandas 官方文档", "url": "https://pandas.pydata.org/docs/", "type": "文档"},
    ],
    "MySQL": [
        {"name": "MySQL 官方文档", "url": "https://dev.mysql.com/doc/", "type": "文档"},
        {"name": "菜鸟教程 MySQL", "url": "https://www.runoob.com/mysql/", "type": "教程"},
    ],
    "Redis": [
        {"name": "Redis 官方文档", "url": "https://redis.io/docs/", "type": "文档"},
        {"name": "Redis 入门", "url": "https://www.runoob.com/redis/", "type": "教程"},
    ],
    "Docker": [
        {"name": "Docker 官方文档", "url": "https://docs.docker.com/", "type": "文档"},
        {"name": "Docker 入门教程", "url": "https://vuepress.mirror.docker-practice.com/", "type": "教程"},
    ],
    "Git": [
        {"name": "Progit 中文版", "url": "https://progit2.com/", "type": "教程"},
        {"name": "Git 官方文档", "url": "https://git-scm.com/doc", "type": "文档"},
    ],
    "FastAPI": [
        {"name": "FastAPI 官方文档", "url": "https://fastapi.tiangolo.com/zh/", "type": "文档"},
        {"name": "FastAPI 教程", "url": "https://github.com/tiangolo/fastapi", "type": "教程"},
    ],
    "Flask": [
        {"name": "Flask 官方文档", "url": "https://flask.palletsprojects.com/", "type": "文档"},
    ],
    "Spring Boot": [
        {"name": "Spring Boot 官方文档", "url": "https://spring.io/projects/spring-boot", "type": "文档"},
    ],
    "Linux": [
        {"name": "Linux 教程", "url": "https://www.runoob.com/linux/", "type": "教程"},
        {"name": "鸟哥的 Linux 私房菜", "url": "https://linux.vbird.org/", "type": "教程"},
    ],
    "Hadoop": [
        {"name": "Hadoop 官方文档", "url": "https://hadoop.apache.org/docs/", "type": "文档"},
    ],
    "Spark": [
        {"name": "Spark 官方文档", "url": "https://spark.apache.org/docs/latest/", "type": "文档"},
    ],
    "HTML": [
        {"name": "MDN HTML", "url": "https://developer.mozilla.org/zh-CN/docs/Web/HTML", "type": "文档"},
    ],
    "CSS": [
        {"name": "MDN CSS", "url": "https://developer.mozilla.org/zh-CN/docs/Web/CSS", "type": "文档"},
    ],
    "TensorFlow": [
        {"name": "TensorFlow 官方教程", "url": "https://www.tensorflow.org/tutorials", "type": "教程"},
    ],
    "PyTorch": [
        {"name": "PyTorch 官方教程", "url": "https://pytorch.org/tutorials/", "type": "教程"},
    ],
    "SQL": [
        {"name": "SQL 教程", "url": "https://www.runoob.com/sql/", "type": "教程"},
    ],
    "NoSQL": [
        {"name": "MongoDB 官方文档", "url": "https://www.mongodb.com/docs/", "type": "文档"},
    ],
    "RabbitMQ": [
        {"name": "RabbitMQ 官方文档", "url": "https://www.rabbitmq.com/documentation.html", "type": "文档"},
    ],
    "Nginx": [
        {"name": "Nginx 官方文档", "url": "https://nginx.org/en/docs/", "type": "文档"},
    ],
    "Kubernetes": [
        {"name": "Kubernetes 官方文档", "url": "https://kubernetes.io/zh-cn/docs/", "type": "文档"},
    ],
}


def get_resources(skills: list[str]) -> list[dict]:
    """根据技能列表返回学习资源，未知技能返回通用搜索链接"""
    resources = []
    for skill in skills:
        if skill in SKILL_RESOURCES:
            resources.extend(SKILL_RESOURCES[skill])
        else:
            resources.append({
                "name": f"{skill} - 菜鸟教程",
                "url": f"https://www.runoob.com/?s={skill}",
                "type": "搜索",
            })
    # 去重（按 url）
    seen = set()
    unique = []
    for r in resources:
        if r["url"] not in seen:
            seen.add(r["url"])
            unique.append(r)
    return unique
