"""Preview by default; --apply publishes a versioned graph without deleting legacy data."""
import argparse
import json
import os
import re
from sqlalchemy import text
from database import engine, get_neo4j_driver
from services.job_graph_model import compile_postings, sync_projection


def load_sql_inputs():
    schema=os.getenv('COLLECTOR_DB_NAME','talent_map')
    if not re.fullmatch('[A-Za-z0-9_]+',schema):raise ValueError('invalid collector schema')
    with engine.connect() as c:
        c.execute(text('SET TRANSACTION READ ONLY'))
        raw=[dict(r) for r in c.execute(text(f'SELECT * FROM `{schema}`.job_raw')).mappings()]
        clean=[dict(r) for r in c.execute(text(f'SELECT * FROM `{schema}`.job_info')).mappings()]
        jobs=[dict(r) for r in c.execute(text('SELECT * FROM jobs WHERE data_type=1')).mappings()]
        c.rollback()
    return raw,jobs,clean


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--apply',action='store_true')
    args=parser.parse_args()
    model=compile_postings(*load_sql_inputs())
    if args.apply:
        result=sync_projection(get_neo4j_driver(),model)
    else:
        result={'status':'preview','dataset_id':model['dataset_id'],**model['stats'],
                'domains':len(model['domains']),'roles':len(model['roles']),'skills':len(model['skills']),
                'requirements':len(model['requirements'])}
    print(json.dumps(result,ensure_ascii=False))


if __name__=='__main__':main()
