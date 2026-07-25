"""
JD爬虫 — 从招聘网站采集真实岗位数据用于标注和测试

用法：
  python jd_scraper.py boss       # 爬取 Boss 直聘 JD
  python jd_scraper.py lagou      # 爬取拉勾 JD
  python jd_scraper.py sample 100 # 用内置模板生成 100 条模拟 JD

输出：test_data/scraped_jds.json

@owner: 静怡、议桓（多源异构数据采集）
"""

import requests
import json, os, time, re, random
from datetime import datetime

# test_data 目录在 backend/ 根，需向上跳一层
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'test_data')
os.makedirs(OUTPUT_DIR, exist_ok=True)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
}

# ─── Boss 直聘爬虫（通过 API） ───

def scrape_boss(keywords: list[str] = None, count: int = 50):
    """爬取 Boss 直聘推荐接口"""
    if keywords is None:
        keywords = ['Java', 'Python', '前端', 'AI', '大数据', '云原生', 'Go', '测试', '算法', '产品', '架构', '安全']

    jds = []
    seen = set()

    for kw in keywords:
        if len(jds) >= count:
            break
        page = 1
        while len(jds) < count and page <= 5:
            try:
                url = f'https://www.zhipin.com/wapi/zpgeek/search/joblist.json?query={kw}&page={page}&pageSize=20&city=100010000'
                resp = requests.get(url, headers=HEADERS, timeout=15)
                if resp.status_code == 200:
                    data = resp.json()
                    items = data.get('zpData', {}).get('jobList', [])
                    if not items:
                        break
                    for item in items:
                        jid = item.get('jobId')
                        if jid in seen:
                            continue
                        seen.add(jid)
                        jds.append({
                            'id': f'boss_{jid}',
                            'title': item.get('jobName', ''),
                            'company': item.get('brandName', ''),
                            'location': item.get('cityName', '') + '·' + (item.get('areaDistrict', '') or ''),
                            'salary': item.get('salaryDesc', ''),
                            'experience': item.get('jobExperience', ''),
                            'education': item.get('jobDegree', ''),
                            'description': item.get('postDescription', '') or item.get('jobDescription', ''),
                            'skills': [],  # 待标注
                            'source': 'Boss直聘',
                            'collected_at': datetime.now().isoformat(),
                        })
                        if len(jds) >= count:
                            break
                else:
                    print(f'  Boss API {kw} page {page}: HTTP {resp.status_code}')
                    # 可能被反爬，等一等
                    time.sleep(5)
                page += 1
                time.sleep(random.uniform(1.5, 3))
            except Exception as e:
                print(f'  错误: {e}')
                time.sleep(5)
                page += 1

    return jds


# ─── 拉勾爬虫 ───

def scrape_lagou(keywords: list[str] = None, count: int = 50):
    """爬取拉勾招聘"""
    if keywords is None:
        keywords = ['Java', 'Python', '前端', 'AI', '大数据', 'Go']

    jds = []
    seen = set()

    for kw in keywords:
        if len(jds) >= count:
            break
        page = 1
        while len(jds) < count and page <= 3:
            try:
                url = f'https://www.lagou.com/wn/zhaopin?kd={kw}&pn={page}'
                resp = requests.get(url, headers={**HEADERS, 'Referer': 'https://www.lagou.com/'}, timeout=15)
                # 拉勾主要数据通过 XHR 加载
                api_url = f'https://www.lagou.com/jobs/v2/positionAjax.json?needAddtionalResult=false&first=true&pn={page}&kd={kw}'
                api_resp = requests.get(api_url, headers={
                    **HEADERS,
                    'Referer': 'https://www.lagou.com/wn/',
                    'Origin': 'https://www.lagou.com',
                }, timeout=15, cookies=resp.cookies)
                if api_resp.status_code == 200:
                    data = api_resp.json()
                    items = data.get('content', {}).get('positionResult', {}).get('result', [])
                    if not items:
                        break
                    for item in items:
                        pid = item.get('positionId')
                        if pid in seen:
                            continue
                        seen.add(pid)
                        jds.append({
                            'id': f'lagou_{pid}',
                            'title': item.get('positionName', ''),
                            'company': item.get('companyFullName', ''),
                            'location': item.get('city', '') + '·' + (item.get('district', '') or ''),
                            'salary': item.get('salary', ''),
                            'experience': item.get('workYear', ''),
                            'education': item.get('education', ''),
                            'description': item.get('positionDetail', '') or item.get('positionAdvantage', ''),
                            'skills': [],
                            'source': '拉勾',
                            'collected_at': datetime.now().isoformat(),
                        })
                else:
                    print(f'  拉勾 API {kw} page {page}: HTTP {api_resp.status_code}')
                    break
                page += 1
                time.sleep(random.uniform(3, 6))
            except Exception as e:
                print(f'  错误: {e}')
                break

    return jds


# ─── 模拟 JD 生成（兜底方案，当爬虫被反爬时保证有数据） ───

SKILL_POOL = {
    'Java后端': ['Java', 'Spring Boot', 'MyBatis', 'MySQL', 'Redis', 'Docker', 'Kubernetes', '微服务', '分布式', 'RabbitMQ', 'Git', 'Linux', 'Nginx', '高并发', 'JVM'],
    'Python后端': ['Python', 'Django', 'Flask', 'FastAPI', 'PostgreSQL', 'Redis', 'Docker', 'Kubernetes', 'Elasticsearch', '微服务', 'Git', 'Linux', 'Celery'],
    '前端': ['React', 'Vue', 'TypeScript', 'JavaScript', 'HTML', 'CSS', 'Node.js', 'Webpack', 'Git', 'Nginx', 'Docker', '小程序'],
    'AI/ML': ['Python', 'PyTorch', 'TensorFlow', '大模型', 'NLP', 'CV', 'RAG', 'LangChain', 'Agent', 'Docker', 'Kubernetes', 'Linux', 'Git'],
    '大数据': ['Python', 'Spark', 'Flink', 'Kafka', 'Hadoop', 'Hive', 'MySQL', 'Redis', 'Elasticsearch', 'Docker', 'Linux', 'Git'],
    '云原生': ['Docker', 'Kubernetes', 'Go', 'Python', 'Linux', 'Jenkins', 'AWS', 'Terraform', 'Nginx', '微服务', 'CI/CD', 'Git'],
    '测试': ['Python', 'Java', 'Selenium', 'JMeter', 'Jenkins', 'Docker', 'Linux', 'MySQL', 'Git', 'CI/CD', 'Postman'],
    'Go后端': ['Go', 'Redis', 'MySQL', 'Kafka', 'Docker', 'Kubernetes', '微服务', '分布式', 'Git', 'Linux', 'gRPC', 'Nginx'],
}

COMPANIES = ['字节跳动', '腾讯', '阿里巴巴', '美团', '百度', '华为', '网易', '京东', '小红书', '滴滴出行', '蚂蚁集团', '快手', 'B站', '商汤科技', '科大讯飞']
LOCATIONS = ['北京', '上海', '深圳', '杭州', '广州', '成都', '武汉', '南京']
EDUCATIONS = ['本科', '硕士', '本科', '本科', '硕士', '本科', '不限']

def generate_sample_jds(count: int = 100) -> list[dict]:
    """生成指定数量的模拟 JD"""
    jds = []
    for i in range(count):
        cat = random.choice(list(SKILL_POOL.keys()))
        skills_pool = SKILL_POOL[cat]
        k = random.randint(6, min(len(skills_pool), 12))
        skills = random.sample(skills_pool, k)

        desc_templates = [
            f'负责{cat}核心系统设计与开发，参与高并发分布式架构优化，保障系统稳定性和可扩展性。',
            f'参与公司{cat}技术方案设计，负责模块开发与性能优化，推动技术栈升级。',
            f'负责{cat}相关功能迭代，参与需求评审、技术方案设计、代码实现、测试上线全流程。',
            f'负责{cat}平台建设，包括架构设计、核心模块开发、性能调优和团队协作。',
            f'作为{cat}方向核心开发，参与业务需求分析，负责技术方案落地与代码质量把控。',
        ]

        desc = random.choice(desc_templates) + f' 要求熟练掌握相关技术栈，有{random.randint(1,5)}年以上相关工作经验者优先。'
        if random.random() > 0.5:
            desc += f' 熟悉{random.choice(skills[:3])}者加分。'

        jds.append({
            'id': f'sample_{i+1:03d}',
            'title': f'{cat}工程师',
            'company': random.choice(COMPANIES),
            'location': random.choice(LOCATIONS),
            'salary': f'{random.randint(15,40)}K-{random.randint(30,60)}K',
            'experience': f'{random.randint(1,5)}-{random.randint(3,8)}年',
            'education': random.choice(EDUCATIONS),
            'description': desc,
            'skills': skills,  # 标准答案
            'skill_category': cat,
            'source': '模拟数据',
            'collected_at': datetime.now().isoformat(),
        })
    return jds


def main():
    import sys
    mode = sys.argv[1] if len(sys.argv) > 1 else 'sample'
    count = int(sys.argv[2]) if len(sys.argv) > 2 else 100

    print(f'开始采集 JD 数据: mode={mode}, count={count}')

    if mode == 'boss':
        jds = scrape_boss(count=count)
    elif mode == 'lagou':
        jds = scrape_lagou(count=count)
    else:
        # 兜底：生成模拟数据
        print('使用模拟JD生成（爬虫可能被反爬，模拟数据可替代测试）')
        jds = generate_sample_jds(count)

    # 去重
    seen_ids = set()
    unique = []
    for j in jds:
        if j['id'] not in seen_ids:
            seen_ids.add(j['id'])
            unique.append(j)

    path = os.path.join(OUTPUT_DIR, 'scraped_jds.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(unique, f, ensure_ascii=False, indent=2)

    # 同时生成标准答案文件
    answers = [{'id': j['id'], 'title': j['title'], 'skills': j.get('skills', [])} for j in unique]
    ans_path = os.path.join(OUTPUT_DIR, 'standard_answers.json')
    with open(ans_path, 'w', encoding='utf-8') as f:
        json.dump(answers, f, ensure_ascii=False, indent=2)

    print(f'采集完成: {len(unique)} 条 JD → {path}')
    print(f'标准答案: {ans_path}')
    print(f'其中有技能标注的: {sum(1 for j in unique if j.get("skills"))} 条')


if __name__ == '__main__':
    main()
