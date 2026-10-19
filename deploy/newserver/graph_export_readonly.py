"""Run inside the old API container; stdout is a private JSONL backup stream."""
import base64,datetime,json,os,sys
from neo4j import GraphDatabase,READ_ACCESS,Query
from neo4j.time import Date,DateTime,Time,Duration
from neo4j.spatial import Point

def encode(value):
    if isinstance(value,DateTime):return {'$neo4j':'DateTime','value':value.iso_format()}
    if isinstance(value,Date):return {'$neo4j':'Date','value':value.iso_format()}
    if isinstance(value,Time):return {'$neo4j':'Time','value':value.iso_format()}
    if isinstance(value,Duration):return {'$neo4j':'Duration','months':value.months,'days':value.days,'seconds':value.seconds,'nanoseconds':value.nanoseconds}
    if isinstance(value,Point):return {'$neo4j':'Point','srid':value.srid,'coordinates':list(value)}
    if isinstance(value,(bytes,bytearray)):return {'$neo4j':'Bytes','value':base64.b64encode(value).decode()}
    if isinstance(value,dict):return {k:encode(v) for k,v in value.items()}
    if isinstance(value,(list,tuple)):return [encode(v) for v in value]
    if isinstance(value,(datetime.datetime,datetime.date,datetime.time)):return {'$neo4j':'Native'+type(value).__name__,'value':value.isoformat()}
    return value

def emit(value):print(json.dumps(encode(value),ensure_ascii=False,separators=(',',':')),flush=False)

def main():
    driver=GraphDatabase.driver(os.environ['NEO4J_URI'],auth=(os.environ.get('NEO4J_USER','neo4j'),os.environ['NEO4J_PASSWORD']),connection_timeout=10)
    with driver.session(database=os.environ.get('NEO4J_DATABASE','neo4j'),default_access_mode=READ_ACCESS,fetch_size=500) as session:
        start=datetime.datetime.now(datetime.timezone.utc).isoformat()
        before={'nodes':session.run('MATCH (n) RETURN count(n) AS n').single()['n'],'relationships':session.run('MATCH ()-[r]->() RETURN count(r) AS n').single()['n']}
        emit({'kind':'header','format_version':1,'started_at':start,'source_counts_before':before,
              'indexes':session.run('SHOW INDEXES YIELD * RETURN *').data(),
              'constraints':session.run('SHOW CONSTRAINTS YIELD * RETURN *').data(),
              'source_continues_running':True,'consistency':'online read committed; not a frozen production snapshot'})
        node_count=rel_count=0
        for record in session.run(Query('MATCH (n) RETURN elementId(n) AS id, labels(n) AS labels, properties(n) AS properties',timeout=180)):
            emit({'kind':'node',**dict(record)});node_count+=1
        for record in session.run(Query('MATCH (a)-[r]->(b) RETURN elementId(a) AS start, elementId(b) AS end, type(r) AS type, properties(r) AS properties',timeout=180)):
            emit({'kind':'relationship',**dict(record)});rel_count+=1
        after={'nodes':session.run('MATCH (n) RETURN count(n) AS n').single()['n'],'relationships':session.run('MATCH ()-[r]->() RETURN count(r) AS n').single()['n']}
        emit({'kind':'footer','finished_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exported_nodes':node_count,'exported_relationships':rel_count,'source_counts_after':after,'topology_counts_stable':before==after})
    driver.close()

if __name__=='__main__':
    try:main()
    except Exception as exc:
        print('GRAPH_EXPORT_FAILED '+type(exc).__name__,file=sys.stderr)
        raise SystemExit(1)
