# 小星求职智能体

2026-11-26。本次改动针对智能问答、悬浮小星与简历中心之间的业务衔接。个人中心继续维护资料并解析上传的原始简历。

## 运行结构

- 小星主流程：服务端持久会话、意图识别、补问、流程控制。
- RAG：当前登录用户的资料、原始简历解析缓存和已确认记忆，在用户范围内检索。当前采用有预算的关键词排序，不宣称使用了新增的私有向量库。
- GraphRAG：调用既有岗位图谱语义检索与一跳关系，仅用于职业要求解释。图谱职业聚合节点与具体市场招聘岗位ID分开，绝不把二者ID互换。
- 真实招聘推荐：从市场 jobs 表 data_type=1 检索；展示来源、采集日期、技能交集。没有实时核实的职位状态显示未知，不宣称仍在招聘。
- 多Agent：通过官方 DeerFlowClient 分别运行意图/资料、个人证据、岗位分析、简历定制、审核监督Agent。独立的个人分析与岗位分析 asyncio.gather 并行；主流程控制依赖。不是所有请求都启动全部角色。
- 监督：模型语义检查与本地字段/来源/数字约束同时通过才保存。未知/冲突进入 needs_input。不能保证消除全部模型错误，应持续以真实样本评价。
- 简历落库：复用现有区块和模板。新建岗位专属版本，不覆盖旧简历。字段来源和岗位快照保存在绑定表。生成版本不再作为下一次生成的基础事实。

## 官方库与兼容性

锁定 bytedance/deer-flow 提交 `9a1e1c43981324917c81727da2e8be280683c807`，导入 `deerflow.client.DeerFlowClient`。官方依赖包含较新的Starlette/MCP等，不能直接套用项目旧的 runtime-constraints.txt，也不能升级现有FastAPI环境来迁就SDK。

使用独立Python环境运行官方库，业务API通过子进程stdin传递脱敏上下文和模型设置，读取结构化结果。密钥不写入命令行、配置文件或应用日志。SDK不对用户暴露shell、任意文件和MCP工具；GitHub读取由受限Python工具完成。SDK各分析节点使用临时内存checkpoint，跨会话记忆由按账号隔离的MySQL业务表保存，不使用SDK全局文件记忆。

安装：

```powershell
python backend/scripts/install_career_sdk.py
# 按脚本输出设置服务环境变量 CAREER_SDK_PYTHON，重启服务。
```

Linux容器可在独立虚拟环境 `/opt/career-sdk` 安装，设置 `CAREER_SDK_PYTHON=/opt/career-sdk/bin/python`。使用现有Dockerfile时，需要显式传入 `--build-arg INSTALL_CAREER_SDK=1`；默认镜像不会安装这组额外依赖。既有API的模型配置仍由管理员配置；SDK进程复用该配置。所有模型均使用API，不引入本地大模型/GPU推理。官方安装依赖较多，应缓存构建镜像并先检查磁盘与内存占用。

## 数据库

遵循项目方式B：审核并手动执行 `backend/sql/career_assistant.sql`，不在启动时偷偷create_all。SQL只新增career_threads、career_messages、career_facts、career_runs、resume_target_bindings。

可先运行 `python backend/scripts/career_migration.py` 打印SQL，备份后再明确执行 `--apply`。不要对线上数据库使用测试模块的自动建表。时间按UTC保存。回滚先关闭新增入口，再恢复旧代码；保留已生成简历和个人资料备份。

## API与状态

`/api/career-assistant` 下的所有接口都要求求职者身份，owner只来自JWT，不接受模型/浏览器指定他人ID。

- GET/POST /threads，GET/DELETE/PATCH /threads/{id}
- GET /threads/{id}/messages，POST /threads/{id}/turn（SSE）
- GET /threads/{id}/run，GET /runs/{id}
- GET /memory，POST /memory/{id}/confirm，PATCH/DELETE /memory/{id}

消息携带 request_id 做幂等。单会话跨进程互斥，独立会话可以并行。执行状态与事件落库，浏览器关闭不取消任务；重新进入页面拉取任务进度。长时间无心跳任务可恢复，已完成简历通过唯一run绑定避免重复制稿。

简历地址 `#/resume-center?resumeId=123`，刷新后打开指定简历，实际内容仍须通过简历中心归属鉴权。

## 知识与证据规则

聊天提取只产生候选记忆，quote必须是本条用户原话的子串。用户确认后才能进入简历资料。原始简历解析结果也应核对，保存材料哈希；删除或重新解析后引用失效。用户点击忘记后，自动重读同一材料不得复活该条记忆。

GitHub第一版支持公开仓库，固定commit读取部分README、依赖和代码；不执行代码/测试、不推断个人贡献、不虚构性能指标。私有仓库不要求把token粘到聊天里，暂时改用用户提供的选定材料。读取受大小和文件数量预算限制，标记partial。团队贡献须确认。用户可以跳过。

简历定制只能选择真实经历、调整重点、修改措辞。姓名、日期、学历、公司、技能和数字等字段禁止模型直接改动。未掌握的JD技能只能作为缺口，不写进用户技能。监督Agent否决、格式错误、没有证据或模型不可用时不落库。

## 验证

离线测试 `python backend/tests/test_career_assistant.py` 共13项，覆盖账号隔离、接口角色权限、记忆冲突、撤回、岗位ID校验、重复请求、并行Agent、审核拒绝、GitHub断网提示和事务保存。真实SDK用 `backend/tests/check_career_sdk.py` 验证导入、配置及模型接口；可用 `--bridge` 验证现有后端环境调用隔离SDK进程。前端在frontend目录运行 `npm run build`。

2026-11-27本地验收：上述13项通过；前端构建通过；浏览器完成真实SQL岗位检索、官方SDK编排、监督通过后的简历保存、指定简历编辑页跳转、刷新恢复与TXT导出，无页面脚本错误。浏览器用 `backend/tests/serve_career_browser_fixture.py` 提供独立SQLite合成账号/岗位和本地模型响应，未连接生产数据库。GraphRAG分支使用替身；仍需用实际Neo4j及管理员配置的真实模型做联调。这些检查证明流程可运行，不代表真实模型准确率、线上延迟或反幻觉效果评测。

上线前必须完成依赖安装、手动SQL迁移，并用真实测试账号检查整条制作/跳转/导出流程。默认不自动投递、不自动公开分享简历。
