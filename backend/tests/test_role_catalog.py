"""Regression checks for evidence-backed role browsing and count semantics."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.role_catalog import build_catalog, classify_title, filter_catalog_rows


assert classify_title('RAG应用工程师') == ('人工智能与大模型', '智能体与RAG应用')
assert classify_title('Python开发工程师') == ('软件研发', 'Python开发与爬虫')
assert classify_title('自动驾驶算法工程师') == ('智能硬件与物联网', '机器人与自动驾驶')
assert classify_title('嵌入式C++工程师') == ('智能硬件与物联网', '嵌入式与IoT')
assert classify_title('C照货运司机') is None

rows = [
    {'title': 'RAG应用工程师', 'skill_tags': ['Python', 'RAG', 'RAG'], 'company_name': 'A', 'source': 'S1'},
    {'title': 'RAG应用工程师', 'skill_tags': '["Python", "LangChain"]', 'company_name': 'A', 'source': 'S1'},
    {'title': '智能体开发工程师', 'skill_tags': ['Python'], 'company_name': 'B', 'source': 'S2'},
    {'title': 'C照货运司机', 'skill_tags': ['Python'], 'company_name': 'C', 'source': 'S2'},
]
result = build_catalog(rows)
assert result['catalog_postings'] == 4
assert result['included_postings'] == 3
assert result['excluded_postings'] == 1
assert result['title_count'] == 2
role = result['roles'][0]
assert role['postings'] == 3 and role['employers'] == 2
assert role['distinct_titles'] == 2
assert {x['name']: x['count'] for x in role['skills']} == {'Python': 3, 'RAG': 1, 'LangChain': 1}
print('PASS: domain classification, out-of-scope filtering, posting and skill counts')
sample = [
    {'title': '高级 Java 开发工程师', 'skill_tags': ['Java']},
    {'title': 'Java 开发工程师', 'skill_tags': ['Java']},
    {'title': 'Python 实习工程师', 'skill_tags': ['Python']},
]
assert len(filter_catalog_rows(sample, 'Java', 'senior')) == 1
assert len(filter_catalog_rows(sample, 'Java', 'unknown')) == 1
assert len(filter_catalog_rows(sample, 'Python', 'entry')) == 1
print('PASS: technology and explicit seniority filters')
