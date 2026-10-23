"""Offline regression tests. Run: python tests/test_temporal_graph.py."""
import importlib.util
import json
import sys
import types
import asyncio
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.temporal_graph import latest_snapshots, rank_snapshots, snapshot_graph, cosine, cutoff_iso, snapshot_delta


def load_file(name, relative):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).resolve().parents[1] / relative)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    checks = []
    def check(name, condition):
        assert condition, name
        checks.append(name)

    t = "2026-02-01T00:00:00Z"
    old = dict(job_id_ref=1, snapshot_id="a", title="Python", captured_at="2026-01-01T00:00:00Z",
               skills_required=["Python"], source="A", company_name="Employer",
               source_url="https://jobs.example.org/posting/1", embedding=[1, 0])
    new = {**old, "snapshot_id": "b", "captured_at": "2026-03-01T00:00:00Z", "skills_required": ["Rust"], "embedding": [0, 1]}
    rows = [new, old]
    check("future excluded", latest_snapshots(rows, t) == [old])
    check("exact cutoff included", latest_snapshots(rows, old["captured_at"]) == [old])
    check("before first is empty", latest_snapshots(rows, "2025-01-01") == [])
    check("UTC equivalence", cutoff_iso("2026-01-01T08:00:00+08:00") == cutoff_iso("2026-01-01T00:00:00Z"))
    tied = {**old, "snapshot_id": "z"}
    check("stable tie break", latest_snapshots([tied,old],t) == latest_snapshots([old,tied],t) == [tied])
    graph = snapshot_graph(latest_snapshots(rows,t),t)
    check("historical edges", [l["target"] for l in graph["links"]] == ["Skill:Python"])
    check("edge provenance", graph["links"][0]["snapshot_id"] == "a")
    empty = snapshot_graph([{**old,"skills_required":None}],t)
    check("unknown skills retain job", len(empty["nodes"]) == 1 and not empty["nodes"][0]["skills_known"])
    check("known empty differs", snapshot_graph([{**old,"skills_required":[]}],t)["nodes"][0]["skills_known"])
    check("string skills normalized", len(snapshot_graph([{**old,"skills_required":"Python, Python;Rust"}],t)["links"]) == 2)
    ranked = rank_snapshots(rows,"Python",10,t,[1,0])
    check("retrieval provenance", ranked[0]["snapshot_id"] == "a" and ranked[0]["as_of"] == t)
    check("one result per posting", len(rank_snapshots(rows,"Python",10,"2026-04-01",[1,0])) == 1)
    check("latest precedes score", rank_snapshots(rows,"Python",10,"2026-04-01",[1,0])[0]["snapshot_id"] == "b")
    other = {**new, "snapshot_id": "c", "company_name": "Other Employer",
             "source_url": "https://jobs.example.org/posting/2", "embedding": [1, 0]}
    check("same role retains two employers", {s["snapshot_id"] for s in latest_snapshots([old,new,other],"2026-04-01")} == {"b","c"})
    check("role group evidence has distinct nodes", len([n for n in snapshot_graph([new,other],"2026-04-01")["nodes"] if n["label"] == "Job"]) == 2)
    one_off = {**old, "snapshot_id": "d", "source_url": None, "source_job_id": 901}
    check("URL-less source row remains single observation", latest_snapshots([one_off],t) == [one_off])
    check("unidentified legacy row excluded", latest_snapshots([{**one_off,"source_job_id":None}],t) == [])
    check("fallback labelled", rank_snapshots(rows,"Python",10,t)[0]["retrieval_mode"] == "keyword_fallback")
    check("empty query no lexical hits", rank_snapshots(rows,"",10,t) == [])
    check("invalid vectors ignored", all(cosine(a,b) is None for a,b in [([],[]),([1],[1,0]),([0,0],[1,0]),([float('nan')],[1])]))
    delta = snapshot_delta(old,new)
    check("skill change distance", delta["skill_distance"] == 1 and delta["skills_added"] == ["Rust"])
    check("change unknown preserved", snapshot_delta(old,{**new,"skills_required":None})["skill_distance"] is None)
    check("same-posting scope", delta["comparison_scope"] == "same_posting_observations")
    try:
        snapshot_delta(old, {**new, "company_name": "Other Employer"})
    except ValueError:
        check("different employer cannot be longitudinal", True)
    else:
        check("different employer cannot be longitudinal", False)

    ex = load_file("execution_test", "services/job_agent/execution.py")
    task = lambda id, deps, args=None: types.SimpleNamespace(task_id=id,depends_on=deps,args=args or {},tool="get_job_details")
    a,b = task("a",[],{"job_id":1}), task("b",["a"],{"job_id":{"$ref":"a","path":[0,"id"]}})
    check("dependency scheduling", [v.task_id for v in ex.ordered_tasks([b,a])] == ["a","b"])
    check("result binding", ex.resolve_args(b,{"a":[{"id":77}]}) == {"job_id":77})
    for name, fn in [
        ("cycle rejected", lambda: ex.ordered_tasks([task("a",["b"]),task("b",["a"])])),
        ("duplicate rejected", lambda: ex.ordered_tasks([a,a])),
        ("unknown dependency", lambda: ex.ordered_tasks([b])),
        ("empty result stops child", lambda: ex.resolve_args(b,{"a":[]})),
        ("failure stops child", lambda: ex.resolve_args(b,{"a":{"error":"offline"}})),
        ("invalid id rejected", lambda: ex.resolve_args(task("x",[],{"job_id":0}),{})),
    ]:
        try: fn()
        except ValueError: check(name,True)
        else: check(name,False)

    # Adapter tests replace external boundaries, never connect to DB/LLM.
    db = types.ModuleType("database")
    db.get_neo4j_driver = lambda: None
    db.get_openai_embeddings = lambda: types.SimpleNamespace(embed_query=lambda q: [1,0])
    sys.modules["database"] = db
    kg = load_file("kg_service_test", "services/kg_service.py")
    calls=[]
    kg._query=lambda cypher,params: calls.append((cypher,params)) or [{"snapshot":old,"job_id":1}]
    check("service snapshot adapter", kg.get_snapshot_at(t)["links"][0]["target"] == "Skill:Python")
    check("service semantic adapter", kg.semantic_search_jobs("Python",3,t)[0]["snapshot_id"] == "a")
    db_fail=lambda: (_ for _ in ()).throw(RuntimeError("provider unavailable"))
    kg.get_openai_embeddings=db_fail
    check("provider error fallback", kg.semantic_search_jobs("Python",3,t)[0]["retrieval_mode"] == "keyword_fallback")
    kg._query=lambda c,p:[{"date":t,"value":None,"source":"A","company_name":"Employer",
                            "source_url":"https://jobs.example.org/posting/1"}]
    check("missing salary stays null", kg.get_job_evolution(1)[0]["value"] is None)
    check("evolution carries identity", kg.get_job_evolution(1)[0]["series_key"].endswith("/posting/1"))
    kg._query=lambda c,p:[{"snapshot":s,"job_id":1} for s in [old,new,other]]
    check("service retains cross-employer evidence", len(kg._latest_snapshot_rows("2026-04-01")) == 2)
    kg._query=lambda c,p:[{"snapshot":s} for s in [old,new,{**new,"snapshot_id":"z","skills_required":["Go"]}]]
    check("difference uses stable tied version", kg.get_job_skill_deltas(1)[0]["skills_added"]==["Go"])
    kg._query=lambda c,p:[{"snapshot":s} for s in [old,{**new,"source":"B"}]]
    check("different sources not chained", kg.get_job_skill_deltas(1)==[])
    db.get_llm_strong = lambda: None
    reporter = load_file("reporter_test", "services/job_agent/reporter.py")
    evidence = [{"id": 1, "snapshot_id": "a", "title": "Python"},
                {"id": 1, "snapshot_id": "b", "title": "Python"}]
    check("distinct versions cited", len(reporter.collect_references([{"result":evidence}])) == 2)
    packed = json.loads(reporter._short_result(evidence, 100))
    check("whole record budget", len(packed["items"]) == 1 and packed["omitted"] == 1)
    check("oversized evidence explicit", json.loads(reporter._short_result("x"*10000))["omitted"] == 1)
    # Exercise actual orchestration with injected tools and report transport.
    db.get_llm_fast = lambda: None
    from services.job_agent import agent as agent_module
    from services.job_agent.core import TaskNode, PlanSpec
    async def run_agent(search_result):
        plan = PlanSpec(plan_id="offline",user_query="test",tasks=[
            TaskNode(task_id="b",description="details",tool="get_job_details",depends_on=["a"],
                     args={"job_id":{"$ref":"a","path":[0,"id"]}}),
            TaskNode(task_id="a",description="search",tool="semantic_search",args={"query":"Python"})])
        async def planner(*args): return plan
        calls=[]
        async def search(*args): return search_result
        async def details(args,*rest): calls.append(args); return {"id":args["job_id"]}
        async def report(query,executions): yield "offline evidence report"
        agent_module.stream_report=report
        instance=agent_module.JobAgent();instance._plan=planner
        instance._executor={"semantic_search":search,"get_job_details":details}
        events=[e async for e in instance.astream("test")]
        return calls,events
    calls,events=asyncio.run(run_agent([{"id":77}]))
    check("agent executes bound dependency", calls==[{"job_id":77}])
    check("agent report completes", events[-1]["event"]=="report_done")
    calls,events=asyncio.run(run_agent([]))
    check("agent empty dependency not invoked", calls==[])
    check("agent skip visible", any(e.get("full_result",{}).get("error") for e in events if isinstance(e.get("full_result"),dict)))
    print(json.dumps({"passed":len(checks),"checks":checks},indent=2))


if __name__ == "__main__":
    main()
