"""
技能名归一化迁移脚本
将数据库中所有技能名统一为 canonical_name 标准形式
运行: python migrate_skills.py
"""
import sys, os
sys.stdout.reconfigure(encoding='utf-8')

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import text
from sqlalchemy.orm import Session
from database import engine
from services.skill_synonyms import canonical_name


def migrate_table(session: Session, table: str, column: str):
    """归一化单张表的技能名"""
    rows = session.execute(text(f'SELECT DISTINCT {column} FROM {table}')).fetchall()
    changes = []
    for (raw_name,) in rows:
        normalized = canonical_name(raw_name)
        if normalized != raw_name:
            changes.append((raw_name, normalized))

    if not changes:
        print(f'  {table}.{column}: 无需迁移')
        return 0

    count = 0
    for old, new in changes:
        result = session.execute(
            text(f'UPDATE {table} SET {column} = :new WHERE {column} = :old'),
            {'new': new, 'old': old}
        )
        affected = result.rowcount
        count += affected
        print(f'  {table}.{column}: "{old}" -> "{new}" ({affected} 行)')

    session.commit()
    print(f'  {table}.{column}: 共更新 {count} 行')
    return count


def migrate_json_skills(session: Session):
    """归一化 diagnosis_history.skills JSON 字段中的技能名"""
    import json
    rows = session.execute(text('SELECT id, skills FROM diagnosis_history WHERE skills IS NOT NULL')).fetchall()
    count = 0
    for (row_id, skills_json) in rows:
        try:
            skills = json.loads(skills_json) if isinstance(skills_json, str) else skills_json
        except Exception:
            continue
        if not isinstance(skills, list):
            continue
        new_skills = [canonical_name(s) for s in skills if s]
        if new_skills != skills:
            session.execute(
                text('UPDATE diagnosis_history SET skills = :s WHERE id = :id'),
                {'s': json.dumps(new_skills, ensure_ascii=False), 'id': row_id}
            )
            count += 1
    if count:
        session.commit()
    print(f'  diagnosis_history.skills: 更新 {count} 条 JSON')
    return count


def migrate_jobs_skill_tags(session: Session):
    """归一化 jobs.skill_tags JSON 数组中的每个技能名"""
    import json
    rows = session.execute(text('SELECT id, skill_tags FROM jobs WHERE skill_tags IS NOT NULL')).fetchall()
    count = 0
    for (row_id, tags_json) in rows:
        try:
            tags = json.loads(tags_json) if isinstance(tags_json, str) else tags_json
        except Exception:
            continue
        if not isinstance(tags, list):
            continue
        new_tags = [canonical_name(t) for t in tags if t]
        if new_tags != tags:
            session.execute(
                text('UPDATE jobs SET skill_tags = :t WHERE id = :id'),
                {'t': json.dumps(new_tags, ensure_ascii=False), 'id': row_id}
            )
            count += 1
    if count:
        session.commit()
    print(f'  jobs.skill_tags: 更新 {count} 个岗位的技能标签')
    return count


def main():
    total = 0
    with Session(engine) as session:
        print('=== 迁移 user_skills ===')
        total += migrate_table(session, 'user_skills', 'skill_name')

        print('\n=== 迁移 skill_resources ===')
        total += migrate_table(session, 'skill_resources', 'skill_name')

        print('\n=== 迁移 jobs.skill_tags (JSON) ===')
        total += migrate_jobs_skill_tags(session)

        print('\n=== 迁移 diagnosis_history.skills (JSON) ===')
        total += migrate_json_skills(session)

        # 验证结果
        print('\n=== 验证 ===')
        for table, col in [('user_skills', 'skill_name'), ('skill_resources', 'skill_name')]:
            rows = session.execute(text(f'SELECT DISTINCT {col} FROM {table} ORDER BY {col}')).fetchall()
            names = [r[0] for r in rows]
            print(f'  {table}: {names}')
        # 验证 jobs 样例
        rows = session.execute(text('SELECT id, skill_tags FROM jobs LIMIT 3')).fetchall()
        for r in rows:
            print(f'  jobs id={r[0]}: {r[1][:100]}')

    print(f'\n迁移完成，共处理 {total} 条记录')


if __name__ == '__main__':
    main()
