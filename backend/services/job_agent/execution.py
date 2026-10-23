"""Deterministic dependency scheduling and explicit result references."""
from copy import deepcopy


def ordered_tasks(tasks):
    if len(tasks) > 5 or len({t.task_id for t in tasks}) != len(tasks):
        raise ValueError("plan requires at most five tasks with unique IDs")
    known = {t.task_id for t in tasks}
    if any(dep not in known for t in tasks for dep in t.depends_on):
        raise ValueError("unknown task dependency")
    pending, done, result = list(tasks), set(), []
    while pending:
        ready = next((t for t in pending if set(t.depends_on) <= done), None)
        if ready is None:
            raise ValueError("cyclic task dependencies")
        result.append(ready)
        done.add(ready.task_id)
        pending.remove(ready)
    return result


def resolve_args(task, completed):
    for dep in task.depends_on:
        if dep not in completed or (isinstance(completed[dep], dict) and "error" in completed[dep]):
            raise ValueError(f"dependency {dep} did not succeed")

    def resolve(value):
        if isinstance(value, dict) and set(value) == {"$ref", "path"}:
            dep = value["$ref"]
            if dep not in task.depends_on:
                raise ValueError("result reference must name a declared dependency")
            result = completed[dep]
            try:
                for key in value["path"]:
                    result = result[key]
            except (KeyError, IndexError, TypeError):
                raise ValueError("dependency result path is missing") from None
            return deepcopy(result)
        if isinstance(value, dict):
            return {k: resolve(v) for k, v in value.items()}
        if isinstance(value, list):
            return [resolve(v) for v in value]
        return value

    args = resolve(task.args)
    if task.tool in {"get_job_details", "get_job_evolution", "get_job_changes", "get_job_skill_deltas", "get_gap_analysis"}:
        if not isinstance(args.get("job_id"), int) or isinstance(args.get("job_id"), bool) or args["job_id"] <= 0:
            raise ValueError("job_id must be a positive integer or an explicit dependency reference")
    return args
