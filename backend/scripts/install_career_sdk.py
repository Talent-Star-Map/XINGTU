"""Install official DeerFlow into a separate venv to preserve FastAPI dependencies."""
import os
from pathlib import Path
import subprocess
import sys
import venv

root=Path(__file__).resolve().parents[1]
target=Path(os.environ.get('CAREER_SDK_ENV',root/'.career-venv')).resolve()
venv.EnvBuilder(with_pip=True).create(target)
python=target/('Scripts/python.exe' if os.name=='nt' else 'bin/python')
subprocess.run([str(python),'-m','pip','install','-r',str(root/'requirements-career.txt')],check=True)
subprocess.run([str(python),'-c','from deerflow.client import DeerFlowClient; print("DeerFlow SDK import OK")'],check=True)
print('Set CAREER_SDK_PYTHON='+str(python))
