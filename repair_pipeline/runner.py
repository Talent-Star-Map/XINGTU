"""A single locked run with durable per-stage status and independent sources."""
import argparse
from datetime import datetime
import fcntl
import json
import os
import signal
import subprocess
from pathlib import Path
import sys

from database.mysql import get_connection
from sync.job_sync import get_server_connection, sync_jobs

def run_source(source, logs, max_details, max_pages, timeout):
    output = logs / (source + '_latest.json')
    if output.exists():
        output.unlink()
    command = [sys.executable, '-u', '-m', 'repair_pipeline.source_worker', source,
               '--max-details', str(max_details), '--max-pages', str(max_pages), '--output', str(output)]
    if source == 'zhilian':
        command = ['xvfb-run', '-a', '-s', '-screen 0 1280x900x24', *command]
    process = subprocess.Popen(command, start_new_session=True)
    try:
        process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGTERM)
        try:
            process.wait(timeout=15)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait()
        result = {'status': 'failed', 'reason': 'source_timeout', 'timeout_seconds': timeout}
        output.write_text(json.dumps(result), encoding='utf-8')
        return result
    if not output.exists():
        return {'status': 'failed', 'reason': 'worker_exited_without_result', 'exit_code': process.returncode}
    result = json.loads(output.read_text(encoding='utf-8'))
    if process.returncode and result.get('status') in ('succeeded', 'unchanged'):
        result = {'status': 'failed', 'reason': 'worker_exit_mismatch', 'exit_code': process.returncode}
    return result


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--max-details',type=int,default=500)
    parser.add_argument('--max-pages',type=int,default=10)
    parser.add_argument('--backfill',action='store_true')
    parser.add_argument('--skip-collection',action='store_true')
    parser.add_argument('--sources',default='tencent,zhilian')
    parser.add_argument('--zhilian-max-details',type=int,default=50)
    parser.add_argument('--source-timeout',type=int,default=1200)
    args=parser.parse_args()
    logs=Path('/app/logs'); logs.mkdir(exist_ok=True)
    lock=(logs/'job_pipeline.lock').open('a')
    try:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    except BlockingIOError:
        print('job pipeline already running; duplicate invocation skipped',flush=True)
        return 0
    result={'started_at_utc':datetime.utcnow().isoformat(),'stages':{},'status':'running'}
    def record():
        temp=logs/'pipeline_latest.tmp'
        temp.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        temp.replace(logs/'pipeline_latest.json')
    record()
    try:
        for factory in (get_connection,get_server_connection):
            connection=factory()
            with connection.cursor() as q: q.execute('SELECT 1')
            connection.close()
        result['stages']['database']='healthy'; record()
        from .job_history import ensure_schema, capture_weekly_snapshot
        result['stages']['time_schema'] = ensure_schema(); record()
        if not args.skip_collection:
            sources = [name.strip() for name in args.sources.split(',') if name.strip()]
            if not sources or any(name not in ('tencent', 'zhilian') for name in sources):
                raise ValueError('invalid sources')
            for name in dict.fromkeys(sources):
                result['stages'][name] = {'status': 'running'}; record()
                try:
                    result['stages'][name] = run_source(name, logs,
                        args.zhilian_max_details if name == 'zhilian' else args.max_details,
                        args.max_pages, args.source_timeout)
                except Exception as exc:
                    result['stages'][name] = {'status': 'failed', 'error_type': type(exc).__name__}
                record()
        result['stages']['sync']=sync_jobs(backfill=args.backfill); record()
        source_states = [result['stages'][name].get('status') for name in ('tencent', 'zhilian') if name in result['stages']]
        if not args.skip_collection and source_states and all(state in ('succeeded', 'unchanged') for state in source_states):
            result['stages']['weekly_snapshot'] = capture_weekly_snapshot()
        else:
            result['stages']['weekly_snapshot'] = {'status': 'skipped', 'reason': 'collection_not_complete; retry_next_healthy_run'}
        record()
        # Run graph publication after a healthy collection + SQL sync, never on a partial failed batch.
        sources_healthy = args.skip_collection or (source_states and all(state in ('succeeded', 'unchanged') for state in source_states))
        sync_healthy = result['stages']['sync'].get('status') in ('succeeded', 'unchanged')
        if sources_healthy and sync_healthy:
            from .graph_sync import sync_graph
            result['stages']['graph'] = {'status': 'running'}; record()
            result['stages']['graph'] = {'status': 'succeeded', **sync_graph()}
        else:
            result['stages']['graph'] = {'status': 'skipped', 'reason': 'collection_or_sql_sync_not_complete; retain_last_graph'}
        record()
        states=[value.get('status') for value in result['stages'].values() if isinstance(value,dict)]
        result['status']='partial_failure' if any(x in ('failed','blocked','empty','partial_failure') for x in states) else 'succeeded'
    except Exception as exc:
        result['status']='failed'; result['error_type']=type(exc).__name__
    finally:
        result['finished_at_utc']=datetime.utcnow().isoformat(); record()
        with (logs/'pipeline_runs.jsonl').open('a',encoding='utf-8') as f:
            f.write(json.dumps(result,ensure_ascii=False)+'\n')
        print(json.dumps(result,ensure_ascii=False),flush=True)
        lock.close()
    return 0 if result['status']=='succeeded' else 1


if __name__=='__main__':
    sys.exit(main())
