# 岗位图谱 (KG) 快速开始

## 0. 前置依赖

| 组件 | 版本 | 部署位置 | 状态 |
|---|---|---|---|
| MySQL | 8 | 180.76.227.159:3308 | ✅ 已部署 |
| Neo4j | 5.x | 180.76.227.159:7687 | ⏳ 待运维部署 |
| Neo4j GDS | latest | 插件 | ⏳ 装好后自动启用 |
| DeepSeek API | - | - | ✅ key 已配 |
| OpenAI API | - | - | ✅ key 已配 |

**用户/运维需做的事**:
1. 在云服务器 180.76.227.159 部署 Neo4j 5.x community(密码 `Xingtu123`,与 MySQL 一致)
2. 开放 7687(Bolt)+ 7474(HTTP)端口
3. 安装 GDS 插件:`:plugin gds` 或 docker 启动时挂载
4. 在 `.env` 中填入真实的 `DEEPSEEK_API_KEY` 和 `OPENAI_API_KEY`

## 1. 启动后端

```bash
cd backend
pip install -r requirements.txt   # 已包含 neo4j / langchain / langgraph
python main.py                     # uvicorn :8081
```

## 2. ETL 全量建图

```bash
python -m scripts.build_kg
# 跑完会打印统计:Job / Snapshot / Change / Skill ...
```

预期结果(基于已有 1529 行 jobs):
- Job: 618 (data_type=1)
- Article: 893 (data_type=2)
- Skill: 200+
- Company: 100+
- Industry: 11
- JobSnapshot: 600+(按月去重)
- ChangeEvent: 100+(薪资/技能差分)

## 3. Embedding(异步,可选)

```bash
python -m scripts.encode_snapshots --limit 600
# 跑完会自动建向量索引 snapshot_vec
```

## 4. LLM 归因(异步,可选)

```bash
python -m scripts.llm_attribute_changes --limit 100
```

## 5. 增量同步

```bash
python -m scripts.sync_kg_incremental --since 2026-08-01
```

## 6. 端到端验证

后端启动后:

```bash
python -m scripts.verify_kg
```

会跑 Neo4j 数据检查 + API smoke test + SSE 流式 chat 测试。

## 7. API 端点速览

```
GET  /api/kg/jobs/overview
GET  /api/kg/jobs/graph                    # 全图 {nodes, links}
GET  /api/kg/jobs?limit=100                # Job 列表
GET  /api/kg/jobs/{id}                     # 详情
GET  /api/kg/jobs/{id}/neighbors           # 邻居子图
GET  /api/kg/jobs/{id}/evolution?metric=salary_avg  # 时序
GET  /api/kg/jobs/{id}/changes             # 变化 + 归因
GET  /api/kg/snapshot/at?date=2026-08-01   # 当时全貌
GET  /api/kg/snapshot/timeline?bucket=month
GET  /api/kg/skills/{skill}/co-occurring
POST /api/kg/semantic-search   {query, top_k}
GET  /api/kg/personal/recommend
GET  /api/kg/personal/gap?job_id=X
POST /api/kg/admin/rebuild                  # 触发全量 ETL
POST /api/kg/admin/sync
POST /api/kg/admin/attribute
POST /api/kg/chat                          # SSE 流式
GET  /api/kg/chat/tools                    # 工具清单
```

## 8. SSE 事件 schema

```json
{"event": "plan_started", "step": "clarifier"}
{"event": "plan_ready", "plan_id": "...", "tasks": [...]}
{"event": "executor_step", "task_id": "...", "status": "running"}
{"event": "tool_call", "task_id": "...", "tool": "...", "args": {...}}
{"event": "tool_result", "task_id": "...", "result": "..."}
{"event": "report_token", "token": "..."}    // 流式文字
{"event": "report_done", "answer": "...", "references": [...]}
{"event": "error", "message": "..."}
```

## 9. 故障排查

| 现象 | 排查 |
|---|---|
| `Neo4j ServiceUnavailable` | 检查 7687 端口、防火墙、Neo4j 是否启动 |
| `LLM 401` | .env 里 DEEPSEEK_API_KEY 或 OPENAI_API_KEY 没配/错 |
| `Vector index snapshot_vec missing` | 跑过 `encode_snapshots.py` 才会自动建 |
| `Empty graph` | 跑 `python -m scripts.build_kg` |
| CORS 错 | 后端已开 `allow_origins=*`,前端 dev 代理到 8081 |