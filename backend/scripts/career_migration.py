"""Print reviewed SQL or explicitly apply it; never runs from API startup."""
import argparse
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply',action='store_true',help='Explicitly apply additive career tables to DATABASE_URL')
    args=parser.parse_args()
    path=Path(__file__).resolve().parents[1]/'sql/career_assistant.sql'
    sql=path.read_text(encoding='utf-8')
    if not args.apply:
        print(sql);return
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[1]/'.env')
    from database import engine
    if engine.dialect.name!='mysql':
        raise SystemExit('Production migration expects MySQL. Use career_schema.metadata only in isolated tests.')
    statements=[s.strip() for s in '\n'.join(line for line in sql.splitlines() if not line.lstrip().startswith('--')).split(';') if s.strip()]
    with engine.begin() as connection:
        from sqlalchemy import inspect
        for statement in statements:
            if statement.startswith('CREATE INDEX '):
                parts=statement.split()
                name,table=parts[2],parts[4]
                if name in {i['name'] for i in inspect(connection).get_indexes(table)}:continue
            connection.exec_driver_sql(statement)
    print('小星资料表已创建；未修改原有岗位、用户和简历内容。')


if __name__=='__main__':main()
