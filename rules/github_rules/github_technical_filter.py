"""
GitHub Repository Technical Filter

L2:
判断GitHub仓库是否属于真实技术工程项目

负责:
1. 排除学习仓库
2. 排除教程仓库
3. 排除Demo项目
4. 排除资料仓库
5. 排除模板项目
6. 排除个人展示仓库

不负责:
- 技术趋势判断
- 热度判断
- 技术价值判断
- 企业价值判断
"""
import re


# ==============================
# 标题硬过滤关键词
# 只过滤非常明确的非目标仓库
# ==============================

TITLE_HARD_KEYWORDS = [

    "portfolio", "resume", "personal-site", "my-blog",
    "github-pages", "awesome-list", "awesome-collection",
]


# ==============================
# 学习仓库关键词
# ==============================

LEARNING_KEYWORDS = [
    "tutorial",
    "course",
    "lesson",
    "training",
    "bootcamp",
    "beginner",
    "getting-started",
    "learning-path",
    "road-to",
    "learn-",
    "notes",
    "notebook",
    "practice",
    "exercise",
    "challenge",

    # 明确学习用途
    "learning platform",
    "learning system",
    "learning project",
    "education platform",
    "education system",
    "course platform",
    "course system",
    "training platform",
    "training system",
    "practice platform",
    "practice system",
    "coding practice",
    "coding training",
    "interview practice",
    "interview training",
    "tutorial platform",
    "educational platform",
    "for learning",
    "for practice",
    "learn java",
    "learning java",
    "learn python",
    "learning python",
    "learn programming",
    "programming learning",

    # 中文
    "笔记",
    "入门",
    "练习",
    "实战",
    "学习平台",
    "学习系统",
    "学习项目",
    "课程平台",
    "课程系统",
    "在线课程",
    "课程项目",
    "训练平台",
    "训练系统",
    "练习平台",
    "练习系统",
    "刷题平台",
    "刷题系统",
    "编程学习",
    "编程练习",
    "编程训练",
    "面试训练",
    "面试练习",
    "面试题",
    "教学平台",
    "教学系统",
    "教育平台",
    "教育系统",
    "用于学习",
    "帮助学习",
    "用于练习",
    "帮助练习",
    "对比学习",
    "技术学习",
    "学习建议",
]




# ==============================
# 教程/课程型仓库关键词
# 识别:
# - 教程仓库
# - 学习路线仓库
# - 课程代码仓库
# - 从零实践仓库
# （配合工程上下文保护，防止误杀）
# ==============================

GITHUB_TUTORIAL_BLOCK_KEYWORDS = [

    "tutorial",
    "course",
    "learning",
    "learn",
    "hands-on",
    "from scratch",
    "beginner",
    "getting started",

    "入门",
    "教程",
    "课程",
    "实战",
]


# ==============================
# Demo 示例仓库关键词
# ==============================

DEMO_KEYWORDS = [
    "demo",
    "example",
    "sample",
    "playground",
    "showcase",
    "prototype",
    "proof-of-concept",
    "poc",
    "lab",
    "实验",
    "示例",
    "案例",
    "实验室",
]


# ==============================
# 资料集合仓库关键词
# ==============================

RESOURCE_KEYWORDS = [

    "awesome",
    "awesome-list",
    "awesome-collection",
    "roadmap",
    "resource",
    "resources",
    "collection",
    "collections",
    "curated",
    "list",
    "books",
    "papers",
    "guide",
    "cheatsheet",
    "reference",
    "knowledge-base",
"knowledge base",
"knowledge",
"landscape",
"directory",
"catalog",
"catalogue",
"index",
"wiki",
"资料",
"合集",
"路线图",
"知识库",
"目录",
"索引",
]


# ==============================
# 模板仓库关键词
# ==============================

TEMPLATE_KEYWORDS = [

    "template",
    "starter",
    "starter-kit",
    "boilerplate",
    "scaffold",
    "skeleton",
    "模板",
    "脚手架",
]


# ==============================
# 个人展示仓库关键词
# ==============================

PERSONAL_KEYWORDS = [

    "portfolio",
    "resume",
    "cv",
    "personal-site",
    "personal-website",
    "homepage",
    "my-blog",
]


# ==============================
# 个人低价值项目关键词
# 识别个人练手/测试/实验项目
# ==============================

PERSONAL_PROJECT_KEYWORDS = [
    # 个人
    "personal",
    "my-project",
    "myproject",
    "side-project",
    "personal use",
    "for personal use",
    "for myself",
    "my own use",
    "used by myself",
    "个人使用",
    "个人自用",
    "自己使用",
    "自用",

    # 个人实验 / 探索 / 科研
    "practice",
    "experiment",
    "personal experiment",
    "my experiment",
    "personal exploration",
    "my exploration",
    "personal research",
    "research project",
    "个人实验",
    "自己实验",
    "个人探索",
    "自己探索",
    "个人科研",
    "科研课题",
    "个人课题",

    # 练手 / 测试 / 临时项目
    "test-project",
    "toy-project",
    "playground",
    "练手",
    "练习项目",
    "个人测试",
    "自己测试",
    "临时项目",
    "私人项目",
    "个人",
    "个人项目",
    "实验",
    "测试项目",
]


# ==============================
# 算法刷题/面试练习仓库关键词
# ==============================

ALGORITHM_PRACTICE_KEYWORDS = [

    "leetcode",
    "algorithm practice",
    "coding interview",
    "interview preparation",
    "data structure",
    "algorithm",
    "刷题",
    "算法题",
    "数据结构",
    "面试题",

]


# ==============================
# 配置仓库关键词
# ==============================

CONFIG_KEYWORDS = [

    "dotfiles",
    "config",
    "configs",
    "configuration",
    "settings",
    "setup",
]


# ==============================
# 文档仓库关键词
# ==============================

DOCUMENT_KEYWORDS = [

    "documentation",
    "document",
    "docs",
    "wiki",
    "manual",
    "documentation site",

    "文档",
    "文档库",
    "使用手册",
]


# ==============================
# 工程上下文保护关键词
# 防止误杀真实工程仓库
# 仅用于噪声过滤防误判，不是价值判断
# ==============================

ENGINEERING_CONTEXT_KEYWORDS = [
    "framework",
    "platform",
    "engine",
    "server",
    "service",
    "operator",
    "middleware",
    "gateway",
    "infrastructure",
    "architecture",
    "distributed",
    "cluster",
    "production",
    "enterprise",
    "workflow",
    "library",
    "sdk",
    "runtime",
    "database",
    "storage",
    "框架",
    "平台",
    "引擎",
    "服务",
    "中间件",
    "网关",
    "基础设施",
    "架构",
    "分布式",
    "集群",
    "数据库",
    "存储",
]


# ==============================
# Demo 确认信号关键词
# README 中的说明性词
# ==============================

DEMO_CONFIRM_KEYWORDS = [

    "sample", "example", "tutorial", "quick start",
]


# ==============================
# 资料集合确认信号关键词
# README 中出现这些词说明是资料集
# ==============================

RESOURCE_CONFIRM_KEYWORDS = [

    "awesome", "resources", "links", "curated", "collection of",
    "directory",
"catalog",
"catalogue",
"index",
"landscape",
"knowledge base",
"knowledge-base",
"knowledge",
"wiki",
"list of",
"collection",
]


# ==============================
# 模板确认信号关键词
# README 主要描述克隆/脚手架/修改
# ==============================

TEMPLATE_CONFIRM_KEYWORDS = [

    "clone", "starter", "scaffold", "modify",
]


# ==============================
# 个人展示确认信号关键词
# README 描述个人主页
# ==============================

PERSONAL_CONFIRM_KEYWORDS = [

    "about me",
    "profile",
    "personal website",

    "about me",
    "my website",
    "portfolio",
    "personal website",
    "个人主页",
    "我的网站",
]


# ==============================
# 算法刷题确认信号关键词
# ==============================

ALGORITHM_CONFIRM_KEYWORDS = [

    "solution",
    "solutions",
    "problem",
    "answer",
    "leetcode",
    "practice",
    "exercise",
]


# ==============================
# 配置确认信号关键词
# ==============================

CONFIG_CONFIRM_KEYWORDS = [

    "configuration",
    "config file",
    "personal setup",
    "environment setup",
]


# ==============================
# 文档确认信号关键词
# README 中出现这些词说明是文档仓库
# ==============================

DOCUMENT_CONFIRM_KEYWORDS = [

    "documentation",
    "docs",
    "wiki",
    "manual",
    "文档",
    "说明",
]


def normalize_text(text):

    if not text:
        return ""

    return re.sub(
        r"\s+",
        " ",
        str(text)
    ).lower()


def contains_any(text, keywords):

    """
    判断 text 是否包含任一 keyword
    """

    if not text:
        return False

    text = text.lower()

    for keyword in keywords:
        if keyword.lower() in text:
            return True

    return False


def count_keyword_hits(text, keywords):

    """
    统计 text 命中 keywords 中关键词的次数
    """

    if not text:
        return 0

    count = 0

    text = text.lower()

    for keyword in keywords:

        if keyword.lower() in text:
            count += 1

    return count


def has_engineering_context(text):

    """
    判断是否包含工程上下文
    只是防止误杀，不是评分
    """

    return contains_any(
        text,
        ENGINEERING_CONTEXT_KEYWORDS
    )


# ==============================
# 学习仓库判断
# Summary 明确命中学习关键词
#        ↓
# 直接判断为学习类仓库
# 否则：
# Title / Tags 命中学习关键词
# +
# README 命中至少 2 个学习关键词
# +
# 没有工程上下文
# ==============================

def has_learning_noise(title,summary, readme_preview,tags):
    """
    判断是否为学习/课程/训练型仓库。

    判断分两层：

    1. Summary（GitHub About）明确说明仓库本身用于：
       学习、课程、训练、练习、教学、面试等
       → 直接过滤。

    2. 如果 Summary 没有明确说明：
       Title 或 Tags 命中学习关键词
       +
       README 命中至少 2 个学习关键词
       +
       没有明显工程上下文
       → 过滤。

    其他情况保留。
    """

    # ==============================
    # 1. Summary 强信号
    # ==============================

    summary_hit = count_keyword_hits(
        summary,
        LEARNING_KEYWORDS
    )

    if summary_hit >= 1:
        return True

    # ==============================
    # 2. Title / Tags 学习信号
    # ==============================

    title_hit = count_keyword_hits(
        title,
        LEARNING_KEYWORDS
    )

    tag_text = normalize_text(
        " ".join(tags)
    )

    tag_hit = count_keyword_hits(
        tag_text,
        LEARNING_KEYWORDS
    )

    # ==============================
    # 3. README 学习确认
    # ==============================

    content_hit = count_keyword_hits(
        readme_preview,
        LEARNING_KEYWORDS
    )

    # ==============================
    # 4. 工程上下文保护
    # ==============================

    engineering_text = " ".join(
        [
            normalize_text(summary),
            readme_preview,
            tag_text
        ]
    )

    return (
        (title_hit >= 1 or tag_hit >= 1)
        and content_hit >= 2
        and not has_engineering_context(
            engineering_text
        )
    )

# ==============================
# 教程/课程仓库判断
# 命中教程关键词
# + 没有工程上下文
# 检测 title + summary + README + tags
# ==============================

def has_tutorial_noise(
    title,
    summary,
    readme_preview,
    tags
):

    text = normalize_text(
        " ".join(
            [
                title,
                summary,
                readme_preview,
                " ".join(tags)
            ]
        )
    )

    tutorial_hit = count_keyword_hits(
        text,
        GITHUB_TUTORIAL_BLOCK_KEYWORDS
    )

    if tutorial_hit == 0:
        return False

    if has_engineering_context(text):
        return False

    return True


# ==============================
# 个人低价值项目判断
# 命中个人项目关键词
# + 工程上下文保护
# 或
# 命中个人确认关键词
# ==============================

def has_personal_project_noise(
    title,
    summary,
    readme_preview
):
    """
    判断是否为个人低价值/个人自用仓库。

    1. Summary 明确说明个人自用、个人实验、个人探索、
       科研课题、自己使用等 → 直接过滤

    2. Title 明确是个人项目/练手/实验项目
       + 没有工程上下文 → 过滤

    3. 其他情况保留
    """
    title_text = normalize_text(
        title
    )
    summary_text = normalize_text(
        summary
    )
    readme_text = normalize_text(
        readme_preview
    )
    # ==========================================
    # 1. Summary 强信号
    # ==========================================
    summary_hit = count_keyword_hits(
        summary_text,
        PERSONAL_PROJECT_KEYWORDS
    )
    if summary_hit >= 1:
        return True
    # ==========================================
    # 2. Title 明确个人项目
    # + 没有工程上下文
    # ==========================================
    title_hit = count_keyword_hits(
        title_text,
        PERSONAL_PROJECT_KEYWORDS
    )
    context_text = " ".join(
        [
            summary_text,
            readme_text
        ]
    )
    if (
        title_hit >= 1
        and not has_engineering_context(
            context_text
        )
    ):
        return True
    return False


# ==============================
# Demo 示例仓库判断
# 标题命中 demo/example
# + README 出现 sample/example/tutorial/quick start
# + 没有工程上下文
# ==============================

def has_demo_noise(title, readme_preview):

    title_hit = count_keyword_hits(
        title,
        DEMO_KEYWORDS
    )

    content_hit = count_keyword_hits(
        readme_preview,
        DEMO_CONFIRM_KEYWORDS
    )

    return (
        title_hit >= 1
        and content_hit >= 1
        and not has_engineering_context(readme_preview)
    )


# ==============================
# 资料集合仓库判断
# 标题命中资源类关键词
# + README 出现 awesome/resources/links/curated/collection of
# ==============================

def has_resource_noise(title, readme_preview):

    title_hit = count_keyword_hits(
        title,
        RESOURCE_KEYWORDS
    )

    content_hit = count_keyword_hits(
        readme_preview,
        RESOURCE_CONFIRM_KEYWORDS
    )

    return (
        title_hit >= 1
        and content_hit >= 1
    )


# ==============================
# 模板仓库判断
# 标题命中 template/starter
# + README 描述 clone/starter/scaffold/modify
# + 没有工程上下文
# ==============================

def has_template_noise(title, readme_preview):

    title_hit = count_keyword_hits(
        title,
        TEMPLATE_KEYWORDS
    )

    content_hit = count_keyword_hits(
        readme_preview,
        TEMPLATE_CONFIRM_KEYWORDS
    )

    return (
        title_hit >= 1
        and content_hit >= 1
        and not has_engineering_context(readme_preview)
    )


# ==============================
# 个人展示仓库判断
# 标题命中个人展示关键词
# + README 出现 about me/profile/personal website
# ==============================

def has_personal_noise(title, readme_preview):

    title_hit = count_keyword_hits(
        title,
        PERSONAL_KEYWORDS
    )

    content_hit = count_keyword_hits(
        readme_preview,
        PERSONAL_CONFIRM_KEYWORDS
    )

    return (
        title_hit >= 1
        and content_hit >= 1
    )


# ==============================
# 算法刷题/面试练习仓库判断
# 标题命中算法关键词 >=1
# + README 命中确认关键词 >=1
# + 没有工程上下文
# ==============================

def has_algorithm_practice_noise(title, readme_preview):

    title_hit = count_keyword_hits(
        title,
        ALGORITHM_PRACTICE_KEYWORDS
    )

    content_hit = count_keyword_hits(
        readme_preview,
        ALGORITHM_CONFIRM_KEYWORDS
    )

    return (
        title_hit >= 1
        and content_hit >= 1
        and not has_engineering_context(readme_preview)
    )


# ==============================
# 配置仓库判断
# 标题命中配置关键词 + README 命中确认关键词
# + 没有工程上下文
# ==============================

def has_config_noise(title, readme_preview):

    title_hit = count_keyword_hits(
        title,
        CONFIG_KEYWORDS
    )

    content_hit = count_keyword_hits(
        readme_preview,
        CONFIG_CONFIRM_KEYWORDS
    )

    return (
        title_hit >= 1
        and content_hit >= 1
        and not has_engineering_context(readme_preview)
    )


# ==============================
# 文档仓库判断
# 标题命中文档关键词 >=1
# + README 命中确认关键词 >=1
# 只过滤明显文档仓库
# ==============================

def has_document_noise(title, readme_preview):

    title_hit = count_keyword_hits(
        title,
        DOCUMENT_KEYWORDS
    )

    content_hit = count_keyword_hits(
        readme_preview,
        DOCUMENT_CONFIRM_KEYWORDS
    )

    return (
        title_hit >= 1
        and content_hit >= 1
    )


# ==============================
# 技术工程过滤主函数
# ==============================

def is_github_technical(repository):

    """
    判断是否为技术工程仓库

    返回:
        True  保留
        False 过滤
    """

    title = repository.get(
        "title",
        ""
    )
    summary = repository.get(
        "summary",
        ""
    )
    tags = repository.get(
        "tags",
        []
    )
    content = repository.get(
        "content",
        ""
    )

    # summary/tags 用于辅助噪声判断。
    # 不参与技术价值判断
    summary_text = normalize_text(
        summary
    )

    tag_text = tags

    readme_preview = normalize_text(
        content[:1000]
    )

    # 1. 标题硬过滤
    if contains_any(
        title,
        TITLE_HARD_KEYWORDS
    ):
        return False

    # 2. 学习仓库判断
    if has_learning_noise(
        title,
        summary_text,
        readme_preview,
        tag_text
    ):
        return False

    # 2.5 教程/课程仓库过滤
    if has_tutorial_noise(
        title,
        summary_text,
        readme_preview,
        tag_text
    ):
        return False

    # 3. Demo 判断
    if has_demo_noise(
        title,
        readme_preview
    ):
        return False

    # 4. 资料集合判断
    if has_resource_noise(
        title,
        readme_preview
    ):
        return False

    # 5. 模板判断
    if has_template_noise(
        title,
        readme_preview
    ):
        return False

    # 6. 算法刷题仓库判断
    if has_algorithm_practice_noise(
        title,
        readme_preview
    ):
        return False

    # 7. 配置仓库判断
    if has_config_noise(
        title,
        readme_preview
    ):
        return False

    # 8. 文档仓库判断
    if has_document_noise(
        title,
        readme_preview
    ):
        return False

    # 9. 个人低价值项目过滤
    if has_personal_project_noise(
        title,
        summary_text,
        readme_preview
    ):
        return False

    # 10. 个人展示判断
    if has_personal_noise(
        title,
        readme_preview
    ):
        return False

    # 11. 以上均未命中
    return True