"""Reproducible controlled temporal replay, NOT an embedding-quality benchmark.

python scripts/evaluate_temporal_retrieval.py --output path/to/results.json
Source JD text is repository fixture data, not independently verified web data.
No DB writes, network requests, credentials, or LLM calls.
"""
import argparse
import hashlib
import json
import math
import platform
import statistics
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from services.temporal_graph import latest_snapshots, rank_snapshots, snapshot_graph, cosine


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",required=True)
    args=parser.parse_args()
    source=ROOT / "test_data/scraped_jds.json"
    jobs=json.loads(source.read_text(encoding="utf-8"))
    cases=[]
    for i,job in enumerate(jobs):
        # Two deliberately adversarial orders: future-high and superseded-high.
        scores = [.8,.6,1.] if i % 2 == 0 else [1.,.8,.6]
        skills=list(job.get("skills") or [])
        versions=[]
        for v,(date,score) in enumerate(zip(["2026-01-01","2026-02-01","2026-03-01"],scores)):
            versions.append({"job_id_ref":i+1,"snapshot_id":f"j{i+1}-v{v}","title":job["title"],
                "job_description":job.get("description",""),"source":"controlled_fixture",
                "captured_at":date+"T00:00:00Z",
                "skills_required":skills + (["CONTROL_ADDED_V1"] if v>=1 else []) + (["CONTROL_ADDED_V2"] if v>=2 else []),
                "embedding":[score,math.sqrt(max(0,1-score*score))]})
        cases.append(versions)
    cutoff="2026-02-15T00:00:00Z"
    metrics={m:{"correct":0,"future":0,"superseded":0,"empty":0} for m in ["unfiltered_top1","time_filter_only","top1_then_filter","latest_then_rank"]}
    for versions in cases:
        sorted_all=sorted(versions,key=lambda s:-cosine([1,0],s["embedding"]))
        time_only=[s for s in sorted_all if s["captured_at"]<=cutoff]
        pred={"unfiltered_top1":sorted_all[:1],"time_filter_only":time_only[:1],
              "top1_then_filter":[s for s in sorted_all[:1] if s["captured_at"]<=cutoff],
              "latest_then_rank":rank_snapshots(versions,"query",1,cutoff,[1,0])}
        for method,rows in pred.items():
            status="empty" if not rows else "correct" if rows[0]["snapshot_id"]==versions[1]["snapshot_id"] else "future" if rows[0]["captured_at"]>cutoff else "superseded"
            metrics[method][status]+=1
    latest_skill_errors=0
    proposed_skill_errors=0
    for versions in cases:
        expected=set(versions[1]["skills_required"])
        latest_skill_errors+=int(set(versions[2]["skills_required"])!=expected)
        graph=snapshot_graph(latest_snapshots(versions,cutoff),cutoff)
        actual={n["name"] for n in graph["nodes"] if n["label"]=="Skill"}
        proposed_skill_errors+=int(actual!=expected)
    # Timing is a microbenchmark, includes Python selection+ranking only, not DB/API.
    timings=[]
    all_rows=[s for versions in cases for s in versions]
    rank_snapshots(all_rows,"query",10,cutoff,[1,0])
    for _ in range(30):
        start=time.perf_counter()
        rank_snapshots(all_rows,"query",10,cutoff,[1,0])
        timings.append((time.perf_counter()-start)*1000)
    result={"protocol":"controlled-temporal-replay-v1","source_sha256":hashlib.sha256(source.read_bytes()).hexdigest(),
        "source_kind":"repository templated JD fixtures; not a verified public corpus",
        "python":platform.python_version(),"system":platform.system(),"cases":len(cases),"snapshots":len(all_rows),
        "cutoff":cutoff,"dimension":2,"scores_are":"manually controlled cosine scores, not model embeddings",
        "metrics":metrics,"historical_skill_set_errors":{"current_edges":latest_skill_errors,"snapshot_edges":proposed_skill_errors},
        "microbenchmark":{"runs":30,"median_ms":round(statistics.median(timings),3),"max_ms":round(max(timings),3),
                          "scope":"in-memory selection and ranking only; no DB, network or generation"}}
    output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(result,ensure_ascii=False,indent=2))


if __name__=="__main__":
    main()
