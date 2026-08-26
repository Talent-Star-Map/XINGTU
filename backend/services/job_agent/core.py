"""
core/plan_spec.py — Pydantic 模型: PlanSpec / TaskNode
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class TaskNode(BaseModel):
    task_id: str = Field(..., description="唯一 ID")
    description: str = Field(..., description="人类可读的子任务描述")
    tool: str = Field(..., description="执行该任务的 tool 名称")
    args: dict = Field(default_factory=dict)
    depends_on: List[str] = Field(default_factory=list)
    priority: int = 1


class PlanSpec(BaseModel):
    plan_id: str
    version: int = 1
    status: str = "draft"
    user_query: str
    tasks: List[TaskNode]
    execution_mode: str = "sequential"  # 'sequential' | 'parallel'


TASK_TYPES = {
    "semantic_search":   "语义搜索 jobs(snapshot 向量)",
    "keyword_search":    "关键词/模糊搜索 jobs",
    "get_job_details":   "取单个 Job 的详情",
    "get_job_evolution": "取 Job 的时序数据",
    "get_job_changes":   "取 Job 的变化事件列表",
    "get_skill_co_occurrence": "取技能的共现技能",
    "get_user_profile":  "取当前用户的画像",
    "get_gap_analysis":  "对 (user, job) 做缺口分析",
    "get_personal_recommend": "基于用户技能推荐 Job",
    "get_overview":      "取图谱总览统计",
    "snapshot_at":       "取某时间点的快照子图",
    "timeline_anchors":  "取时间轴锚点列表",
}