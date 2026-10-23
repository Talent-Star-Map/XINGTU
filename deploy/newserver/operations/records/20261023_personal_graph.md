# 个人经历与技术图谱

求职者「我的能力图谱」从技能圆环改为个人—项目/工作经历—技术的空间辐射图。使用当前登录用户最近更新的简历、个人资料及已掌握技能；刷新或重新进入页面读取当前数据库，不含演示数据兜底。

新增只读 GET /api/kg/personal/graph。每条经历—技术关系带技术字段或原文提及依据；只在技能记录中的技术单独标明。原文提及不等于独立验证的能力，节点尺寸不代表评分。未新增表、不修改标注、分档、匹配评分或生产数据。

交互：拖动旋转、手动播放/暂停、缩放、复位、全屏、项目/工作筛选、点选邻接关系及原文、完整列表、暗亮主题。小屏默认减少图面节点，全部数据仍能从列表访问。页面隐藏或画布离屏时停止动画调度；WebGL不可用时保留列表。

验证：6项新增离线映射/用户隔离测试；全API鉴权回归45通过0失败；TypeScript/Vite构建通过。实际数据库资料只读联调2段经历、26项技术、11项有经历关系；浏览器验证原文一致、旋转暂停缩放、筛选展开、390px无横向溢出、当前默认视角标签无相交，控制台错误及失败请求为0。后续任意数据规模/旋转角度不据此承诺永不遮挡。

部署结果以服务器发布目录与后续运维记录为准，本说明本身不表示已上线。

## 实际部署（北京时间2026-10-23 21:29）

应用提交 `fbcd04fd6896a44dcac9bc013b24bff6965fc989`，镜像 `xingtu-api:graph-fbcd04f` / `xingtu-frontend:graph-fbcd04f-r2`。两镜像分别复用服务器已验收的 `f974618` 运行时；API覆盖固定提交backend源码，前端覆盖本机构建产物和同版本nginx.conf。无依赖变更。源包SHA及Dockerfile留在发布目录，前端类型检查/Vite构建在本机完成；服务器不重新下载系统依赖。

服务器构建及两项离线测试成功，发布前备份COMPLETE后只切换api/frontend。新增接口匿名401、企业角色403、本人200，带他人user_id参数仍与本人数据库映射完全相同。mysql/mongo/neo4j/collector容器ID未变。新API镜像设置XINGTU_SKIP_DB_INIT=1，避免启动时自动建表；其余运行环境与凭据保持。未执行SQL或图谱重建。

证据及回滚：`/data/xingtu/releases/20261023_graph_fbcd04f/` 中 `state.json`、`verify.json`、`backup.json`、`containers.before.json`、`compose.before.yaml`、`compose.release.yaml`、`source/Dockerfile.*`。构建/测试日志不含用户简历正文。回滚需恢复compose.before.yaml，并仅以--no-deps --no-build重建api/frontend。旧镜像保留。

入口：团队SSH隧道 http://127.0.0.1:13000/#/my-skill-graph 。公网安全组、域名和HTTPS未在本轮变更或重新验收，不能据此宣称公网已开放。

### 网页最终验收与修正

首次静态资源目录继承私有解包权限，导致Nginx资源403。未以首页200作为最终验收：前端镜像追加 `RUN chmod -R a+rX /usr/share/nginx/html /etc/nginx/conf.d/default.conf`，生成独立 `graph-fbcd04f-r2` 标签，只重建前端。首页引用的3项资源全部200；修正记录 `frontend_assets_verify.json`、`build_frontend_r2.log`、`source/Dockerfile.frontend-r2`。

经服务器SSH隧道的真实生产网页最终通过：原文与接口完全一致、旋转/暂停、缩放、复位、筛选、展开、暗亮主题和390px响应式；默认检查角度标签相交0、横向溢出0、控制台错误0、失败请求0。截图及自动化脚本保存在本机独立验证目录（含私有登录材料，不推Git）。这不代表任意旋转角度或所有业务均已验收。


## GitHub 参考效果修正与视觉审查（2026-10-23 21:56，北京时间）

本节替代前版视觉验收结论：前版虽通过接口和交互检查，但默认暂停、浅色画布和节点/连线样式未达到用户要求的 GitHub 个人主页基线。不能把功能通过作为视觉达标。

前端源码提交 `5968abaf9655b3f26cb9878d1ebf2126bd82439c`，已推送 main。线上前端镜像 `xingtu-frontend:visual-5968aba`；API 仍为 `xingtu-api:graph-fbcd04f`。恢复默认缓慢旋转（系统减少动态效果时例外）、深色画布、原版立方体/八面体/球体与灯光材质、彩色细线和标签。经历分支在三维空间辐射，技术围绕有依据的经历展开；没有经历依据的技能保留在完整列表，选中后可查看。分支颜色表示经历归属，不推断科研/工程类别或能力等级。人节点侧栏优先显示经历。修正标签遮挡节点、窄屏可用宽度及展开按钮的数量口径。

验证范围：TypeScript 与 Vite 构建通过；经本机开发入口和服务器 SSH 隧道分别检查默认自动旋转、暂停/恢复、拖动、复位、筛选、展开、原文与 API 一致以及减少动态效果偏好。实际查看 1440px 桌面、1024px 窄屏、390px 手机截图及旋转后截图；3 个拖动视角标签相交为 0，手机横向溢出为 0。线上浏览器控制台错误/警告 0，失败请求 0。首次进入的两帧位置变化另行确认。检查使用当前测试账号真实资料；不宣称其他数据规模或任意视角绝无遮挡，长经历名称在图面省略，侧栏显示完整内容。

部署只切换 frontend，原 API/mysql/mongo/neo4j/collector 容器 ID 均未变；凭据环境、数据库与标注不变。122 个构建产物经实际 HTTP 读取 SHA-256 与本地清单逐一一致。前端 build context 同步指向本次发布目录，保留前版基础镜像和回滚 compose。

发布目录 `/data/xingtu/releases/20261023_visual_5968aba/`：`release.json`、`source.tar.gz`、`source/assets-sha256.json`、`source/Dockerfile`、`compose.before.yaml`、`compose.release.yaml`、`containers.before.json`、`state.json`、`browser_verify.json`、`visual_review.json`。源包 SHA-256：`a9bd18f8f998ccdb75a895e7c2781d2377037ead5b64fa7844a2d466265624cb`。

回滚：确认 compose 没有后续他人变更后，恢复本次 `compose.before.yaml`，只执行 `docker compose --profile app up -d --no-deps --no-build frontend`；前端回到 `graph-fbcd04f-r2`。不得为前端回滚重建数据库或 API。

浏览器脚本、截图和本地结果位于工作区 `验证_个人图谱_20261023/`，含登录材料，不整体提交 Git 或上传共享盘。服务器保存脱敏审查结果和截图 SHA，供版本追溯。后续前端交付必须遵循 [视觉检查清单](../../../../frontend/VISUAL_REVIEW.md)，每次构建后、部署后均实际看页面。
