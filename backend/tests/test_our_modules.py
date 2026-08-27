# -*- coding: utf-8 -*-
"""测试板块自负责模块的补充单元测试（纯函数，无 LLM/DB 依赖，可直接 python 运行）。

覆盖：resume_parser 规则简历提取、JD 技能提取（词典约束 + 原文证据 + 同义词归一 +
无中生有剔除 + 歧义词大小写敏感）、chat_api 系统提示词构造。
@owner: 佳豪（幻觉防控质检）
"""
import os
import sys

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_ROOT)
os.chdir(BACKEND_ROOT)
os.environ["DEEPSEEK_API_KEY"] = ""  # 单测走纯规则路径
os.environ["JWT_SECRET"] = "unit-test-secret-key-0123456789abcdef"  # 满足 database 模块导入校验
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")  # 纯函数测试不实际连库

from services.resume_parser import rule_based_extract, extract_jd_skills  # noqa: E402
from routers.chat_api import _build_system_prompt  # noqa: E402

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


# 1) 规则简历提取：联系方式与基础字段
r = rule_based_extract("姓名：张三\n邮箱 zhangsan@test.com 手机 13812345678\n"
                       "学历 硕士 毕业于清华大学\n期望岗位：后端工程师\n工作年限：3年")
check("rule: 邮箱提取", r["email"] == "zhangsan@test.com", r["email"])
check("rule: 手机提取", r["phone"] == "13812345678", r["phone"])
check("rule: 姓名提取", r["name"] == "张三", r["name"])
check("rule: 学历提取", r["education"] == "硕士", r["education"])
check("rule: 学校提取", r["school"] == "清华大学", r["school"])
check("rule: 期望岗位提取", r["target_position"] == "后端工程师", r["target_position"])
check("rule: 工作年限提取", "3年" in r["experience"], r["experience"])

# 2) 规则简历提取：技能只收词典、不无中生有
r2 = rule_based_extract("掌握 Java 和 Python，还会 MQTT 与 WingDing")
check("rule: 收录词典内技能", {"Java", "Python"} <= set(r2["skills"]), r2["skills"])
check("rule: 不收词典外词汇", not any(s in r2["skills"] for s in ("MQTT", "WingDing")), r2["skills"])

# 3) JD 提取：词典内显式技能 + 原文证据
j = extract_jd_skills("要求熟悉 Java 与 Docker，有分布式经验。")
check("jd: 提取词典内技能", {"java", "docker"} <= set(j["skills"]), j["skills"])
check("jd: 附原文证据", j["evidence"]["java"] and any("Java" in e for e in j["evidence"]["java"]),
      j["evidence"].get("java"))

# 4) JD 提取：词典外显式词汇剔除
j2 = extract_jd_skills("要求熟悉 MQTT 协议")
check("jd: 词典外剔除", "mqtt" not in j2["skills"], j2["skills"])

# 5) JD 提取：无中生有剔除（正文没有的技能不出现）
j3 = extract_jd_skills("要求熟悉 Python")
check("jd: 无证据技能不出现", "java" not in j3["skills"] and "python" in j3["skills"], j3["skills"])

# 6) JD 提取：同义词归一（k8s → kubernetes）
j4 = extract_jd_skills("熟悉 K8s 与 K8s 集群运维")
check("jd: k8s 归一为 kubernetes", "kubernetes" in j4["skills"], j4["skills"])

# 7) JD 提取：歧义短词大小写敏感（go）
# 注：规则路径对 'go' 走大小写敏感的小写匹配（避免动词 "go" 误报），
# 首字母大写的 "Go" 由 LLM 路径补齐；此处只验证规则路径的既定行为。
check("jd: 小写 go 正常命中", "go" in extract_jd_skills("熟练使用 go 语言")["skills"])
check("jd: logo 不误报 go", "go" not in extract_jd_skills("负责 logo 设计")["skills"])

# 8) JD 提取：空文本返回空
check("jd: 空文本空结果", extract_jd_skills("")["skills"] == [])

# 9) chat_api：系统提示词构造
p1 = _build_system_prompt()
check("chat: 基础提示词", "图图" in p1 and "学习" in p1)
p2 = _build_system_prompt({"miss_skills": ["Docker"], "phases": ["第二阶段"]})
check("chat: 注入缺失技能", "Docker" in p2 and "缺失技能" in p2)
check("chat: 注入学习阶段", "第二阶段" in p2)

print("\n结果：PASS %d / FAIL %d" % (passed, failed))
sys.exit(1 if failed else 0)
