# -*- coding: utf-8 -*-
"""幻觉防控·质检模块单元测试（纯函数，无 LLM/DB 依赖，可直接 python 运行）。

覆盖：置信度评分（证据门槛）、原文溯源、多源交叉验证、抄袭检测、通胀检测、
JD 规则提取与幻觉过滤、技能同义词归一。
@owner: 佳豪（幻觉防控质检）
"""
import os
import sys

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_ROOT)
os.chdir(BACKEND_ROOT)
os.environ["DEEPSEEK_API_KEY"] = ""  # 单测走纯规则路径

from services.quality_checker import (  # noqa: E402
    score_skills, trace_skills, cross_validate,
    detect_plagiarism, detect_inflation,
)
from services.resume_parser import extract_jd_skills  # noqa: E402
from services.skill_synonyms import is_synonym, normalize_skill  # noqa: E402

passed = 0
failed = 0


def check(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  [PASS]", name)
    else:
        failed += 1
        print("  [FAIL]", name, detail)


# 1) 置信度评分：无原文证据 → 永不"已验证"，且带幻觉风险标记
scores = score_skills(["Java", "不存在的技能X"], "熟练使用 Java 开发", method="llm")
java = next(s for s in scores if s["skill"] == "Java")
hallu = next(s for s in scores if s["skill"] == "不存在的技能X")
check("score: 有证据技能为 verified", java["status"] == "verified" and java["confidence"] >= 0.7)
check("score: 无证据技能为 unconfirmed 且 ≤0.3",
      hallu["status"] == "unconfirmed" and hallu["confidence"] <= 0.3
      and hallu["hallucination_risk"] is True)

# 2) 原文溯源
traces = trace_skills(["Java", "Ghost"], "熟练使用 Java。掌握 Python。")
check("trace: 有原文证据", traces[0]["found"] is True and "Java" in traces[0]["evidence"][0])
check("trace: 无原文证据标记", traces[1]["found"] is False)

# 3) 多源交叉验证：≥2 来源才 verified
cv = cross_validate([
    ("Boss直聘", ["java", "mysql"]),
    ("拉勾", ["java", "python"]),
])
check("cross: Java 双源 verified", cv["java"]["verified"] is True)
check("cross: MySQL 单源 unconfirmed", cv["mysql"]["verified"] is False)

# 4) 抄袭检测
pl = detect_plagiarism([
    {"id": 1, "title": "A", "company": "X", "description": "负责后端开发，要求 Java"},
    {"id": 2, "title": "A", "company": "Y", "description": "负责后端开发，要求 Java"},
], threshold=0.9)
check("plagiarism: 相同 JD 检出", len(pl) == 1 and pl[0]["similarity"] >= 0.9)

# 5) 通胀检测：同岗位技能数超 2σ 标出
inf = detect_inflation([
    {"id": 1, "title": "后端工程师A", "company": "X", "skills": ["a", "b", "c"]},
    {"id": 2, "title": "后端工程师B", "company": "Y", "skills": ["a", "b", "c"]},
    {"id": 3, "title": "后端工程师C", "company": "Z", "skills": ["a", "b", "c"]},
    {"id": 5, "title": "后端工程师E", "company": "V", "skills": ["a", "b", "c"]},
    {"id": 6, "title": "后端工程师F", "company": "U", "skills": ["a", "b", "c"]},
    {"id": 4, "title": "后端工程师D", "company": "W",
     "skills": list("abcdefghijklmnopqrst")},
])
check("inflation: 虚高岗位标出", len(inf) == 1 and inf[0]["jd_id"] == 4)

# 6) JD 规则提取：显式技能 + 证据；无技能文本返回空
r = extract_jd_skills("后端工程师\n熟悉 Java、Spring Boot 和 Docker，负责分布式系统。")
skills = set(r["skills"])
check("jd-extract: 提取显式技能", {"java", "spring boot", "docker", "分布式"} <= skills)
check("jd-extract: 不臆测", "python" not in skills and "mysql" not in skills)
check("jd-extract: 无证据即空", extract_jd_skills("负责团队沟通与项目协调")["skills"] == [])

# 7) 同义词归一
check("synonym: k8s 归一 kubernetes", is_synonym("k8s", "kubernetes"))
check("synonym: rest apis 归一 restful", is_synonym("rest apis", "restful"))
check("synonym: normalize 扩展", "kubernetes" in normalize_skill("k8s"))

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
