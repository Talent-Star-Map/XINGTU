"""Single scheduling authority; duplicate processes are locked by the runner."""
from datetime import datetime, timedelta
import subprocess
import sys
import time


def main():
    while True:
        now=datetime.now()
        times=[now.replace(hour=h,minute=m,second=0,microsecond=0) for h,m in [(14,30),(23,10)]]
        next_run=min([t for t in times if t>now] or [times[0]+timedelta(days=1)])
        print('next job run:',next_run.isoformat(),flush=True)
        time.sleep(max(0,(next_run-datetime.now()).total_seconds()))
        completed=subprocess.run([sys.executable,'-u','-m','repair_pipeline.runner'])
        print('job pipeline exit:',completed.returncode,flush=True)


if __name__=='__main__':
    main()
