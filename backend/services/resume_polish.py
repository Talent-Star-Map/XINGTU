"""
AI 润色 —— 只改措辞，不改事实

为什么单独一个文件：
    润色是把本地构建好的简历交给模型改写表达。模型很容易顺手"补全"公司名、
    学校名或业绩数字，所以润色结果落地前必须过一遍 `guard_sections()`，
    把事实层（姓名/联系方式/公司/职位/学校/时间）强制锁回本地版本。

三道闸：
    1. 事实字段一律以本地为准，AI 返回的同名字段直接丢弃
    2. 条目描述里出现的数字必须来自原文（原文没有数字就不许出现数字）
    3. 不允许出现资料里没有的公司/学校名

任一字段不合规就单独回退到本地版本；整体失败返回 None，由调用方发未润色版本，
不会因为润色失败而让用户点一次生成就报错。
"""

import json
import re
from typing import Optional

from services.llm import complete, LLMTier, is_mock_mode, is_global_enabled

# 数字：40%、3 年、800ms、1.5 倍
_NUM_RE = re.compile(r'\d+(?:\.\d+)?%?')
# 机构名：公司/集团/大学/学院/研究院结尾
_ORG_RE = re.compile(
    r'[\u4e00-\u9fa5A-Za-z]{2,20}(?:有限责任公司|有限公司|集团|公司|大学|学院|研究院|实验室)'
)
# 大厂/名校常被写成裸名（「在腾讯负责…」），没有后缀也要拦
_BARE_ORG_RE = re.compile(
    r'腾讯|阿里|百度|字节|美团|京东|拼多多|小米|华为|网易|滴滴|快手|蚂蚁|携程|新浪|搜狐|'
    r'中兴|联想|海尔|万科|平安|招商|中石油|中石化|清华|北大|复旦|交大|浙大|南大|武大|中科大'
)
_CN_RUN = re.compile(r'[\u4e00-\u9fa5]{2,}')


def _numbers(*texts) -> set[str]:
    out: set[str] = set()
    for t in texts:
        for n in _NUM_RE.findall(str(t or '')):
            out.add(n.replace('.0', ''))
    return out


def _orgs(*texts) -> set[str]:
    out: set[str] = set()
    for t in texts:
        out.update(_ORG_RE.findall(str(t or '')))
    return out


def _bare_org_ok(text: str, known_orgs: set[str]) -> bool:
    """裸名机构（腾讯/清华）也必须出现在资料里"""
    for name in _BARE_ORG_RE.findall(text or ''):
        if not any(name in k for k in known_orgs):
            return False
    return True


def numbers_in(*texts) -> set[str]:
    """提取文本里的数字（公开给 optimize 做校验）"""
    return _numbers(*texts)


def orgs_in(*texts) -> set[str]:
    """提取文本里的机构名（公开给 optimize 做校验）"""
    return _orgs(*texts)


def _safe_text(text: str, allowed_nums: set[str], known_orgs: set[str]) -> Optional[str]:
    """校验一段 AI 文本是否可以落库：数字与机构名都必须在已知范围内"""
    text = (text or '').strip()
    if not text:
        return ''
    for n in _NUM_RE.findall(text):
        if n.replace('.0', '') not in allowed_nums:
            return None
    for org in _ORG_RE.findall(text):
        if not any(org == k or org in k or k in org for k in known_orgs):
            return None
    if not _bare_org_ok(text, known_orgs):
        return None
    return text


def _bigrams(text: str) -> set[str]:
    out: set[str] = set()
    for run in _CN_RUN.findall(text or ''):
        for i in range(len(run) - 1):
            out.add(run[i:i + 2])
    return out


def _overlap_ok(ai_text: str, source_text: str, threshold: float = 0.3) -> bool:
    """简介必须是从资料改写来的，不能整段新编

    用中文二元组（bigram）覆盖率判断：AI 简介里的词组有多少能在
    「本地简介 + 用户资料全文」里找到。整段新编的内容（「在腾讯负责核心交易系统」）
    覆盖率会接近 0；正常改写（换同义词、调顺序）覆盖率通常在 0.3 以上。
    """
    ai = _bigrams(ai_text)
    if not ai:
        return True          # 纯英文简介不做中文重叠判断
    hit = len(ai & _bigrams(source_text))
    return hit / len(ai) >= threshold


def _safe_list(items, allowed_nums: set[str], known_orgs: set[str]) -> list[str]:
    out: list[str] = []
    for item in items or []:
        if not isinstance(item, str):
            continue
        safe = _safe_text(item, allowed_nums, known_orgs)
        if safe:
            out.append(safe)
    return out


def guard_sections(local: dict, ai: dict, profile: dict) -> dict:
    """把 AI 结果里合规的措辞合并进本地骨架

    合并粒度是「字段」而不是「整份简历」：某条经历的亮点编造了数字，就只丢那条亮点，
    其余段落照常采用，用户不会因为一处不合规就看到整段没变。
    """
    known_orgs: set[str] = set()
    for k in ('work', 'education', 'projects'):
        for item in profile.get(k) or []:
            known_orgs.update(_orgs(item.get('company'), item.get('institution'), item.get('name')))
    known_orgs.update(_orgs(profile.get('basic', {}).get('school')))

    result = json.loads(json.dumps(local))   # 深拷贝，不改入参

    # summary：只能引用已有事实，且必须是从资料改写来的
    # 模型偶尔直接把 summary 写成字符串而不是 {text: ...}，两种都收
    raw_summary = (ai or {}).get('summary')
    if isinstance(raw_summary, dict):
        ai_summary = raw_summary.get('text')
    else:
        ai_summary = raw_summary if isinstance(raw_summary, str) else None
    if isinstance(ai_summary, str):
        local_summary = (local.get('summary') or {}).get('text', '')
        work_text = ' '.join([
            str(item.get('description') or '') + ' ' + ' '.join(str(h) for h in item.get('highlights') or [])
            for item in local.get('work_experience', {}).get('items') or []
        ])
        profile_text = ' '.join([
            str(profile.get('basic', {}).get('bio') or ''),
            ' '.join(profile.get('skills') or []),
            work_text,
        ])
        allowed = _numbers(local_summary, work_text)
        safe = _safe_text(ai_summary, allowed, known_orgs)
        if safe and _overlap_ok(safe, local_summary + ' ' + profile_text):
            result['summary'] = {'text': safe}

    for section_key, list_key in (('work_experience', 'work'), ('projects', 'projects')):
        ai_items = (ai or {}).get(list_key) or []
        if not isinstance(ai_items, list):
            continue
        local_items = result.get(section_key, {}).get('items') or []
        for idx, local_item in enumerate(local_items):
            ai_item = next(
                (x for x in ai_items if isinstance(x, dict) and int(x.get('index', -1)) == idx + 1),
                None,
            )
            if not ai_item:
                continue
            own_text = ' '.join([
                str(local_item.get('company') or local_item.get('name') or ''),
                str(local_item.get('position') or ''),
                str(local_item.get('description') or ''),
                *[str(h) for h in local_item.get('highlights') or []],
            ])
            allowed = _numbers(own_text) | _numbers(local.get('summary', {}).get('text'))
            has_source = bool(str(local_item.get('description') or '').strip()
                              or local_item.get('highlights'))

            raw_desc = ai_item.get('description', '')
            desc = _safe_text(raw_desc if isinstance(raw_desc, str) else '', allowed, known_orgs)
            # 原文没有描述时，允许 AI 写通用职责；原文有描述时，AI 版本必须过校验才替换
            if desc is not None and desc.strip():
                local_item['description'] = desc
            if not has_source and desc is not None and not desc.strip():
                local_item['description'] = ''

            highlights = _safe_list(ai_item.get('highlights'), allowed, known_orgs)
            if highlights:
                local_item['highlights'] = highlights[:6]

    return result


def _prompt(language: str) -> str:
    lang = 'English' if language == 'en' else '简体中文'
    return f"""你是简历润色编辑，用{lang}改写给定的简历内容。

绝对规则：
1. 只能改写措辞与句式，不得新增任何事实：不虚构公司、学校、项目、时间、业绩数字
2. 原文里的数字（百分比、毫秒、金额、人数、年份）必须原样保留，不能改大也不能新增
3. 不允许出现原文没有的公司名、学校名、项目名
4. 某段经历如果本来没有描述，只能写 1-2 句与职位相符的通用职责，且不能出现数字
5. 使用动词开头的短句，删掉"负责了""参与了"这类弱表达，不写空话
6. 直接输出 JSON，不要 markdown 代码块，不要解释文字

输出结构：
{{
  "summary": "一段 2-3 句的个人简介（没有素材就留空字符串）",
  "work": [{{"index": 1, "description": "", "highlights": ["", ""]}}],
  "projects": [{{"index": 1, "description": "", "highlights": ["", ""]}}]
}}
index 对应输入里条目的序号（从 1 开始），不要新增或删除条目。"""


def polish_sections(sections: dict, profile: dict, params: dict) -> Optional[dict]:
    """调用模型润色；返回 {'sections': dict, 'provider': str} 或 None

    None 的含义是「这次不润色」：Mock 模式、AI 总开关关闭、模型不可用、输出解析失败，
    调用方应把本地构建的版本原样返回。
    """
    try:
        if is_mock_mode() or not is_global_enabled():
            return None
    except Exception:
        return None

    work_items = (sections.get('work_experience') or {}).get('items') or []
    project_items = (sections.get('projects') or {}).get('items') or []
    if not work_items and not project_items and not (sections.get('summary') or {}).get('text'):
        return None   # 没有任何可改写的文本，不用调模型

    payload = {
        'target_job': params.get('job_title', ''),
        'years_of_experience': params.get('years_of_experience'),
        'industry': params.get('industry', ''),
        'known_skills': (profile.get('skills') or [])[:30],
        'summary': (sections.get('summary') or {}).get('text', ''),
        'work': [
            {
                'index': i + 1,
                'company': item.get('company', ''),
                'position': item.get('position', ''),
                'description': item.get('description', ''),
                'highlights': item.get('highlights') or [],
            }
            for i, item in enumerate(work_items)
        ],
        'projects': [
            {
                'index': i + 1,
                'name': item.get('name', ''),
                'description': item.get('description', ''),
                'highlights': item.get('highlights') or [],
            }
            for i, item in enumerate(project_items)
        ],
    }

    try:
        res = complete(
            LLMTier.STRONG,
            _prompt(params.get('language', 'zh')),
            [{'role': 'user', 'content': json.dumps(payload, ensure_ascii=False)}],
            json_mode=True,
            max_tokens=8192,
        )
    except Exception:
        return None

    ai = res.get('raw')
    if not isinstance(ai, dict):
        ai = None
        text = res.get('text') or ''
        for pattern in (r'```(?:json)?\s*([\s\S]*?)```', r'\{[\s\S]*\}'):
            m = re.search(pattern, text)
            if not m:
                continue
            try:
                ai = json.loads(m.group(1) if m.groups() else m.group(0))
                break
            except Exception:
                continue
    if not isinstance(ai, dict):
        return None

    try:
        merged = guard_sections(sections, ai, profile)
    except Exception:
        # 校验过程出任何意外都退回未润色版本，不能让用户点一次生成拿到 500
        return None

    return {
        'sections': merged,
        'provider': res.get('provider', 'llm'),
    }
