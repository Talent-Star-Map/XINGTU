"""Evidence-backed information-technology role catalog from real postings.

This is a browse taxonomy, not a claim that a title is a novel occupation.
Unrelated postings are excluded and uncategorised technology roles are shown
explicitly so coverage gaps are measurable rather than hidden.
"""
from collections import Counter
import json
import re
from urllib.parse import urlsplit
from services.skill_synonyms import canonical_name


ROLE_RULES = [
    # Specific job functions precede the language/AI catch-alls.
    ('质量与产品', '互联网产品与交互', r'产品经理|产品设计|交互设计|(?<![a-z])ui(?![a-z])|(?<![a-z])ux(?![a-z])|用户体验|体验设计'),
    ('质量与产品', '软件测试与质量', r'软件测试|测试工程|自动化测试|性能测试|测试开发|(?<![a-z])qa(?![a-z])'),
    ('云计算与安全', '运维与SRE', r'运维|devops|(?<![a-z])sre(?![a-z])|(?<![a-z])dba(?![a-z])|数据库运维'),
    ('云计算与安全', '网络与信息安全', r'网络安全|信息安全|安全工程|渗透测试|漏洞|密码工程|安全研究|数据安全|隐私计算'),
    ('云计算与安全', '网络通信与边缘计算', r'网络工程师|网络研发|通信软件|5g|6g|边缘计算|sdn|网络协议'),
    ('云计算与安全', '云原生与平台工程', r'云原生|云计算|kubernetes|k8s|容器平台|平台工程'),
    ('智能硬件与物联网', '芯片设计与验证', r'芯片|集成电路|fpga|asic|数字电路|芯片验证'),
    ('智能硬件与物联网', '机器人与自动驾驶', r'机器人|自动驾驶|智能驾驶|具身智能|运动控制'),
    ('智能硬件与物联网', '嵌入式与IoT', r'嵌入式|单片机|物联网|(?<![a-z])iot(?![a-z])|驱动开发|硬件开发|rtos'),
    ('软件研发', '游戏与XR开发', r'游戏开发|游戏引擎|unity|unreal|虚幻引擎|增强现实|虚拟现实|(?<![a-z])(xr|vr|ar)(?![a-z])'),
    ('软件研发', '移动与鸿蒙开发', r'android|(?<![a-z])ios(?![a-z])|flutter|鸿蒙|移动端|移动开发|小程序'),
    ('软件研发', '桌面与客户端开发', r'桌面开发|客户端开发|electron|qt开发'),
    ('软件研发', '全栈开发', r'全栈|full.?stack'),
    ('软件研发', 'Web前端开发', r'前端|frontend|vue|react|javascript|html5|web开发'),
    ('人工智能与大模型', '大模型训练与算法', r'预训练|大模型.{0,4}(训练|算法|研究)|foundation.?model|llm.{0,3}(train|research)'),
    ('人工智能与大模型', '模型推理与AI平台', r'推理优化|推理平台|模型部署|模型量化|模型压缩|mlops|ai.{0,3}(infra|平台|编译器)|训练平台|分布式训练|gpu.{0,3}(kernel|调度)'),
    ('人工智能与大模型', '智能体与RAG应用', r'智能体|(?<![a-z])agent(?![a-z])|(?<![a-z])rag(?![a-z])|检索增强|prompt|提示词|大模型.{0,3}应用|llm.{0,3}应用'),
    ('人工智能与大模型', '多模态与视觉语音', r'多模态|计算机视觉|图像算法|视觉算法|语音算法|语音识别|自然语言处理|(?<![a-z])nlp(?![a-z])|(?<![a-z])cv(?![a-z])|数字人'),
    ('人工智能与大模型', '推荐搜索与广告算法', r'推荐算法|搜索算法|广告算法|召回算法|排序算法|推荐系统'),
    ('人工智能与大模型', 'AI数据与标注', r'人工智能数据|ai数据|数据标注|模型评测|大模型评测'),
    ('人工智能与大模型', '机器学习与算法', r'机器学习|深度学习|强化学习|aigc|算法工程师|人工智能|(?<![a-z])ai(?![a-z])|大模型|(?<![a-z])llm(?![a-z])'),
    ('数据技术', '数据库与向量检索', r'数据库内核|数据库研发|数据库工程|向量数据库|向量检索|搜索引擎'),
    ('数据技术', '大数据与数仓', r'大数据|数据仓库|数仓|hadoop|spark|flink|实时计算'),
    ('数据技术', '数据工程与治理', r'数据工程|数据治理|(?<![a-z])etl(?![a-z])|数据集成|数据开发'),
    ('数据技术', '数据分析与BI', r'数据分析|商业智能|(?<![a-z])bi(?![a-z])|数据科学'),
    ('数据技术', '区块链与分布式账本', r'区块链|智能合约|solidity|web3'),
    ('软件研发', 'Java与JVM开发', r'(?<![a-z])java(?![a-z])|jvm|spring'),
    ('软件研发', 'Python开发与爬虫', r'python|django|flask|fastapi|爬虫'),
    ('软件研发', 'Go开发', r'golang|(?<![a-z])go\s*(开发|后端|工程师)'),
    ('软件研发', 'Rust与系统软件', r'rust|系统软件|操作系统|底层开发'),
    ('软件研发', 'C与C++系统开发', r'c\+\+|(?<![a-z])c语言|(?<![a-z])c开发'),
    ('软件研发', '.NET与C#开发', r'c#|\.net|asp\.net'),
    ('软件研发', 'PHP与Web服务', r'php|laravel|thinkphp'),
    ('软件研发', '后端与服务端开发', r'后端|服务端|backend|微服务|接口开发'),
    ('软件研发', '通用软件研发', r'软件开发|软件工程|程序开发|application software|software engineer|研发工程师'),
]

EXCLUDE = re.compile(r'司机|货运|快递员|配送员|普工|分拣员|店员|保洁|保姆|家政|销售代表|销售专员|客服专员|导购|收银|餐饮服务|文职|主播|康养|财务专员|行政专员|人事专员|新闻官', re.I)


def classify_title(title: str):
    title = str(title or '').strip()
    if not title or EXCLUDE.search(title):
        return None
    for family, role, pattern in ROLE_RULES:
        if re.search(pattern, title, re.I):
            return family, role
    return None


def _skill_list(raw):
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except ValueError:
            return []
    return [str(item).strip() for item in raw if str(item).strip()] if isinstance(raw, list) else []


def build_catalog(rows):
    roles = {}
    excluded = 0
    for row in rows:
        title = str(row.get('title') or '').strip()
        match = classify_title(title)
        if match is None:
            excluded += 1
            continue
        family, role = match
        key = (family, role)
        if key not in roles:
            roles[key] = {'family': family, 'name': role, 'postings': 0,
                          'titles': Counter(), 'skills': Counter(),
                          'skill_variants': {},
                          'companies': set(), 'sources': Counter(), 'examples': []}
        item = roles[key]
        item['postings'] += 1
        if len(item['examples']) < 8:
            item['examples'].append({key: row.get(key) for key in
                                     ('id', 'title', 'company_name', 'source', 'source_url')})
        item['titles'][title] += 1
        if row.get('company_name'):
            item['companies'].add(str(row['company_name']).strip().casefold())
        if row.get('source'):
            item['sources'][str(row['source'])] += 1
        raw_skills = _skill_list(row.get('skill_tags'))
        canonical_skills = set()
        for raw_skill in raw_skills:
            canonical = canonical_name(raw_skill)
            if canonical:
                canonical_skills.add(canonical)
                item['skill_variants'].setdefault(canonical, set()).add(raw_skill)
        item['skills'].update(canonical_skills)
    output = []
    for item in roles.values():
        output.append({'family': item['family'], 'name': item['name'],
                       'postings': item['postings'], 'distinct_titles': len(item['titles']),
                       'employers': len(item['companies']),
                       'distinct_skills': len(item['skills']),
                       'titles': [{'name': name, 'count': count} for name, count in item['titles'].most_common()],
                       'skills': [{'name': name, 'count': count,
                                   'raw_variants': sorted(item['skill_variants'][name])}
                                  for name, count in item['skills'].most_common()],
                       'sources': dict(item['sources'].most_common()),
                       'examples': item['examples']})
    output.sort(key=lambda item: (-item['postings'], item['name']))
    family_counts = Counter()
    for item in output:
        family_counts[item['family']] += item['postings']
    family_order = ['人工智能与大模型', '软件研发', '数据技术', '云计算与安全', '智能硬件与物联网', '质量与产品']
    covered = {(item['family'], item['name']) for item in output}
    return {'catalog_postings': len(rows),
            'included_postings': len(rows) - excluded,
            'excluded_postings': excluded,
            'role_count': len(output),
            'configured_roles': len(ROLE_RULES),
            'title_count': len({title for item in roles.values() for title in item['titles']}),
            'skill_count': len({skill for item in roles.values() for skill in item['skills']}),
            'families': [{'name': name, 'postings': family_counts[name],
                          'roles': sum(role['family'] == name for role in output),
                          'configured_roles': sum(f == name for f, _, _ in ROLE_RULES),
                          'missing_roles': [role for f, role, _ in ROLE_RULES
                                            if f == name and (f, role) not in covered]}
                         for name in family_order],
            'roles': output,
            'scope_note': '仅统计数据库中已有且标题可归类的信息技术招聘；技能由原始标签同义归一，按招聘去重统计，非必备技能判断或未来需求预测。'}


def has_source_url(row):
    """A navigable source is provenance evidence, not a truth certification."""
    try:
        url = urlsplit(str(row.get('source_url') or '').strip())
        return url.scheme.lower() in ('http', 'https') and bool(url.hostname)
    except ValueError:
        return False


def filter_catalog_rows(rows, tech_stack=None, level=None):
    """Filter before aggregation; missing seniority is not an entry-level job."""
    levels = {'entry': r'实习|应届|校招|初级|junior',
              'mid': r'中级|中层|intermediate',
              'senior': r'高级|资深|senior',
              'lead': r'专家|架构师|负责人|总监|principal|lead',
              'unknown': None}
    if level and level not in levels:
        raise ValueError('unknown level')
    output = []
    for row in rows:
        title = str(row.get('title') or '')
        detected = next((k for k in ('lead', 'senior', 'mid', 'entry')
                         if re.search(levels[k], title, re.I)), 'unknown')
        skills = {canonical_name(s).casefold() for s in _skill_list(row.get('skill_tags'))}
        if tech_stack and canonical_name(tech_stack).casefold() not in skills:
            continue
        if level and detected != level:
            continue
        output.append(row)
    return output


def build_public_catalog(rows, include_unverified=False):
    linked = [row for row in rows if has_source_url(row)]
    result = build_catalog(rows if include_unverified else linked)
    result.update(ingested_postings=len(rows), linked_postings=len(linked),
                  unlinked_postings=len(rows) - len(linked), include_unverified=include_unverified)
    result['scope_note'] = (
        '仅看附原始链接的招聘；链接可追溯不等于内容已逐条核验。'
        if not include_unverified else
        '已包含缺少原始链接的待核验记录；不能将其直接作为论文真实招聘样本。'
    ) + ' 技能由原始标签同义归一，按招聘去重统计。'
    return result
