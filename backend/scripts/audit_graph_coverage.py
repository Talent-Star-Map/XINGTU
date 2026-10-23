"""Read-only audit of real posting coverage and current title clusters."""
from collections import Counter, defaultdict
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / '.env')

from sqlalchemy import text
from database import SessionLocal
from scripts.cluster_jobs import canonicalize


def main():
    with SessionLocal() as session:
        rows = session.execute(text("SELECT id, title, source, skill_tags FROM jobs WHERE data_type=1 AND title IS NOT NULL")).mappings().all()
    clusters, families, unmatched = Counter(), Counter(), Counter()
    skills, titles = set(), set()
    for row in rows:
        title = str(row['title'] or '').strip()
        titles.add(title)
        cluster, family = canonicalize(title)
        clusters[cluster] += 1
        families[family] += 1
        if family == 'other':
            unmatched[title] += 1
        raw = row['skill_tags']
        try:
            tags = json.loads(raw) if isinstance(raw, str) else raw
        except (ValueError, TypeError):
            tags = []
        if isinstance(tags, list):
            skills.update(str(s).strip() for s in tags if str(s).strip())
    print(json.dumps({'postings': len(rows), 'distinct_titles': len(titles),
                      'distinct_skill_tags': len(skills),
                      'current_cluster_count': len(clusters),
                      'family_counts': families.most_common(),
                      'cluster_counts': clusters.most_common(),
                      'unmatched_titles_sample': unmatched.most_common(40)},
                     ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
