"""Read-only coverage summary for the live role catalog."""
from collections import Counter
from dotenv import load_dotenv

load_dotenv()
from database import CrawledJob, SessionLocal
from services.role_catalog import build_catalog, classify_title, _skill_list


def main():
    with SessionLocal() as session:
        records = (session.query(CrawledJob.title, CrawledJob.skill_tags,
                                 CrawledJob.company_name, CrawledJob.source,
                                 CrawledJob.source_url, CrawledJob.job_description)
                   .filter(CrawledJob.data_type == 1, CrawledJob.title.isnot(None))
                   .all())
        rows = [dict(row._mapping) for row in records]
    catalog = build_catalog(rows)
    relevant = [row for row in rows if classify_title(row['title'])]
    print('relevant with source URL', sum(bool(row['source_url']) for row in relevant),
          'without URL', sum(not row['source_url'] for row in relevant))
    print('sources', Counter(row['source'] for row in relevant).most_common(12))
    print('sources_ascii', [(str(name).encode('unicode_escape').decode('ascii'), count)
                            for name, count in Counter(row['source'] for row in relevant).most_common(12)])
    print('linked_by_source', [(str(name).encode('unicode_escape').decode('ascii'), count)
                               for name, count in Counter(row['source'] for row in relevant if row['source_url']).most_common(12)])
    print('descriptions present', sum(bool(row['job_description']) for row in relevant))
    missing_link = [row for row in relevant if not row['source_url']]
    descriptions = Counter(str(row['job_description'] or '') for row in missing_link)
    print('unlinked description distinct', len(descriptions),
          'most_common_counts', [count for _, count in descriptions.most_common(10)])
    print('relevant without skill tags', sum(not _skill_list(row['skill_tags']) for row in relevant),
          'with skill tags', sum(bool(_skill_list(row['skill_tags'])) for row in relevant))
    print('total', catalog['catalog_postings'], 'included', catalog['included_postings'],
          'excluded', catalog['excluded_postings'], 'roles', catalog['role_count'],
          'titles', catalog['title_count'])
    for family in catalog['families']:
        print(family['name'], family['postings'], family['roles'])
    print('largest roles', [(item['name'], item['postings']) for item in catalog['roles'][:12]])
    known = Counter(title['name'] for item in catalog['roles'] for title in item['titles'])
    print('sample labels', list(known)[:30])


if __name__ == '__main__':
    main()
