"""Offline Linux process tests: deadline enforcement and truthful failure status."""
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import time
import types

for name in ('database', 'database.mysql', 'sync', 'sync.job_sync'):
    sys.modules[name] = types.ModuleType(name)
sys.modules['database.mysql'].get_connection = lambda: None
sys.modules['sync.job_sync'].get_server_connection = lambda: None
sys.modules['sync.job_sync'].sync_jobs = lambda: None
path = Path(__file__).parent / 'repair_pipeline' / 'runner.py'
spec = importlib.util.spec_from_file_location('tested_runner', path)
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)
with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    package = root / 'repair_pipeline'
    package.mkdir()
    (package / '__init__.py').write_text('')
    (package / 'source_worker.py').write_text('''import json,sys,time
from pathlib import Path
args=sys.argv
limit=int(args[args.index('--max-details')+1])
if limit==99: time.sleep(20)
if limit==98: raise SystemExit(3)
Path(args[args.index('--output')+1]).write_text(json.dumps({'status':'succeeded','new_raw':1}))
''')
    previous = Path.cwd()
    os.chdir(root)
    try:
        assert runner.run_source('tencent', root, 1, 1, 3)['new_raw'] == 1
        started = time.monotonic()
        result = runner.run_source('tencent', root, 99, 1, 0.2)
        assert result['status'] == 'failed' and result['reason'] == 'source_timeout'
        assert time.monotonic() - started < 4
        result = runner.run_source('tencent', root, 98, 1, 3)
        assert result['status'] == 'failed' and result['exit_code'] == 3
        assert runner.run_source('tencent', root, 1, 1, 3)['status'] == 'succeeded'
    finally:
        os.chdir(previous)
print('PASS: bounded workers, timeout cleanup, missing-result failures and recovery after failure')
