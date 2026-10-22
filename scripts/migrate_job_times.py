"""Add nullable source-time columns and weekly snapshot tables; no backfill."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from repair_pipeline.job_history import ensure_schema
import json
if __name__ == '__main__':
    print(json.dumps(ensure_schema(), ensure_ascii=False))
