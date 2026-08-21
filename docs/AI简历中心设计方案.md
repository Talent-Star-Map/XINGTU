# 求职者端 · AI 简历中心 整合设计方案

> 目标：把开源项目 [JadeAI](https://github.com/LingyiChen-AI/JadeAI)（Apache 2.0）的简历功能**移植**进 XINGTU 求职者端，模板资源在**管理员端管理**。
> 架构约束：沿用 XINGTU 现有 React Vite + FastAPI 前后端分离架构，不引入 Next.js。

---

## 〇、核心设计原则

**1. 模型无关（Model-Agnostic）** —— 所有 AI 功能走统一 LLM 路由层，不绑定任何具体模型。模型选型由**管理员在后台配置**，业务代码不感知。

**2. 「大模型 + 小模型」协同策略** —— 不同任务用不同规模的模型：

| 任务类型 | 模型档次 | 例子 | 理由 |
|---|---|---|---|
| 复杂生成/推理 | **大模型** | 整份简历生成、深度优化、多轮对话 | 质量要求高 |
| 简单提取/分类/判断 | **小模型** | 关键词提取、类别判断、短文本解析 | 快、便宜，够用就行 |
| 结构化解析 | 中/小模型 | 图片 OCR 后结构化、简历字段抽取 | 平衡质量与成本 |

**3. 开发期零成本** —— 开发期用 Mock Provider（返回预设假数据），不调用任何外部 API，不消耗同学 key 额度；答辩前切真实模型。

**4. 管理员可视化配置** —— 模型选型 / key / 参数在**管理员端「模型配置」页面**手动配置（存入数据库），不再硬编码 `.env`。管理员可随时切换模型、开关 mock、测试连通性，答辩现场可演示配置页。

**5. 一个开关切换** —— 全局「模型开关」（Mock / 真实）在配置页一键切换。

---

## 一、整合范围（8 大功能）

| # | 功能 | 说明 | 优先级 |
|---|---|---|---|
| 1 | **AI 简历生成** | 表单/对话输入岗位信息 → 生成完整 6 区块简历 | P0 |
| 2 | **AI 简历优化** | 逐区块/逐条 AI 优化措辞 | P0 |
| 3 | **多格式导出** | PDF / HTML / DOCX | P0 |
| 4 | **简历分享链接 + 二维码** | token 分享 + 二维码 | P0 |
| 5 | **模板画廊 + 拖拽编辑器** | 全量 54 套模板组件化 + 可视化编辑 | P0 |
| 6 | **AI 图片简历解析** | 图片 → 多模态模型/OCR → 结构化（接模型后） | P1 |
| 7 | **AI 职业照** | 文生图模型 API（后续接） | P2 |
| 8 | **模板资源管理员端管理** | 管理员维护模板（增删改/上下架/排序） | P0 |

---

## 二、总体架构

```
┌───────────────────────── 求职者端 (React Vite) ─────────────────────────┐
│  ResumeCenter (新页面入口)                                                │
│  ├─ 模板画廊  ├─ 编辑器(拖拽)  ├─ AI生成/优化  ├─ 解析导入  ├─ 导出/分享    │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │ /api/resume-center/*
┌───────────────────────── FastAPI 后端 ────────────────────────────────────┐
│  routers/resume_center.py (新)                                            │
│  ├─ POST /generate        → LLM 路由层 → 生成 (JSON schema)               │
│  ├─ POST /optimize        → LLM 路由层 → 优化                             │
│  ├─ POST /parse-image     → 多模态/OCR + 解析 (P1)                        │
│  ├─ GET  /export          → PDF/HTML/DOCX                                 │
│  ├─ POST /share           → token + 二维码                                │
│  ├─ CRUD /templates       → 模板管理 (管理员)                             │
│  │                                                                        │
│  ├─ services/llm.py             ★ 统一 LLM 路由层（新增）                  │
│  │     ├─ LLMProvider 接口基类                                            │
│  │     ├─ MockProvider         开发期假数据（零费用）                      │
│  │     └─ 各类真实 Provider    大/小模型（DeepSeek、通义、Qwen 等，后续定）│
│  ├─ services/resume_gen.py     AI 简历生成/优化逻辑                        │
│  ├─ services/resume_export.py  导出引擎 (HTML/PDF/DOCX)                   │
│  └─ database.py 新增模型                                                  │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 ▼
                    MySQL 新增 resume 系列 4 张表
```

---

## 三、★ 核心：LLM 路由层设计（services/llm.py）

### 3.1 设计目标

- **全项目统一入口**：现有 4 处手写 LLM 调用（chat_api / resume_parser / deerflow_compare / selenium_scraper）+ 新增简历功能，全部收敛到这一层
- **模型无关**：路由层不写死模型，模型选型 = 配置，后续定了直接改配置
- **任务分级**：支持「大模型做复杂任务、小模型做简单任务」的协同

### 3.2 接口设计

```python
# services/llm.py
from abc import ABC, abstractmethod

class LLMProvider(ABC):
    """所有模型 Provider 的统一接口"""
    name: str                       # provider 名：mock / deepseek / qwen ...

    @abstractmethod
    def complete(
        self,
        system: str,                # 系统提示词
        messages: list[dict],       # 对话消息
        json_mode: bool = False,    # 是否要求 JSON 输出
        max_tokens: int = 2048,
        **kwargs,                   # 模型特定参数
    ) -> dict:
        """返回 {text, raw, usage, provider} 统一结构"""
        ...

    @abstractmethod
    def complete_json(self, system, messages, **kwargs) -> dict | None:
        """JSON 输出变体（内部处理容错解析）"""
        ...


# 能力分级（大模型 vs 小模型 协同的核心）
class LLMTier(Enum):
    STRONG = 'strong'    # 大模型：复杂生成/推理/长文本
    FAST   = 'fast'      # 小模型：简单提取/分类/判断
    VISION = 'vision'    # 多模态：图片理解（后续）

class MockProvider(LLMProvider):
    """开发期假数据 Provider — 不调用任何外部 API"""
    name = 'mock'
    # 返回结构正确的预设 JSON（模拟真实模型输出，前端可正常开发）
    # 每个能力一个 fixture，如 MOCK_RESUME_JSON / MOCK_OPTIMIZE_RESULT / MOCK_PARSE_RESULT

class DeepSeekProvider(LLMProvider):
    """OpenAI 兼容格式 Provider（DeepSeek/通义/Kimi/Qwen 等 OpenAI 兼容接口都能用）"""
    name = 'deepseek'
    # httpx 调用 /v1/chat/completions
    # 自动处理：JSON mode / 容错解析 / 截断重试

# ─── 路由核心 ──────────────────────────────────────────────
def get_provider(tier: LLMTier = None) -> LLMProvider:
    """根据 .env 配置返回对应 Provider"""
    # 配置示例：
    #   LLM_PROVIDER=mock                → 开发期全 mock（零费用）
    #   LLM_PROVIDER=deepseek            → 全走 DeepSeek（一个 key 搞定）
    #   LLM_PROVIDER=deepseek+qwen       → 大小模型协同（STRONG→大模型, FAST→小模型）
    #   LLM_PROVIDER=qwen_vision         → 多模态（图片解析用）

def complete(tier, system, messages, json_mode=False, **kwargs) -> dict:
    """业务层唯一入口：按任务档次自动路由到对应模型"""
    provider = get_provider(tier)
    return provider.complete(...)
```

### 3.3 大小模型协同路由逻辑

```
业务层调用：complete(tier=LLMTier.STRONG, ...)   # 简历生成 → 大模型
           complete(tier=LLMTier.FAST, ...)      # 技能关键词提取 → 小模型
                    │
                    ▼
              路由层 get_provider(tier)
                    │
      ┌─────────────┼──────────────┐
      ▼             ▼              ▼
  大模型         小模型         多模态
 (复杂生成)     (简单提取)      (图片理解)
      │             │              │
      ▼             ▼              ▼
  统一返回 {text, raw, usage, provider}
```

### 3.4 配置存储（管理员端可视化配置，存入数据库）

模型配置不写死 `.env`，而是存数据库表 `llm_configs`，管理员在后台页面维护：

```sql
-- 模型配置表（管理员端「模型配置」页面维护）
CREATE TABLE llm_configs (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  config_key   VARCHAR(50) UNIQUE NOT NULL,    -- strong_model / fast_model / vision_model /
                                               -- base_url / api_key / provider / global_enabled / mock_mode
  config_value VARCHAR(500) NOT NULL,
  updated_at   DATETIME DEFAULT NOW() ON UPDATE NOW()
);

-- 示例数据
-- ('provider',       'deepseek+qwen')   全局 Provider 组合
-- ('strong_model',   'deepseek-chat')   大模型
-- ('fast_model',     'qwen-turbo')      小模型
-- ('vision_model',   'qwen-vl-max')     多模态（后续）
-- ('base_url',       'https://api.deepseek.com/v1')
-- ('api_key',        'sk-xxx')          统一 key
-- ('mock_mode',      '1')               1=开发期假数据, 0=真实调用
-- ('global_enabled', '1')               总开关
```

**读取优先级**：`llm_configs` 表 → 回退 `.env`（现有 `DEEPSEEK_API_KEY` 等）→ 回退代码默认值。这样管理员没配置时系统仍能跑（用 `.env`），配置了就以管理员的为准。

**配置刷新**：路由层读取时带「内存缓存 + 短 TTL」（如 30s），管理员改配置后无需重启，最多 30s 生效；配置页点「测试连接」可立即验证。

### 3.5 路由层改造范围（现有代码收敛）

| 现有调用点 | 改造方式 |
|---|---|
| `chat_api.py` 图图AI | 改为 `complete(tier=STRONG, ...)` |
| `resume_parser.py` 简历解析 | 改为 `complete(tier=FAST/STRONG, ...)` |
| `deerflow_compare.py` 深度对比 | 改为 `complete(tier=STRONG, ...)`（修掉 LongCat 断链） |
| `selenium_scraper.py` 爬虫标注 | 改为 `complete(tier=FAST, ...)` |
| **新增** resume_gen 简历生成 | `complete(tier=STRONG, json_mode=True, ...)` |
| **新增** resume_optimize 优化 | `complete(tier=STRONG, ...)` |
| **新增** 图片解析 (P1) | `complete(tier=VISION, ...)` |

---

## 四、数据模型设计（MySQL 新增 4 表）

```sql
-- 简历模板表（管理员维护）
CREATE TABLE resume_templates (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,           -- 模板名，如"经典"
  template_key  VARCHAR(50) UNIQUE NOT NULL,     -- 英文 key，对应前端组件 classic
  category      VARCHAR(50) DEFAULT '通用',       -- 分类：经典/现代/极简/创意...
  thumbnail     VARCHAR(500) DEFAULT '',          -- 预览图 URL（管理员上传）
  sort_order    INT DEFAULT 0,
  is_active     TINYINT DEFAULT 1,               -- 上下架
  created_at    DATETIME DEFAULT NOW(),
  updated_at    DATETIME DEFAULT NOW() ON UPDATE NOW()
);

-- 简历主表
CREATE TABLE resumes (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  user_id       INT NOT NULL,                    -- 关联 jobseekers.id
  title         VARCHAR(200) DEFAULT '未命名简历',
  template_key  VARCHAR(50) DEFAULT 'classic',
  language      VARCHAR(10) DEFAULT 'zh',
  created_at    DATETIME DEFAULT NOW(),
  updated_at    DATETIME DEFAULT NOW() ON UPDATE NOW(),
  KEY idx_user (user_id)
);

-- 简历区块表（6 大区块，content 存 JSON）
CREATE TABLE resume_sections (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  resume_id     INT NOT NULL,                    -- 关联 resumes.id
  section_type  VARCHAR(50) NOT NULL,            -- personal_info/summary/work_experience/education/skills/projects
  title         VARCHAR(100) NOT NULL,           -- 中文标题
  content       JSON,                            -- 结构化内容
  sort_order    INT DEFAULT 0,
  visible       TINYINT DEFAULT 1,
  KEY idx_resume (resume_id)
);

-- 分享表
CREATE TABLE resume_shares (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  resume_id     INT NOT NULL,
  token         VARCHAR(64) UNIQUE NOT NULL,     -- 随机 token
  expire_at     DATETIME,                        -- NULL=永久
  visit_count   INT DEFAULT 0,
  created_at    DATETIME DEFAULT NOW()
);
```

> 6 区块 JSON 结构（对齐 JadeAI `generate-resume-schema`，用 pydantic 校验）：
> `personal_info` / `summary` / `work_experience`(items[]) / `education`(items[]) / `skills`(categories[]) / `projects`(items[])

---

## 五、核心模块移植方案

### 5.1 AI 简历生成（resume_gen.py）

```
POST /api/resume-center/generate
  输入: job_title, years_of_experience, skills[], industry, template, language
  流程:
    1. 构造 prompt（严格 JSON schema 约束 6 区块，提示词里写死结构）
    2. complete(tier=STRONG, json_mode=True, max_tokens=16384)  ← 走路由层
       ⚠️ max_tokens 16384：JadeAI issue#87，8K 会截断 JSON 导致解析失败
    3. 容错解析（对齐 JadeAI 的 repairTruncatedJson，python 实现）
    4. pydantic 校验 → 落库 resumes + resume_sections
    5. 失败重试一次（不带 JSON mode，对齐 JadeAI 降级策略）
  返回: {resumeId, title, sections}
```

### 5.2 AI 简历优化

```
POST /api/resume-center/optimize
  输入: section_type, content, instruction (用户想改的方向)
  流程: complete(tier=STRONG, ...) → 返回优化后 content
```

### 5.3 模板组件（全量组件化）

**JadeAI 的核心设计：模板 = 布局，内容无关。** 54 套模板组件**共享同一个 `SectionContent` 渲染器**，每个模板组件只负责页面容器/Header/区块样式。

- 把 54 套模板组件**直接搬进** `frontend/src/components/resume/templates/`（仅去 `'use client'`、改 import 路径、类型定义抄成 `frontend/src/types/resume.ts`）
- `template_key` 与后端 `resume_templates.template_key` 对应

### 5.4 导出引擎（resume_export.py）

| 格式 | 方案 | 依赖 |
|---|---|---|
| **HTML** | 后端拼打印友好 HTML（`forPrint=true`） | 无 |
| **DOCX** | `python-docx` 库 | ✅ requirements 已有 |
| **PDF** | 前端 `window.print()` 打印 HTML → 存 PDF（JadeAI 客户端兜底 #85） | 无 |

### 5.5 分享 + 二维码

- `POST /share`：随机 token → `resume_shares` → 返回链接
- 公开页 `/share/{token}` 免登录渲染
- 二维码：前端 `qrcode` 库转码

### 5.6 图片解析（P1）/ 职业照（P2）

- **图片解析**：路由层预留 `VISION` 档，接多模态模型后启用；过渡期用现有 `resume_parser.py`
- **职业照**：需要文生图模型 API，路由层再扩 `IMAGE` 档，后期接

### 5.7 管理员端模板管理（P0）

```
AdminShell 新增「简历模板管理」页面
  ├─ 模板列表（缩略图 + 名称 + 分类 + 上下架 + 排序）
  ├─ 新增/编辑/删除模板
后端：resume_templates CRUD API（复用 admin.py 的 admin 依赖模式）
```

### 5.8 管理员端模型配置（P0，核心新模块）

**目的**：模型选型不写死代码，管理员在后台可视化配置模型、切换 mock、测试连通性。

**AdminShell 新增「模型配置」页面**（`pages/admin/AdminModelConfig.tsx`，仿 `AdminResourceManage.tsx` 模式）：

```
页面布局
├─ 全局开关
│   ├─ 启用 AI 功能（global_enabled 总开关）
│   └─ Mock 模式开关（mock_mode，开=假数据零费用，关=真实调用）
│
├─ Provider 选择（大模型）
│   ├─ Provider 下拉：deepseek / openai-compatible / qwen / anthropic ...
│   ├─ 模型名：如 deepseek-chat / gpt-4o / qwen-max
│   ├─ API Base URL
│   └─ API Key（掩码显示，保存后不回显明文）
│
├─ 小模型配置（fast tier）
│   ├─ Provider / 模型名 / Base URL / Key
│   └─ 说明：用于关键词提取/分类等简单任务
│
├─ 多模态配置（vision tier，后续）
│   └─ Provider / 模型名 / Key
│
├─ 测试按钮
│   ├─ 「测试大模型连接」→ 发一条测试请求，显示耗时/成功/失败原因
│   ├─ 「测试小模型连接」
│   └─ 「生成测试简历」→ 用当前配置实际生成一份简历，检验全链路
│
└─ 保存按钮（写 llm_configs 表，缓存 30s 后生效）
```

**后端**：`routers/admin.py` 新增 3 个接口（复用 `require_admin`）：

```
GET    /api/admin/llm-config          # 读配置（key 掩码，不回显明文）
POST   /api/admin/llm-config          # 保存配置
POST   /api/admin/llm-config/test     # 测试连通性（发一条真实请求验证）
```

---

## 六、分阶段开发计划

| 阶段 | 内容 | 依赖 | 预计 |
|---|---|---|---|
| **① LLM 路由层** | `services/llm.py`（Mock + 真实 Provider + 路由）+ `llm_configs` 表读写 | 无 | 1-2 天 |
| **② 数据层** | resume 系列 4 张表 + SQLAlchemy 模型 | ① | 0.5 天 |
| **③ AI 生成/优化** | `resume_gen.py` + generate/optimize API（先 mock） | ①② | 2 天 |
| **④ 模板 + 编辑器** | 54 套模板搬入 + 模板画廊 + 编辑器（dnd-kit） | ② | 3-4 天 |
| **⑤ 导出/分享** | 导出引擎 + 分享页 + 二维码 | ④ | 2 天 |
| **⑥ 管理员模板管理** | AdminShell 页面 + CRUD | ④ | 1-2 天 |
| **⑦ 管理员模型配置** | AdminModelConfig 页面 + llm-config 3 接口（配置/测试/切换） | ① | 1-2 天 |
| **⑧ 现有功能接入路由层** | chat_api / resume_parser / deerflow 收敛到 llm.py | ① | 1 天 |
| **⑨ 图片解析 (P1)** | VISION 档接多模态模型 | ⑧ | 2 天 |
| **⑩ AI 职业照 (P2)** | IMAGE 档接文生图模型 | — | 后期 |

**里程碑**：① 先建好路由层（核心基建）→ ②③④⑤⑥ 用 mock 跑通简历全流程（两周）→ ⑦ 管理员可视化配置模型（答辩展示点）→ ⑧ 存量功能收敛 → ⑨⑩ 按模型选型结果补。

---

## 七、代码复用对照表（JadeAI → XINGTU）

| JadeAI 文件 | XINGTU 落点 | 处理 |
|---|---|---|
| `src/components/preview/templates/*.tsx` (54套) | `frontend/src/components/resume/templates/` | 直接搬，去 `'use client'` |
| `src/components/preview/resume-preview.tsx` | `frontend/src/components/resume/ResumePreview.tsx` | 改造 |
| `src/components/editor/*` | `frontend/src/components/resume/editor/` | 搬运（依赖 dnd-kit） |
| `src/lib/ai/generate-resume-schema.ts` | `backend/services/resume_gen.py` | 改写为 pydantic |
| `src/app/api/ai/generate-resume/route.ts` | `backend/routers/resume_center.py` | 改写 |
| `src/app/api/ai/provider.ts` | `backend/services/llm.py` | ★ 借鉴其「模型无关」设计 |
| `src/lib/db/schema.ts` 简历部分 | `backend/database.py` | 改写 MySQL |
| `src/app/api/resume/[id]/export/route.ts` | `backend/services/resume_export.py` | 简化 |
| `src/lib/pdf/generate-pdf.ts` | — | 弃用（改前端打印） |

---

## 八、注意事项

1. **不引 Next.js / AI SDK**：全部改成 XINGTU 的 React Vite + FastAPI + httpx 模式；路由层是自己写 Provider，不依赖 `ai` 包
2. **新依赖**：前端引 `@dnd-kit/core + sortable`（拖拽）、`qrcode`（二维码）；后端无新依赖
3. **模型选型可后置**：路由层定好后，DeepSeek / 通义千问 / Qwen-VL / Kimi 等随时能加 Provider，业务代码不动
4. **版权**：JadeAI 是 Apache 2.0，可自由使用，保留版权声明，答辩可注明借鉴
5. **与现有 resume-parse 的关系**：现有 `POST /api/auth/resume-parse` 保留，resume-center 是完整简历系统，两者可互通（从 Jobseeker 资料一键导入）
6. **Mock Provider 要点**：mock 返回的假数据**必须结构完全正确**（符合 pydantic schema），前端才能正常开发；答辩切真实模型时只换 Provider 不动前端
