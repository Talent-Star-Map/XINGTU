"""
Layer 2: Technical article filter.

Purpose:
Filter obvious hard noise content.

Remove:
1. Recruitment information
2. Training/course promotion
3. Advertisement content
4. Pure event promotion
5. Career discussion

Layer 1:
Only judges IT domain.

Layer 3:
Judges analysis value.

Layer 2 does not judge:
- tutorial
- beginner content
- technical value
- trend value
"""


# ============================
# Recruitment related
# ============================

RECRUIT_KEYWORDS = [
    "招聘",
    "校招",
    "社招",
    "内推",
    "offer",
    "面试",
    "面经",
    "笔试",
    "简历",
    "薪资",
    "工资",
    "求职",
    "跳槽",
    "猎头",
    "外包",
    "派遣",
    "急招",
    "诚聘",
    "高薪诚聘",
    "招人",
    "招聘中",
]


# ============================
# Training related
# ============================

TRAINING_KEYWORDS = [
    "培训",
    "训练营",
    "课程",
    "公开课",
    "直播课",
    "收费课程",
    "付费课程",
    "报名",
    "报班",
    "开班",
    "精品课",
    "系统课",
    "会员课程",
]


# ============================
# Advertisement related
# ============================

ADVERTISEMENT_KEYWORDS = [
    "优惠",
    "限时",
    "免费领取",
    "扫码",
    "点击领取",
    "关注公众号",
    "立即报名",
    "抽奖",
    "送书",
    "送礼品",
    "打折",
    "折扣",
    "特价",
    "推广",
    "广告",
    "赞助",
    "邀请码",
    "注册送",
]


# ============================
# Activity related
# ============================

ACTIVITY_KEYWORDS = [
    "大会",
    "峰会",
    "论坛",
    "发布会",
    "meetup",
    "hackathon",
    "黑客马拉松",
    "沙龙",
    "活动",
    "议程",
    "演讲嘉宾",
    "嘉宾介绍",
    "参会",
    "购票",
    "门票",
    "邀请函",
    "workshop",
]


# ============================
# Career related
# ============================

CAREER_KEYWORDS = [
    "程序员人生",
    "职场",
    "领导力",
    "职业规划",
    "升职",
    "管理者",
    "内卷",
    "躺平",
    "裁员",
    "被裁",
    "失业",
    "中年危机",
    "35岁",
    "转行",
    "转岗",
    "职场经验",
    "职场感悟",
    "程序员故事",
    "副业",
]


# ============================
# Extreme garbage title
# Direct filtering
# ============================

TITLE_HARD_KEYWORDS = [
    "高薪招聘",
    "急招",
    "诚聘",
    "招聘中",
    "校招岗位",
    "社招岗位",
    "投递简历",
    "简历投递",
    "立即报名",
    "扫码领取",
    "免费领取",
    "优惠活动",
    "限时优惠",
]

ALGORITHM_PRACTICE_KEYWORDS = [
"leetcode",
"algorithm practice",
"data structure",
"coding interview",
"interview preparation",
"算法题",
"刷题",
"数据结构",
"面试题",
]
CONFIG_KEYWORDS = [
"dotfiles",
"configuration",
"config",
"configs",
"settings",
"setup",
]
DOCUMENTATION_KEYWORDS = [
"documentation",
"docs",
"wiki",
"manual",
"documentation-site",
]


def contains_any(text: str, keywords: list) -> bool:

    if not text:
        return False

    text = text.lower()

    for keyword in keywords:
        if keyword.lower() in text:
            return True

    return False



def count_keyword_hits(text, keywords):

    if not text:
        return 0

    count = 0

    text = text.lower()

    for keyword in keywords:

        if keyword.lower() in text:
            count += 1

    return count



def has_recruit_noise(title, content_preview):

    title_hit = count_keyword_hits(
        title,
        RECRUIT_KEYWORDS
    )

    content_hit = count_keyword_hits(
        content_preview,
        RECRUIT_KEYWORDS
    )

    return (
        title_hit > 0
        and content_hit >= 2
    )



def has_training_noise(title, content_preview):

    title_hit = count_keyword_hits(
        title,
        TRAINING_KEYWORDS
    )

    content_hit = count_keyword_hits(
        content_preview,
        TRAINING_KEYWORDS
    )

    return (
        title_hit > 0
        and content_hit >= 2
    )



def has_ad_noise(title, content_preview):

    return (
        count_keyword_hits(
            title + content_preview,
            ADVERTISEMENT_KEYWORDS
        )
        >= 2
    )



def has_activity_noise(title, content_preview):

    title_hit = count_keyword_hits(
        title,
        ACTIVITY_KEYWORDS
    )

    content_hit = count_keyword_hits(
        content_preview,
        ACTIVITY_KEYWORDS
    )

    return (
        title_hit > 0
        and content_hit >= 2
    )



def has_career_noise(title, content_preview):

    title_hit = count_keyword_hits(
        title,
        CAREER_KEYWORDS
    )

    return title_hit > 0



def is_technical_article(article: dict) -> bool:
    """
    Return True:
        Pass L2.

    Return False:
        Hard noise.
    """

    title = article.get(
        "title",
        ""
    )

    summary = article.get(
        "summary",
        ""
    )

    content = article.get(
        "content",
        ""
    )

    if isinstance(content, str):
        content_preview = content[:800]
    else:
        content_preview = str(content)[:800]


    # ============================
    # Step 1:
    # Extreme garbage title
    # ============================

    if contains_any(
        title,
        TITLE_HARD_KEYWORDS
    ):
        return False


    # ============================
    # Step 2:
    # title + content preview
    # ============================

    text_preview = (
        title
        +
        summary
        +
        content_preview
    )


    if has_recruit_noise(
        title,
        text_preview
    ):
        return False


    if has_training_noise(
        title,
        text_preview
    ):
        return False


    if has_ad_noise(
        title,
        text_preview
    ):
        return False


    if has_activity_noise(
        title,
        text_preview
    ):
        return False


    if has_career_noise(
        title,
        text_preview
    ):
        return False


    return True