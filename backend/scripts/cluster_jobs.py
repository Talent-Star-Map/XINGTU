"""cluster_jobs.py — 岗位消歧 + 对齐

把 MySQL jobs 表的 title 语义归一化,生成 canonical cluster。

核心思路:
  - 用正则关键词把原始 title 映射到 canonical name
    例: "Java工程师" / "java开发工程师" / "JAVA开发" → "Java开发工程师"
  - 同 canonical = 同一个 cluster,记 member_count
  - 同步到 Neo4j: Cluster 节点 + Job-[:BELONGS_TO]->Cluster

用法:
  python -m scripts.cluster_jobs           # 全量
  python -m scripts.cluster_jobs --limit   # 限制条数试跑
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from collections import defaultdict
from typing import Dict, List, Tuple

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

import pymysql

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_neo4j_driver, DATABASE_URL


# ── canonical 映射规则(按优先级匹配,先 match 的赢) ──────────────────
# (pattern, canonical_name, tech_stack)
# tech_stack 对齐 _TECH_STACK_KEYWORDS(kg_service.py)
CLUSTER_RULES: List[Tuple[str, str, str]] = [
    # AI 类(细分匹配,优先级最高)
    (r'(大模型|llm|agent|rag|nlp|机器学习|深度学习|ai算法|算法工程师|大模型算法|推荐算法|搜索算法|ai开发)',         'AI/算法工程师',            'ai'),
    (r'(数据分析师|数据分析)',                                                                                  '数据分析师',              'ai'),
    # Java
    (r'(java|jvm)',                                                                                            'Java开发工程师',          'java'),
    # Python
    (r'(python|django|flask|fastapi)',                                                                         'Python开发工程师',        'python'),
    # 前端
    (r'(前端|frontend|vue|react|h5|web前端|html5|javascript)',                                                 '前端工程师',              'frontend'),
    # 后端
    (r'(后端|服务端|backend)',                                                                                  '后端工程师',              'backend'),
    # C/C++
    (r'(c\+\+|c#|\bc语言\b)',                                                                                  'C/C++工程师',             'backend'),
    # Go
    (r'(golang|\bgo(后端|开发)?\b)',                                                                            'Go开发工程师',            'backend'),
    # 大数据
    (r'(大数据|hadoop|spark|数仓|flink)',                                                                      '大数据工程师',            'bigdata'),
    # 测试
    (r'(测试|qa)',                                                                                             '测试工程师',              'test'),
    # 运维
    (r'(运维|devops|sre|dba|linux)',                                                                            '运维工程师',              'devops'),
    # 移动端
    (r'(android|ios|移动端|flutter|鸿蒙)',                                                                      '移动端工程师',            'mobile'),
    # 产品
    (r'(产品经理|product)',                                                                                    '产品经理',                'product'),
    # 设计
    (r'(设计师|\bui\b|\bue\b|\bux\b|交互设计|视觉设计)',                                                       '设计师',                  'design'),
    # 运营/销售
    (r'(运营)',                                                                                                 '运营',                    'other'),
    (r'(销售)',                                                                                                 '销售',                    'other'),
    # 全栈
    (r'(全栈)',                                                                                                 '全栈工程师',              'backend'),
    # 数据
    (r'(数据仓库|etl|数据治理)',                                                                                '数据工程师',              'bigdata'),
]


# 在标题末尾追加"工程师/实习生/学徒"等角色后缀时,做对齐
ROLE_SUFFIXES = [
    '工程师', '开发工程师', '实习生', '学徒', '专家', '架构师', '主管', '经理', '助理', '顾问',
]


def canonicalize(title: str) -> Tuple[str, str]:
    """把原始 title 映射到 (canonical_name, tech_stack)。无法归类的归为 '其他岗位'。"""
    t = (title or '').lower().strip()
    if not t:
        return ('其他岗位', 'other')
    for pat, name, ts in CLUSTER_RULES:
        if re.search(pat, t):
            return (name, ts)
    return ('其他岗位', 'other')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int, default=0, help='限制处理条数(0=全量)')
    ap.add_argument('--dry-run', action='store_true', help='只统计,不入库')
    args = ap.parse_args()

    # ── 1. 抽取 MySQL jobs ──
    print('[1/4] 抽取 MySQL jobs ...')
    conn = pymysql.connect(
        host='180.76.227.159', port=3308, user='root', password='Xingtu123',
        database='xingtu', charset='utf8mb4', connect_timeout=10,
    )
    with conn.cursor(pymysql.cursors.DictCursor) as cur:
        sql = 'SELECT id, title, skill_tags, source FROM jobs WHERE data_type=1 AND title IS NOT NULL'
        if args.limit:
            sql += f' LIMIT {args.limit}'
        cur.execute(sql)
        rows = cur.fetchall()
    print(f'   {len(rows)} 条')

    # ── 2. 归一化聚类 ──
    print('[2/4] 归一化聚类 ...')
    cluster_members: Dict[Tuple[str, str], List[int]] = defaultdict(list)
    for r in rows:
        canon, ts = canonicalize(r['title'])
        cluster_members[(canon, ts)].append(r['id'])

    print(f'   {len(cluster_members)} 个 cluster')
    total_classified = sum(len(v) for v in cluster_members.values())
    print(f'   覆盖 {total_classified} / {len(rows)} ({100*total_classified/max(len(rows),1):.1f}%)')
    print('--- cluster 分布 Top 20 ---')
    sorted_clusters = sorted(cluster_members.items(), key=lambda kv: -len(kv[1]))
    for (canon, ts), ids in sorted_clusters[:20]:
        print(f'  {len(ids):4d} | {canon:20s} | {ts:10s}')

    if args.dry_run:
        return

    # ── 3. 写 MySQL cluster 表 ──
    print('[3/4] 写入 MySQL job_clusters ...')
    with conn.cursor() as cur:
        cur.execute('DROP TABLE IF EXISTS job_cluster_members')
        cur.execute('DROP TABLE IF EXISTS job_clusters')
        cur.execute('''
            CREATE TABLE job_clusters (
                id INT PRIMARY KEY AUTO_INCREMENT,
                canonical_name VARCHAR(100) NOT NULL,
                tech_stack VARCHAR(50) NOT NULL,
                member_count INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uk_cluster (canonical_name, tech_stack),
                INDEX idx_tech (tech_stack)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ''')
        cur.execute('''
            CREATE TABLE job_cluster_members (
                job_id BIGINT PRIMARY KEY,
                cluster_id INT NOT NULL,
                INDEX idx_cluster (cluster_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ''')
        cluster_id_map: Dict[Tuple[str, str], int] = {}
        for (canon, ts), ids in sorted_clusters:
            cur.execute(
                'INSERT INTO job_clusters (canonical_name, tech_stack, member_count) VALUES (%s, %s, %s)',
                (canon, ts, len(ids)),
            )
            cid = cur.lastrowid
            cluster_id_map[(canon, ts)] = cid
        for (canon, ts), ids in sorted_clusters:
            cid = cluster_id_map[(canon, ts)]
            for jid in ids:
                cur.execute('INSERT INTO job_cluster_members (job_id, cluster_id) VALUES (%s, %s)', (jid, cid))
    conn.commit()
    print(f'   job_clusters: {len(cluster_id_map)} 行')
    print(f'   job_cluster_members: {sum(len(v) for v in cluster_members.values())} 行')

    # ── 4. 同步到 Neo4j ──
    print('[4/4] 同步到 Neo4j Cluster 节点 + BELONGS_TO ...')
    driver = get_neo4j_driver()
    with driver.session() as s:
        # 先清理旧 cluster / BELONGS_TO(可重入)
        s.run('MATCH (c:Cluster) DETACH DELETE c')
        s.run('CREATE CONSTRAINT cluster_id IF NOT EXISTS FOR (c:Cluster) REQUIRE c.id IS UNIQUE')

        # 写 cluster 节点
        for (canon, ts), ids in sorted_clusters:
            cid = cluster_id_map[(canon, ts)]
            s.run('''
                MERGE (c:Cluster {id: $cid})
                SET c.canonical_name = $canon,
                    c.tech_stack = $ts,
                    c.member_count = $cnt
            ''', cid=cid, canon=canon, ts=ts, cnt=len(ids))

        # 写 BELONGS_TO
        for (canon, ts), ids in sorted_clusters:
            cid = cluster_id_map[(canon, ts)]
            s.run('''
                MATCH (j:Job {id: $jid}), (c:Cluster {id: $cid})
                MERGE (j)-[r:BELONGS_TO]->(c)
            ''', parameters={'jid': ids[0], 'cid': cid})  # placeholder
            # 上面的 parameters 写法 Neo4j 不支持批量,改成 UNWIND
            s.run('''
                UNWIND $ids AS jid
                MATCH (j:Job {id: jid}), (c:Cluster {id: $cid})
                MERGE (j)-[:BELONGS_TO]->(c)
            ''', ids=ids, cid=cid)
        print('   Cluster + BELONGS_TO 写入完成')

        # 校验
        r = s.run('MATCH (c:Cluster) RETURN count(c) AS n')
        print(f'   Neo4j Cluster 节点数: {r.single()["n"]}')
        r = s.run('MATCH ()-[r:BELONGS_TO]->() RETURN count(r) AS n')
        print(f'   Neo4j BELONGS_TO 边数: {r.single()["n"]}')
    driver.close()
    conn.close()
    print('✓ 全部完成')


if __name__ == '__main__':
    main()
