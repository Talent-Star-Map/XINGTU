"""Private on-server logical backups. No deletion and no off-site guarantee."""
from pathlib import Path
import datetime,gzip,hashlib,json,os,shutil,subprocess
from zoneinfo import ZoneInfo

BASE=Path('/data/xingtu')
def env(name):return dict(x.split('=',1) for x in (BASE/'secrets'/name).read_text().splitlines() if '=' in x)
def export(args,path,program=None,already_gzip=False):
    partial=path.with_name(path.name+'.partial')
    with partial.open('wb') as raw:
        partial.chmod(0o600)
        p=subprocess.Popen(args,stdin=subprocess.PIPE if program else subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        if program:p.stdin.write(program.encode());p.stdin.close()
        output=raw if already_gzip else gzip.GzipFile(fileobj=raw,mode='wb',compresslevel=1)
        try:
            while block:=p.stdout.read(1024*1024):output.write(block)
        finally:
            if output is not raw:output.close()
        error=p.stderr.read();status=p.wait(timeout=60)
        if status:raise RuntimeError('Backup export failed; exit '+str(status)+'; partial file retained')
    partial.rename(path)
    return {'path':str(path),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
def main():
    os.umask(0o077)
    assert Path('/data').is_mount()
    if shutil.disk_usage('/data').free<20*1024**3:raise RuntimeError('Data disk has less than 20GiB free; existing backups preserved')
    mysql=env('mysql.env');mongo=env('mongo.env')
    stamp=datetime.datetime.now(ZoneInfo('Asia/Shanghai')).strftime('%Y%m%d_%H%M%S')
    folder=Path('/data/backups/daily')/stamp;folder.mkdir(parents=True,mode=0o700)
    result={'started_at':datetime.datetime.now().astimezone().isoformat(),'consistency':'online logical backups; engines are not a coordinated frozen snapshot','off_site_backup':False,'exports':{}}
    result['exports']['mysql']=export(['docker','exec','-e','MYSQL_PWD='+mysql['MYSQL_ROOT_PASSWORD'],'xingtu-mysql','mysqldump','-uroot','--single-transaction','--skip-lock-tables','--no-tablespaces','--set-gtid-purged=OFF','--routines','--events','--triggers','--hex-blob','--default-character-set=utf8mb4','--databases','talent_map','xingtu'],folder/'mysql.sql.gz')
    for db in ['xingtu_raw','xingtu_analyzed']:
        args=['docker','exec','xingtu-mongo','mongodump','--archive','--gzip','--db',db,'--username',mongo['MONGO_INITDB_ROOT_USERNAME'],'--password',mongo['MONGO_INITDB_ROOT_PASSWORD'],'--authenticationDatabase','admin']
        result['exports'][db]=export(args,folder/(db+'.archive.gz'),already_gzip=True)
    result['exports']['neo4j']=export(['docker','exec','-i','xingtu-api','python','-'],folder/'neo4j.jsonl.gz',program=(BASE/'graph_export_readonly.py').read_text())
    result.update(completed_at=datetime.datetime.now().astimezone().isoformat(),status='COMPLETE',backup_directory=str(folder))
    (folder/'manifest.json').write_text(json.dumps(result,indent=2));(BASE/'latest_backup_result.json').write_text(json.dumps(result,indent=2))
    print(json.dumps({'status':'COMPLETE','backup_directory':str(folder),'files':len(result['exports']),'bytes':sum(v['bytes'] for v in result['exports'].values())}))
if __name__=='__main__':main()
