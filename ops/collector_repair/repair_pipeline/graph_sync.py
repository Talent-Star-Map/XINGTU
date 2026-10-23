"""Non-destructive legacy quarantine and canonical SQL-id graph projection."""
from datetime import datetime
import json
import os
from pathlib import Path

from neo4j import GraphDatabase
import pymysql
from sync.job_sync import get_server_connection
from .role_catalog import classify_title
from .skill_synonyms import canonical_name


def sync_graph(migrate=False):
    c=get_server_connection()
    try:
        with c.cursor(pymysql.cursors.DictCursor) as q:
            q.execute('SELECT id,title,source,source_url,company_name,city,job_description,skill_tags,experience,education,salary_min,salary_max FROM jobs WHERE data_type=1')
            jobs=q.fetchall()
    finally:
        c.close()
    driver=GraphDatabase.driver(os.environ['NEO4J_URI'],auth=(os.environ['NEO4J_USER'],os.environ['NEO4J_PASSWORD']))
    counts={'jobs':len(jobs),'quarantined':0,'status':'succeeded'}
    try:
        with driver.session() as s:
            if migrate:
                legacy=s.run('MATCH (j:Job) WHERE j.id IS NULL AND j.job_id IS NOT NULL RETURN elementId(j) AS element_id, labels(j) AS labels, properties(j) AS properties').data()
                clusters=s.run('MATCH (c:Cluster) WHERE c.managed_by IS NULL RETURN elementId(c) AS element_id,labels(c) AS labels,properties(c) AS properties').data()
                folder=Path('/app/logs/repair_backups'); folder.mkdir(exist_ok=True)
                path=folder/f'graph_labels_before_{datetime.utcnow():%Y%m%dT%H%M%S}.json'
                path.write_text(json.dumps({'jobs':legacy,'clusters':clusters},ensure_ascii=False,default=str),encoding='utf-8')
                path.chmod(0o600)
                s.run('MATCH (j:Job) WHERE j.id IS NULL AND j.job_id IS NOT NULL SET j:LegacyImportedJob REMOVE j:Job').consume()
                s.run('MATCH (c:Cluster) WHERE c.managed_by IS NULL SET c:LegacyCluster REMOVE c:Cluster').consume()
                counts['quarantined']=len(legacy)
            payload=[]
            for job in jobs:
                match=classify_title(job['title'])
                raw=job.pop('skill_tags') or []
                skills=json.loads(raw) if isinstance(raw,str) else raw
                props={k:v for k,v in job.items() if v is not None}
                props['data_type']=1
                props['synced_at']=datetime.utcnow().isoformat()+'Z'
                payload.append({'props':props,'skills':sorted({canonical_name(x) for x in skills if isinstance(x,str) and x.strip()}),
                                'role':match[1] if match else None,'family':match[0] if match else None})
            for start in range(0,len(payload),100):
                batch=payload[start:start+100]
                s.run('UNWIND $rows AS row MERGE (j:Job {id:row.props.id}) SET j += row.props',rows=batch).consume()
                s.run('UNWIND $rows AS row MATCH (j:Job {id:row.props.id}) UNWIND row.skills AS name MERGE (sk:Skill {name:name}) MERGE (j)-[r:REQUIRES]->(sk) SET r.evidence_source="sql_skill_tags"',rows=batch).consume()
                s.run('UNWIND $rows AS row WITH row WHERE row.role IS NOT NULL MATCH (j:Job {id:row.props.id}) MERGE (c:Cluster {id:"catalog:"+row.role}) SET c.canonical_name=row.role,c.family=row.family,c.managed_by="repair_pipeline_v1" MERGE (j)-[r:BELONGS_TO]->(c) SET r.managed_by="repair_pipeline_v1"',rows=batch).consume()
            s.run('MATCH (c:Cluster {managed_by:"repair_pipeline_v1"}) OPTIONAL MATCH (c)<-[:BELONGS_TO]-(j:Job) WITH c,count(DISTINCT j) AS n SET c.member_count=n').consume()
            counts['graph_jobs']=s.run('MATCH (j:Job) RETURN count(j) AS n').single()['n']
        return counts
    finally:
        driver.close()


if __name__=='__main__':
    import sys
    print(json.dumps(sync_graph(migrate='--migrate' in sys.argv)))
