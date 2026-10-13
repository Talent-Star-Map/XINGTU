# 微信小程序端设计与功能说明

> 审计对象：`D:\Xingtu\applet`（uni-app Vue3 工程，微信小程序端）
> 依据：以 `src/` 下实际代码为准（仅代码级审计，未修改任何文件）
> 说明：凡"源码中不存在 / 无法从代码确认"之处均明确标注，不做推断补写。

---

## 1. 小程序端定位

「星图：岗位能力图谱动态演化与分析系统」的**移动端入口**，与 Web 前端共享同一套业务与后端，是一个**轻量壳 + 多视图（Shell-SPA）**架构的微信小程序。

代码层面的定位事实：

- 入口永远先进入 **角色选择页**（`src/pages/role-select/role-select.vue` 为 `pages.json` 首个页面），由用户选择身份进入对应端。
- 三端（求职者 / 企业 / 管理员）**不是三个独立小程序**，而是同一 App 内按 `pages.json` 注册的三个页面（`pages/jobseeker/index`、`pages/enterprise/index`、`pages/admin/index`），每个页面仅是"壳"：真实界面全部由 `components/*/xxxShell.vue` 内的**单页多视图**承担（见 §3）。
- 没有原生 `App.js`：uni-app Vue3 的 App 生命周期由 `src/App.vue` 的 `onLaunch/onShow/onHide` 编译而来（已核对编译产物 `dist/dev/mp-weixin/app.js`）。
- 小程序内**没有 TabBar 配置**（`pages.json` 无 `tabBar` 节点），底部导航均为各 Shell 内自绘的固定底栏。

---

## 2. 技术实现

### 2.1 基础版本（取自 `package.json` / `manifest.json`）

| 项 | 值 | 依据 |
|---|---|---|
| 框架 | uni-app（Vue 3 模式，`manifest.json` `vueVersion:"3"`） | `src/manifest.json` |
| uni-app 依赖 | `@dcloudio/uni-app` 等 `3.0.0-alpha-5020520260821001` | `package.json` |
| Vue | `vue ^3.4.21` | `package.json` |
| Vite | `vite 5.2.8`、`@dcloudio/vite-plugin-uni 3.0.0-alpha-5020520260821001` | `package.json`（devDependencies） |
| 编译方式 | CLI 编译微信小程序：`npm run dev:mp-weixin`（`uni -p mp-weixin`，watch）与 `npm run build:mp-weixin`（`uni build -p mp-weixin`），产物在 `dist/dev|build/mp-weixin` | `package.json` scripts、`dist/dev/mp-weixin` |
| 小程序 AppID | 源码 `src/manifest.json` `mp-weixin.appid` 为空；**源码未配置，由微信开发者工具注入**（编译产物 `dist/dev/mp-weixin/project.config.json` 中出现 `wx11e0495a70976c99`，该值由开发者工具写入，非源码承诺） | `manifest.json`、`project.config.json` |
| 基础库版本 | 3.16.2（开发者工具写入 `project.private.config.json`） | `project.private.config.json` |
| 构建额外依赖 | `three ^0.185.1`（企业端 3D 图谱）、`fantasticon`（devDep，图标字体生成）、`vue-i18n`（已声明但源码未检索到引用） | `package.json` + grep |
| 样式变量 | uni-app 内置 `$uni-*`（`src/uni.scss`）仅剩脚手架默认值，业务未使用 | grep |

### 2.2 入口与全局

- `src/main.js`：仅 `createSSRApp(App)`，无额外初始化。
- `src/App.vue`：
  - `onLaunch/onShow/onHide` 仅打印日志；
  - 附带一段**标注为 `TEMP AnyService connectivity test (remove after verify)` 的临时代码**（`#ifdef MP-WEIXIN` 内调用 `wx.cloud.init` + `wx.cloud.callContainer` 探测 `/api/health`），属遗留调试块，并非生产请求路径（详见 §13）。
  - `<style>` 全局 `@import './styles/theme.css'` 与 `iconfont.css`，并设置 `page` 字体、背景、盒模型，以及 `uni-page-body{overflow:hidden}` 等容器约束。

### 2.3 目录结构（业务源码 `src/`）

```
src/
├─ main.js / App.vue / pages.json / manifest.json / uni.scss
├─ styles/        theme.css（主题令牌）、iconfont.css（图标字体 @font-face）
├─ constants/     iconMap.js（85 个图标名→Unicode 私有区码点）
├─ composables/   useTheme.js（深浅主题切换，存储键 xingtu_theme）
├─ utils/         request.js（唯一请求封装）
├─ static/        fonts/xingtu-icons.{ttf,woff2}、logo.png
├─ pages/         role-select、login、jobseeker/index、enterprise/index、enterprise/chat、
│                 admin/index、index/index（脚手架 Hello 残留，无任何入口引用）、webview
└─ components/
   ├─ common/     AppIcon.vue（图标渲染）
   ├─ jobseeker/  JobseekerShell + 20 个业务视图组件 + match/ 子目录（16 组件 + regionData.js）
   ├─ enterprise/ EnterpriseShell + 16 个业务视图/弹窗组件（含 Three.js 3D 与雷达图）
   └─ admin/      AdminShell + 5 个管理子组件（用户/职位/模型/资源/质检）
```

### 2.4 与原生微信小程序教程的差异（重要）

本项目为 **uni-app Vue3**：**没有 `App.js`**，不要按原生小程序教程创建 `App.js`。App 级初始化与 `wx.cloud.init` 的合理位置是 `src/App.vue` 的 `onLaunch`（编译后即小程序 `App()` 的 `onLaunch`）。当前生产请求层并未使用 `wx.cloud`（详见 §13）。

---

## 3. 整体信息架构

架构特征：**一个入口页 + 三个"壳页面" + 一个全屏聊天页 + 一个 web-view 容器**；每端在壳内用 `currentPage` 状态 + `v-if` 做视图路由（组件级路由），底部固定导航为自绘底栏。

```
pages.json 路由
├─ pages/role-select/role-select   （启动页：选择 求职者/企业/管理员）
├─ pages/login/login?role=xxx      （登录/注册，按角色进入）
├─ pages/jobseeker/index ──> JobseekerShell（14 个视图，5 项底栏）
├─ pages/enterprise/index ─> EnterpriseShell（9 个视图，5 项底栏）
├─ pages/enterprise/chat   （企业-候选人 1 对 1 聊天全屏页，custom 导航）
├─ pages/admin/index    ──> AdminShell（4 大页签 + 数据下钻子页）
├─ pages/webview/webview?url= （学习资源外部链接容器，由求职者端跳入）
└─ pages/index/index    （uni 脚手架 Hello 残留，无入口引用，未使用）
```

跨"页"跳转事实：

- 进入角色：`uni.navigateTo` 到登录页并携带 `role=jobseeker|enterprise|admin`。
- 登录成功：`uni.reLaunch` 到对应端首页；退出登录统一清理 `xingtu_token / xingtu_role / xingtu_user` 后 `reLaunch` 回角色选择页（三个 Shell 均如此）。
- 壳内切换：`provide('jobseekerNav', {currentPage,setPage})` / 企业端 Shell 自行 `setPage`；**不是** `navigateTo` 的物理页面跳转。
- 学习资源：`uni.navigateTo` 打开 `/pages/webview/webview?url=...`（web-view 外链）。
- 企业聊天：`uni.navigateTo` 打开 `/pages/enterprise/chat?match_record_id=...&candidate_name=...&job_title=...&match=...`。
- **无 App 级登录守卫 / 自动续登逻辑**：每次冷启动都先到角色选择页；也没有基于已存 token 的自动跳转。

---

## 4. 用户角色与功能

### 4.1 求职者端（`JobseekerShell`，底栏 5 项：工作台 / 岗位图谱 / 岗位 / 学习 / 趋势）

| 视图 | 功能（依据实际代码） |
|---|---|
| Dashboard 工作台 | 欢迎卡、4 个硬编码统计（岗位 2817/技能 1024/新岗位 12/用户 8642，`StatsCounter` 滚动动画）、快捷四宫格（上传简历/浏览岗位/人岗匹配/趋势洞察）、最近诊断与学习进度（读本地缓存 `jt_diagnosis_history`/`jt_mastered_skills`），**无网络请求** |
| JobMatch 岗位（匹配主流程） | 技能准备（上传简历或手动技能）→ 智能推荐（`POST /api/match/recommend?n=10`）→ 岗位列表/搜索/筛选（`GET /api/jobs?size=500`）→ 进详情/诊断；技能存 `jt_selected_skills` |
| JobDetail 岗位详情 | 由本地 `jt_job_detail` 渲染岗位字段；可发起"岗位诊断"（写缓存后跳 Diagnosis） |
| Diagnosis 岗位诊断 | `POST /api/match/analyze` 人岗匹配分析；展示匹配总分/四维分数/技能差距/总结建议；本地生成学习路径 phases 并写入 `jt_diagnosis_result/history` |
| LearningPath 学习 | 按诊断 phases 展示阶段/目标/技能掌握（`learning.toggleMastered`，后端 `GET/POST /api/learning/skills`）；点技能取学习资源 `POST /api/chat/resources`，资源卡片跳 web-view 外链；24h 内诊断有效 |
| LearningReport 学习报告 | 读取 `jt_diagnosis_history` 列表与单条报告（时间线/建议），可删除；**壳内已注册视图但 UI 无入口**（无任何 setPage 调用） |
| ResumeCenterPage 简历中心 | 多简历列表/宫格、搜索排序、AI 生成简历弹窗（`POST /api/resume-center/generate`）、按模板新建（`POST /api/resume-center`）、删除/分享复制链接；编辑入口仅 toast"即将开放" |
| ProfileHome 个人主页 | 展示/编辑资料（`GET/PUT /api/auth/profile`）、头像上传（`/api/auth/avatar`）、简历导入解析（`/api/auth/resume-parse`） |
| ProfileEdit 个人资料编辑 | 独立全量表单（联系方式/基本信息/简介/技能），`GET/PUT /api/auth/profile` |
| Resume 简历管理 | 上传简历自动解析（`POST /api/auth/resume-parse`）、历史列表/重解析/删除/导出（`resume-history`、`resume-reparse`、`resume-delete`）、解析结果回填资料（`PUT /api/auth/profile`） |
| SkillGraph 岗位图谱 | **静态演示版** Canvas 3D 岗位-技能图谱（节点/连线硬编码），可分类筛选，无请求 |
| MySkillGraphPage 我的图谱 | 真实用户技能（`GET /api/auth/profile`）Canvas 圆环图谱；点技能查关联岗位（`GET /api/jobs?skill=`）；公司名弹 `CompanyCard`（`GET /api/company/public/{name}`） |
| Trend 趋势洞察 | 三 Tab（趋势/新岗位/更新）SVG 图表，**本地静态数据**渲染，无请求 |
| TutuChat 图图 | 全局悬浮 AI 助手弹窗，`POST /api/chat`（携带 diagnosis+history 上下文），失败回退本地关键词库 |
| 其它 | FeaturePlaceholder（兜底占位）；底部用户菜单（头像点开）：个人主页 / 简历管理 / 我的图谱 / 简历中心 / 退出登录 |

**关于"消息/站内信"**：求职者端源码中**不存在消息列表/聊天功能**（`JobseekerHeader` 铃铛仅为装饰，无 tap 逻辑）。请不要在小程序说明中把求职者端写成"有消息中心"。

### 4.2 企业端（`EnterpriseShell`，底栏 5 项：工作台 / 岗位管理 / 人才星 / 消息 / 市场洞察）

| 视图/组件 | 功能（依据实际代码） |
|---|---|
| EnterpriseDashboard 工作台 | `GET /api/enterprise/dashboard`：4 KPI（在招职位/匹配候选人/高匹配≥85/待沟通）、近期岗位、匹配度分布三档、快捷入口；岗位状态映射 active=招聘中/draft=草稿/closed=已关闭 |
| EnterpriseJobManage 岗位管理 | 岗位列表/状态筛选（含计数）/搜索；详情弹窗；创建与编辑表单（`GET/POST /api/enterprise/jobs`、`GET/PUT/DELETE /api/enterprise/jobs/{id}`）；上下架 `PATCH /api/enterprise/jobs/{id}/status`；删除前二次确认并提示级联清理匹配记录 |
| EnterpriseTalentSearch 人才星 | 候选人搜索/岗位标签筛选（`GET /api/enterprise/candidates`）、**重新匹配**（`POST /api/enterprise/run-match`）、长按多选对比：雷达对比 `POST /api/enterprise/candidates/compare`、AI 深度对比 `POST /api/enterprise/candidates/deep-compare`；点候选人发起沟通跳 `/pages/enterprise/chat` |
| EnterpriseConversations 消息 | 会话列表 `GET /api/enterprise/conversations?size=100`，未读数上抛给 Shell（Shell 每 30s 轮询 `?size=1`）；空态引导"在人才星发起沟通" |
| 聊天页 pages/enterprise/chat | 与候选人 1 对 1 会话：`GET /api/enterprise/messages/{id}?size=100` 历史、`POST /api/enterprise/messages/read` 已读、`POST /api/enterprise/messages` 发送；**无轮询、无 WebSocket**，发送后本地追加气泡 |
| EnterpriseChatDialog | 遗留聊天弹窗组件，全库无 import（死代码），勿在文档中表述为在用功能 |
| EnterpriseMarketInsight 市场洞察 | 嵌 3D 图谱 + 三栏（快速增长/需求下降/新兴岗位）；**代码注释明确为硬编码数据，与 Web MarketInsight.tsx 1:1 对应，无网络请求** |
| EnterpriseMarketInsight3D | Three.js WebGL 3D 岗位-技能图谱（Canvas），20 节点/24 关联为硬编码常量；支持拖动/缩放/点选，仅展示 |
| EnterpriseRadarChart | 内联 SVG 五维雷达图（对比用），无请求 |
| EnterpriseIndustryReport 行业报告 | 4 份硬编码报告列表；下载按钮为占位空函数，无真实下载接口 |
| EnterpriseCompanyProfile 企业信息 | 企业资料展示/完整度；认证流程（官网认证/三方认证 = `PUT /api/auth/profile` `verified:1/2`）；岗位统计 `GET /api/jobs/stats?company=`；企查查/天眼查复制搜索链接 |
| EnterpriseCompanyProfileEdit 编辑企业信息 | 全屏编辑表单（名称/行业/规模/官网/简介/福利），`GET/PUT /api/auth/profile`，带必填校验与 200 字计数 |
| EnterpriseCompareModal / DeepCompareModal | 雷达对比结果弹窗 / AI 多 Agent 深度对比结果弹窗（排序推荐+优势劣势风险），数据由父级传入，自身无请求 |

### 4.3 管理员端（`AdminShell`，底栏 4 项：首页 / 数据 / 模型 / 质检）

| 页签/子页 | 功能（依据实际代码） |
|---|---|
| 首页（home） | "智能质量控制中心"概览卡 + 质量指标占位（JD 解析精确率/简历提取精确率/人岗匹配准确率，均显示"待测试/--"）+ 风险检测摘要 + 快捷操作；**数字全部静态硬编码，不发请求** |
| 数据 → 求职者管理 | `AdminUserManage role=jobseeker`：分页/关键词搜索/创建账号/重置密码/删除（`GET/POST /api/admin/jobseekers`、`POST .../{id}/reset-password`、`DELETE .../{id}`）；**无编辑资料、无封禁/启停、无认证审核按钮** |
| 数据 → 企业管理 | 同一 `AdminUserManage role=enterprise` 渲染 `/api/admin/enterprises*`；仅展示 `verified` 状态，无修改认证操作 |
| 数据 → 职位管理 | `AdminJobManage`：全平台职位搜索/状态筛选/删除（`GET /api/admin/jobs`、`DELETE /api/admin/jobs/{id}`）；**无创建/编辑/上下架能力** |
| 数据 → 学习资源管理 | `AdminResourceManage`：资源 CRUD（`GET/POST /api/admin/resources`、`PUT/DELETE /api/admin/resources/{id}`），技能筛选、搜索、类型（文档/教程/视频/课程/搜索）、排序；**该页面不显示管理员导航返回头** |
| 模型 | `AdminModelConfig`：LLM 三档（strong/fast/vision）配置 provider/model/base_url/api_key，全局开关、Mock 模式、逐档连通测试（`GET/POST /api/admin/llm-config`、`POST /api/admin/llm-config/test`） |
| 质检 | `AdminQuality`：幻觉防控质检看板（`GET /api/quality/report` 及 `accuracy-test / match-test / resume-test`），JD 解析/简历提取精确率、人岗匹配准确率、多源交叉验证、JD 抄袭检测、技能通胀检测；**绕过统一 request 封装，自带同址硬编码 API 常量** |

> 关于"简历模板管理"：管理员端**没有**简历模板管理功能；简历模板仅存在于求职者端 `ResumeCenterPage`（读取 `GET /api/resume-center/templates/list` 供新建/生成使用）。请勿在小程序管理员端描述中写入"简历模板管理"。

---

## 5. 页面与导航设计

- **无原生 TabBar、无侧滑抽屉、无小程序页面栈式多级**：物理页面只有入口、登录、三个壳、企业聊天、web-view、脚手架残留；壳内用 `currentPage` + `v-if` 切视图。
- 三端底栏均为自绘：求职者/企业 5 项（高 112rpx、安全区适配、激活色/图标底高亮），管理员 4 项。
- 视图跳转统一由 `setPage`/`onNavigate` + `navParams` 携带参数（如岗位选中 id、自动对比、聊天参数）。
- 企业端聊天是**唯一真正 push 到独立全屏页面**的会话交互；学习资源经 web-view 外链打开第三方网页。
- 多处"已实现组件/视图但无入口或未接线"：`LearningReport`（无入口）、`match/` 下的 `Sidebar / RecommendationCarousel / LearningPath / LearningTimeline / LowConfidenceBanner`（未被组件图引用）、`EnterpriseChatDialog`（无 import）。文档中应按"实际可到达的功能"来描述。

---

## 6. UI 视觉设计（基于 `src/styles/theme.css` 与各组件 <style>）

### 6.1 令牌系统（Material-3 风格 CSS 变量，亮/暗两套）

关键令牌（完整值见 `theme.css` 6–201 行）：

- **亮色**（`.theme-light`）：主色 `--color-primary:#0052D9`；辅助 `--accent-purple:#5B21B6`、`--accent-green:#059669`、`--accent-orange:#D97706`、`--accent-red:#DC2626`；背景 `--color-background:#F8F9FF`、卡片面 `--color-surface-container-lowest:#FFFFFF`、浅蓝面 `-low:#EEF4FF`/`(base):#E5EEFF`；文字 `--color-on-surface:#191C1E`、`--color-on-surface-variant:#434654`；描边 `--color-outline-variant:#E1E2E4`。
- **暗色**（`.theme-dark`）：主色 `--color-primary:#6B9EFF`；背景 `--color-background:#0A0E1A`、最深 `-lowest:#0F1422`；辅助紫 `#A78BFA`、绿 `#34D399`、橙 `#FBBF24`、红 `#F87171`。
- 字体：`--font-headline: Manrope/Noto Sans SC/...`；`--font-body: Inter/PingFang SC/Microsoft YaHei/...`（代码中以 Inter/PingFang 组合为主；Manrope/Inter 未随包携带，实际回退系统字体）。
- 全局 `.gradient-text` 使用 `linear-gradient(135deg, primary, purple)` 渐变文字。

### 6.2 角色主题色（代码内可见的"角色色彩语言"）

- **求职者 = 蓝/青**：入口辉光/描边 `#00C8FF`、图标 `accent-cyan-dim` + 主色蓝；激活导航用 `--color-primary`。
- **企业 = 紫**：入口辉光 `#7C3AED`、激活导航 `--accent-purple`、徽章 `--accent-purple-dim`。
- **管理员 = 绿**：品牌/徽章/头像统一绿色（`--accent-green`/`#059669`，AdminShell 大量硬编码 `#009958`）。
- 语义色各端通用：绿=成功/高匹配、橙=警告（草稿/低预警）、红=错误/风险（如未读角标 `#DC2626`）。

### 6.3 深浅主题机制

- `composables/useTheme.js`：存储键 `xingtu_theme`（仅 `dark|light`），`themeClass='theme-'+theme`，`toggleTheme()` 翻转并持久化。壳/入口根节点绑定 `themeClass`，子组件靠 CSS 变量继承。
- **不是系统跟随**（未声明 `darkmode`）；且**管理员端未绑定 themeClass**，`AdminShell` 及其子页永远呈现浅色控制台（其样式大量使用带浅色 fallback 的硬编码 hex）。
- 一致性偏差：求职者组件（Dashboard/ProfileHome/Resume 等）与企业 Dashboard 以令牌为主；企业 `EnterpriseTalentSearch`、`EnterpriseCompanyProfile` 与整个管理端以硬编码浅色为主（量化见代码）。

### 6.4 通用视觉惯例

- **单位**：`rpx` 绝对主导；px 仅用于细边框（`1px solid`）、个别圆角与 H5 细节；无 vw；全屏容器用 `height:100vh`/`min-height:100vh`。
- **卡片**：`1rpx solid var(--color-outline-variant)` + `background: var(--color-surface-container-lowest)`；圆角主流 24rpx（大卡）/20rpx（紧凑）/16–14rpx（控件/按钮）；管理端卡片更强调投影（如 `0 8rpx 24rpx rgba(31,41,55,.045)`、绿色主卡 `0 18rpx 45rpx rgba(5,150,105,.18)`）。
- **按钮**：主按钮实底主色、圆角 14rpx；品牌渐变按钮 `linear-gradient(135deg, var(--color-primary), var(--accent-purple))`；管理员按钮多用绿色系渐变。
- **图标体系**：自定义图标字体 `xingtu-icons`（ttf/woff2，`iconfont.css` @font-face 注册）；`constants/iconMap.js` 定义 85 个语义图标名到私有区码点（U+E001…）；`components/common/AppIcon.vue` 统一渲染 `<text class="iconfont">`。
- **深空/星图视觉语言**：角色选择页有极光（`aurora` 模糊色带动画）、暗色下的星空点阵（`star-field`，`background-image` 多层 `radial-gradient(1px 1px ...)`）、星轨描边卡（流动光带 + 呼吸辉光）；Dashboard 欢迎卡带弥散光斑（`filter:blur(56rpx)`），暗色背景 `#0A0E1A`。整体呈现"深空蓝紫 + 高亮青绿"氛围。
- **字体层级**：品牌标题（Manrope 700/渐变）、页标题（约 32–42rpx 700–800）、卡片标题（24–30rpx 600–750）、正文（22–28rpx）、说明（19–24rpx）、标签（18–20rpx）。

---

## 7. 页面布局设计

- **三端统一布局**：`flex column` 全屏容器（100vh）+ 顶部自绘 Header（可选）+ `scroll-view` 主内容（`flex:1; min-height:0`，底部预留 112rpx）+ `position:fixed` 自绘底栏。管理员 Header 额外用 `env(safe-area-inset-top)`。
- 求职者：Header（品牌 + 主题按钮 + 铃铛装饰 + 头像菜单）→ 内容（`LearningProvider` 包裹各视图）→ 5 项底栏；悬浮"图图"机器人常驻右下。
- 企业：Header（仅除全屏编辑页外显示）→ 内容 → 5 项底栏；消息未读红点角标（>99 显示 99+）；编辑企业信息为无 Header/无底栏的全屏表单。
- 管理员：品牌栏（星图·管理员）+ 滚动内容 + 4 项底栏；"数据"页签内还有一层"数据子页"（带返回头的下钻管理页）。
- 首页/工作台：欢迎/总览卡（KPI 网格、完整度进度）在上，列表/宫格/区块化内容在下，区块标题带"查看全部"箭头。
- 列表卡片：卡片纵向堆叠，右侧箭头/操作；候选人卡支持点击展开五维条、长按进入多选对比。
- 详情/表单：详情以弹窗或全屏表单呈现；登录页为单卡片居中（max-width 约 680–682rpx）。
- 弹窗：统一模态遮罩 + 圆角面板（多数 20–28rpx）+ 可滚动 body；比较弹窗内嵌 SVG 雷达图。

---

## 8. 交互设计

- **加载/空/错三态**：Dashboard/列表页普遍提供 loading、空数据引导、错误重试（如企业聊天页"重新加载"）。
- **刷新**：企业人才星使用 `scroll-view` 下拉刷新（`refresher-enabled`）；企业消息未读为 30s `setInterval` 轮询；其余页面以骨架屏（`match/Skeleton`）与按钮态为主，未见普遍"下拉刷新"。
- **搜索/筛选**：求职者岗位筛选为客户端匹配（关键词 + 省市区三级 picker，数据源 `regionData.js`）；企业岗位/候选人走后端 query 参数（keyword/job_id/status）。
- **表单提交**：统一按钮 loading 态 + Toast；必填前端校验；保存成功回退上一视图。
- **文件上传**：`uni.chooseMessageFile`（简历，限 pdf/docx/doc/txt）与 `uni.chooseImage`（头像），上传统一 `uploadFile()`（30s 超时）或个别处直连 `uni.uploadFile`。
- **AI 对话**：图图为悬浮弹窗输入框（confirm/发送），消息流式 push（"思考中..."→答复），非流式 HTTP POST；企业 AI 深度对比为"启动分析 → 预计 10–20 秒"的阻塞态弹窗。
- **图表交互**：Canvas 图谱支持拖动/双指缩放/点击聚焦（点选节点显示详情）；雷达图纯展示。
- **主题切换**：入口与三端 Header 均提供亮/暗切换。

---

## 9. 移动端适配

- **rpx 自适应**为主（默认 750 设计宽），少量 px 用于 1px 细边框。
- **安全区**：底栏统一 `padding-bottom: calc(10rpx + env(safe-area-inset-bottom))`；管理员/聊天页顶部 `env(safe-area-inset-top)`；企业聊天输入条 `calc(16rpx + env(safe-area-inset-bottom))`。
- **全屏布局**：各壳 `height:100vh` + `scroll-view` 纵向滚动、隐藏滚动条；防页面级双滚动（`uni-page-body{overflow:hidden}`）。
- **@media 仅少量用于宽屏（H5）**（如 `min-width:700px` 调整底栏左右留白），小程序端影响有限。
- 其它微信端处理：web-view 外链加载学习资源；Canvas 在小程序端通过 `uni.createSelectorQuery().select('#id').fields({node,size})` 获取 2D 画布节点；`three` 渲染路径在小程序端取节点、H5 端取真实 canvas（组件内已做平台分支）。manifest 未开启 `transformPx`（保持 rpx）。

---

## 10. 数据交互与 API

### 10.1 请求封装（`src/utils/request.js`）

- `API_BASE_URL = 'http://192.168.156.230:8081'`（**硬编码于该文件**；仅此一处统一基址，另有 `AdminQuality.vue` 重复硬编码同址常量、`AdminResourceManage.vue` 显式二次调用 `withToken` 造成重复 token 的代码瑕疵）。
- `withToken(url)`：从 storage `xingtu_token` 读取，以 **query 参数 `?token=`** 拼接到 URL（**不是 Authorization Header**）；`request()` 默认 `auth=true`。
- `request({url,method,data,auth})`：`uni.request`、`Content-Type: application/json`、超时 15s；`uploadFile` 超时 30s。
- 个别直连：`ProfileHome.vue` 头像上传用带 `Authorization: Bearer` 的原生 `uni.uploadFile`；`AdminQuality.vue` 自带 `uni.request` 直连。
- 登录态：登录成功写入 `xingtu_token`（token）、`xingtu_role`、`xingtu_user`；退出仅清这三键。角色选择→登录→对应端首页。

### 10.2 API 调用统计（代码 grep 结果）

- 源码中可直接检索到的 `/api/...` **去重 URL 字面量约 40 个**（含动态模板如 `/api/enterprise/jobs/{id}`、`/api/admin/jobseekers` 由常量拼接等，实际**去重接口路径约 55–60 个**；若按"URL+HTTP 方法"拆分，约 **65 个调用形态**）。
- 业务类别：
  1. **认证/用户/资料**：`/api/auth/send-code`、`login`、`register`、`admin/login`、`profile`(GET/PUT)、`avatar`、`resume-parse`、`resume-history`、`resume-reparse`、`resume-delete`；
  2. **岗位/公司**：`/api/jobs`、`/api/jobs/stats`、`/api/company/public/{name}`；
  3. **匹配/诊断/推荐**：`/api/match/analyze`、`/api/match/recommend`、`/api/learning/*`；
  4. **AI 对话/资源**：`/api/chat`、`/api/chat/resources`；
  5. **简历中心**：`/api/resume-center/*`（templates/list、list、generate、share、CRUD）；
  6. **企业端**：`/api/enterprise/dashboard|jobs|jobs/{id}(/status)|candidates|run-match|candidates/compare|deep-compare|conversations|messages|messages/read`；
  7. **管理员**：`/api/admin/jobseekers|enterprises|jobs|llm-config|llm-config/test|resources`；
  8. **质检**：`/api/quality/report|accuracy-test|match-test|resume-test`。
- **后端复用**：以上均为当前 FastAPI 后端 API（基址为 `192.168.156.230:8081` 的 `/api/...`），与 Web 前端共用后端；未发现小程序独有后端。
- **上传**：头像、简历上传两类（含 formData token 或封装 uploadFile）。
- **潜在注意点（代码级）**：token 以 query 传输、`xingtu_saved_login` 明文存密码且无回读（"下次自动填充"仅为文案）、登出不清 `xingtu_saved_login`、`AdminQuality` 副作用操作用 GET 触发。

---

## 11. AI 功能设计

| 能力 | 使用入口 | 代码行为（前端侧） | 后端接口 |
|---|---|---|---|
| 图图 AI 对话 | 求职者端全局悬浮"图图" | 组织本地诊断上下文（读 `jt_learning_report`，但**该键当前无组件写入**，通常为空）与最近 6 条历史 → 请求；失败/无 answer 回退本地关键词知识库 | `POST /api/chat` |
| 学习资源推荐 | 学习路径页点技能 | 携带目标技能取资源列表，卡片打开 web-view 外链 | `POST /api/chat/resources` |
| AI 简历解析 | 求职者简历管理/个人主页 | 上传文件解析，UI 文案提及 DeepSeek 或规则提取；结果以字段卡+置信度标签展示 | `POST /api/auth/resume-parse`（+reparse/history） |
| AI 生成简历 | 简历中心 | 目标岗位/年限/行业/技能/模板 → 生成内容 | `POST /api/resume-center/generate` |
| 人岗匹配/诊断 | 岗位匹配、岗位诊断 | 五维匹配分、差距分析、学习路径规划 | `POST /api/match/recommend`、`POST /api/match/analyze` |
| 企业 AI 深度对比 | 人才星多选对比 | 多 Agent 深度对比结果弹窗（排序推荐/优势劣势风险） | `POST /api/enterprise/candidates/deep-compare` |
| 管理员模型配置/质检 | 模型页/质检页 | 三档 LLM 配置+连通测试；Mock 模式默认开启（不真正调用外部 LLM）；质检测试按钮（DeepSeek 等后端执行） | `GET/POST /api/admin/llm-config`、`/test`、`/api/quality/*` |
| 图图本地兜底 | 无网络/后端异常 | 内置本地关键词答复库（LangChain/RAG/Agent/MCP/求职等 11 类） | 无（前端本地） |

用户在小程序中的使用方式均为"界面操作触发 → 前端封装 `request()` → FastAPI 后端执行业务/调用大模型 → 返回结果渲染"。**小程序本身不直连大模型**（LLM 由后端统一路由/配置，管理端可配置 provider/model/api key 与 Mock 模式）。

---

## 12. 小程序与系统后端的关系

```
微信小程序（uni-app Vue3 编译为 mp-weixin）
   │  uni.request / wx.uploadFile（封装于 src/utils/request.js）
   ▼
FastAPI 后端（业务 API，基址 http://192.168.156.230:8081，/api/...）
   │
   ▼
MySQL / Neo4j / AI 服务（LLM 路由与质量质检由后端承接）
```

- 数据交互方式：**HTTP REST JSON**，登录态以 `?token=` 查询参数传递；文件经 multipart 上传。无 WebSocket、无 SSE 流式（对话为一次性 POST）。
- 后端全部复用现有 FastAPI；小程序无独立业务后端。求职者端部分"看板/图谱/趋势"数据为**前端硬编码或本地缓存**，企业市场洞察/行业报告亦为静态数据，属"数据未接后端"的占位实现，与 Web 端真实接口不同源。
- 3D/图谱渲染在端内完成（three、Canvas、SVG），不依赖后端返回图形。

### CloudBase / AnyService 现状（单独说明）

当前**生产请求层没有使用 wx.cloud / CloudBase**。唯一相关代码是 `src/App.vue` `onLaunch` 内、`#ifdef MP-WEIXIN` 包裹、明确标注 `TEMP AnyService connectivity test (remove after verify)` 的**遗留连通性测试块**：它调用 `wx.cloud.init({ env: 'xingtu-d5g6yf2jy4a899a2e', traceUser: true })`，再以 `wx.cloud.callContainer({ path:'/api/health', method:'GET', header:{'X-WX-SERVICE':'tcbanyservice','X-AnyService-Name':'xingtu',...} })` 探测健康检查，并把结果写入本地缓存键 `anyServiceHealthTestResult`。该块仅用于验证"小程序→CloudBase AnyService→后端 /api/health"链路，未接入任何业务 API，业务仍直连 FastAPI。若你的部署文档要写"已接入 AnyService"，应仅在注明"连通性验证、非业务流量"的前提下描述；创建环境/AnyService 配置/开发者工具设置等部署步骤不在本代码审计范围内。

---

## 13. 已核实的技术事实速查

- 微信端初始化位置：`src/App.vue` `onLaunch`（非 App.js）。
- 无 TabBar（pages.json），底栏为壳内自绘。
- 无登录守卫/自动续登；冷启动进角色选择页。
- 管理员端不支持暗色主题（未绑定 themeClass，样式硬编码浅色）。
- `pages/index/index.vue` 为脚手架 Hello 残留，无引用。
- 求职者"消息中心"、企业"消息"仅企业端存在；求职者端无。
- 聊天无 WebSocket（历史拉取+发送+本地追加）。
- 求职者诊断结果写入本地 `jt_diagnosis_result/history`；`TutuChat` 读的 `jt_learning_report` 当前无人写入。
- 主色蓝 #0052D9 / 紫 #5B21B6 / 绿 #059669（亮色），暗色为 #6B9EFF/#A78BFA/#34D399。

---

## A. 建议加入现有项目文档的内容

1. 端定位与技术栈（uni-app Vue3 + Vite + 微信小程序，Vue 3.0.0-alpha 系列，见 §1–2）。
2. "壳-SPA"信息架构与自绘底栏（区别于 Web 的多页路由；无原生 TabBar）。
3. 三端用户角色与功能矩阵（§4），**按实际可达视图撰写**。
4. 主题系统与角色色彩语言、图标字体机制（§6）。
5. 请求封装、API 基址与 token 传递约定、约 65 个接口调用形态的类别划分（§10）。
6. AI 能力清单（对话/诊断/简历解析/生成/学习资源/企业深度对比/质检），并注明由后端承接（§11）。
7. 架构图：小程序→FastAPI→MySQL/Neo4j/AI；注明 AnyService 仅连通性验证（§12–13）。
8. 移动端适配要点（rpx、安全区、100vh+scroll-view、Canvas 平台差异、web-view）。

## B. 现有项目文档需要同步修改/核对的地方

1. 若文档写"小程序有消息中心/简历模板管理/企业实时聊天(WebSocket)"等，需改为：求职者端无消息；管理员无简历模板管理；聊天为 HTTP 非实时。
2. 若文档写"所有页面遵循深浅主题"，需注明管理员端为浅色控制台风格。
3. 若文档列举 API 数"64 个"：小程序端实际去重路径约 55–60、URL+方法形态约 65；请核对后端是否还有未在小程序使用的接口，避免把后端接口全集写成"小程序已接入全集"。
4. API 基址、端口（8081）及 `127.0.0.1:8083 / localhost:8083` 这类残留硬编码应以文档配置说明为准；Web 与小程序共用后端但存在几处本地占位地址。
5. "暗色主题/系统外观"描述应以手动切换、非系统跟随为准。
6. 页面数量与"页面"含义：小程序物理页面仅 8 个注册页（含 1 个脚手架残留、1 个 web-view），大量"页面"是壳内视图——文档信息架构不要写成 30+ 原生页面。

## C. 文档中关于 Web 前端的描述，哪些不能直接代表小程序

1. **多页/路由体系、URL 路径、菜单导航结构**——小程序是壳-SPA + 自绘底栏，无 URL。
2. **Web 版某些页面的真实接口与数据**（尤其 MarketInsight、行业报告等）在小程序端为**静态/硬编码**，不能写"小程序实时市场洞察/行业报告已接入"。
3. **登录态/会话**：Web 常用 Header/Token/Cookie 方案；小程序是 `?token=` 查询参数、`xingtu_*` storage 键，且无自动续登。
4. **消息通知**：Web 如使用轮询/WebSocket 的实时性描述，小程序端**无 WebSocket**，消息为进入页面拉取一次 + 发送后本地追加（企业未读为 30s 轮询角标）。
5. **图表库与 3D**：Web 的图表组件不一定等价于小程序 Canvas/SVG/three 实现；小程序端 Three.js 3D 图谱为静态节点演示。
6. **主题能力**：Web 若全站支持暗色，小程序管理员端不支持。
7. **简历/文档能力**：Web 端如有一键编辑导出等，小程序端"编辑"入口仅为"即将开放"占位、导出为下载/剪贴板简化实现。

## D. 小程序相关信息中无法从代码确认、需人工提供的事项

1. **正式 AppID / 环境归属**：源码未配置 appid；产物中 `wx11e0495a70976c99` 与 AnyService env `xingtu-d5g6yf2jy4a899a2e` 是否匹配、CloudBase 是否归属同一账号，需你在微信公众平台确认。
2. **生产 API 基址**：当前为内网 IP `192.168.156.230:8081`（开发地址），正式域名/HTTPS/小程序 request 合法域名白名单需人工提供。
3. **数据库与后端实现细节**：本仓库为纯前端，MySQL/Neo4j 表结构、后端路由实现、LLM 厂商与密钥、质检阈值实现均在后端工程，需由后端文档补充。
4. **AnyService 遗留临时代码去留**：`App.vue` 的 TEMP 测试块是否删除/保留需你决策（审计未改动）。
5. **`jt_learning_report` 上下文来源**：`TutuChat` 期望读取该键但当前无组件写入，是否需要后端/其它逻辑补写需人工确认（否则图图仅回退本地库）。
6. **未接线/死代码组件的产品口径**：`LearningReport`（无入口）、`match/` 若干备用组件、`EnterpriseChatDialog`（孤儿）是要保留为后续功能还是清理，需产品决策；文档宜先按"可到达功能"描述。
7. **数据口径与静态展示**：Dashboard 统计数字、市场洞察/行业报告硬编码数据是否为演示占位、后续是否接真实接口，需产品/后端确认后再写入正式文档。
8. **文档基准**：我未看到你的《项目部署文档/项目说明文档》原文，本材料按代码整理；合并时请以你的正式文档结构做适配，并核对 Web 前端描述与上述差异点。
