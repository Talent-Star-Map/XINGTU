# ✦ JobMatch 人岗匹配系统 - 完整逻辑说明

## 目录
1. [系统概览](#1-系统概览)
2. [用户操作流程](#2-用户操作流程)
3. [后端 API 逻辑](#3-后端-api-逻辑)
4. [前端组件逻辑](#4-前端组件逻辑)
5. [评分算法详解](#5-评分算法详解)
6. [数据流图](#6-数据流图)

---

## 1. 系统概览

```
┌─────────────────────────────────────────────────────────────────────┐
│                         人岗匹配诊断系统                              │
├─────────────────────────────────────────────────────────────────────┤
│  前端 (React 19 + TypeScript)    │  后端 (FastAPI + Python 3.12)    │
│  ─────────────────────────────   │  ───────────────────────────────  │
│  JobMatch.tsx (主页面)           │  match_api.py (3 个路由)          │
│  ├─ MatchGauge (仪表盘)          │  ├─ /api/match/analyze (分析)     │
│  ├─ DimensionBars (维度条)       │  ├─ /api/match/recommend (推荐)   │
│  ├─ SkillGapCards (技能差距)     │  └─ /api/match/cache (清缓存)     │
│  ├─ LearningTimeline (学习路径)  │                                    │
│  ├─ RecommendationCarousel       │  match_analyzer.py (核心算法)     │
│  ├─ ManualSkillInput (技能输入)  │  ├─ extract_profile_features()    │
│  └─ LowConfidenceBanner          │  ├─ compute_match_score()         │
│                                  │  └─ calc_miss_priority()          │
│  JSNav Context (跨页面导航)      │                                    │
│                                  │  skill_synonyms.py (同义词扩展)   │
│                                  │  quality_checker.py (置信度)      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. 用户操作流程

### 2.1 主流程

```
点击导航「匹配·学习」
        │
        ▼
┌───────────────┐
│ 检测技能画像   │  ← GET /api/auth/profile 检查是否有简历/技能
└───────┬───────┘
        │
        ├─ 有技能 ──→ 底部绿色横幅："已检测到简历技能数据"
        │
        └─ 无技能 ──→ 底部黄色横幅："尚未检测到简历或技能数据"
                           [手动输入技能] [前往简历管理]
                           
        ▼
┌─────────────────────────────────┐
│ 展示岗位卡片网格（3列响应式）    │  ← GET /api/jobs?size=50
│ ┌─────┐ ┌─────┐ ┌─────┐       │
│ │岗位A│ │岗位B│ │岗位C│ ...   │
│ └──┬──┘ └─────┘ └─────┘       │
└────┼────────────────────────────┘
     │ 点击卡片
     ▼
┌─────────────────────────────────┐
│ 全屏 Loading                     │  ← POST /api/match/analyze
│ 正在分析匹配度...                │     + POST /api/match/recommend
└────┬────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ 结果页                                                       │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [岗位: Java后端 · 华为]        [重新分析] [换岗位 ▼] [🗑] │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌──────────────┐  ┌────────────────────────────────────┐   │
│ │   仪表盘      │  │ 四维度匹配分析                       │   │
│ │    78 分     │  │ ████████░░ 技能 72% (权重 50%)     │   │
│ │   等级 B     │  │ █████████░ 经验 80% (权重 20%)     │   │
│ │              │  │ ██████████ 学历 100% (权重 15%)    │   │
│ │              │  │ ███████░░░ 薪资 75% (权重 15%)     │   │
│ └──────────────┘  └────────────────────────────────────┘   │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 技能差距对比                                             │ │
│ │ ✅ 已掌握(3)    ❌ 待提升(5)    🌟 加分项(2)            │ │
│ │ [Java]         [Docker]        [Redis]                 │ │
│ │ [Spring Boot]  [K8s]           [Nginx]                 │ │
│ │ [Python]       [RabbitMQ]                              │ │
│ │ (你已具备的技能) (岗位需要但你还未掌握) (你具备但岗位未要求)│ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 学习路径规划（预计 8-12 周）                              │ │
│ │ ───●───●───●───                                         │ │
│ │ │  │  │  │                                              │
│ │ ▼  ▼  ▼  ▼                                              │
│ │ [核心技能] [进阶能力] [拓宽技能栈]                        │ │
│ │ 2-3周    3-4周    2-4周                                   │ │
│ │ Java     Docker   Redis                                  │
│ │ Spring   K8s     ...                                     │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 诊断总结与改进建议                                        │ │
│ │ 您的匹配度为 78 分，存在 5 项技能缺口...                   │ │
│ │ 1. 优先补 Docker（该技能在 100% 的目标岗位中出现）         │ │
│ │ 2. 可选学 Redis...                                       │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 手动输入技能流程

```
点击「手动输入技能」
        │
        ▼
┌─────────────────────────────────────────┐
│ ManualSkillInput 组件                    │
│ ┌─────────────────────────────────────┐ │
│ │ 🔍 搜索技能...                       │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────┐  ┌───────────────────────┐ │
│ │分类标签  │  │ 技能面板               │ │
│ │💻 编程语言│  │ + Java  + Python      │ │
│ │🎨 前端   │ │ + Go    + Git        │ │
│ │⚙️ 后端   │ │ + MyBatis ...         │ │
│ │🗄️ 数据库 │ │                       │ │
│ │🤖 AI    │ │ (选中后变色 + 打✓)      │ │
│ │...      │ │                       │ │
│ └─────────┘  └───────────────────────┘ │
│                                         │
│ 已选 3 项技能: [Java ✕] [Python ✕] [Git ✕]│
│                                         │
│ [3 项技能 · 匹配「Java后端」]  ← 动态文案 │
└─────────────────────────────────────────┘
```

### 2.3 智能推荐岗位流程

```
无目标岗位时点击「根据 N 项技能 · 智能匹配最佳岗位」
        │
        ▼
POST /api/match/recommend { skills: [...], resume_text: "..." }
        │
        ▼
┌─────────────────────────────────────────┐
│ 智能推荐结果                             │
│ ┌─────────────────────────────────────┐ │
│ │ 🎯 最佳匹配                          │ │
│ │ AI应用开发工程师 · 商汤科技           │ │
│ │ 85分 · 35K-55K · 上海               │ │
│ │ 缺口: Python, 大模型                 │ │
│ │ [点击查看详情 →]                     │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ 云原生工程师 · 阿里云                │ │
│ │ 72分 · 30K-45K · 杭州               │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## 3. 后端 API 逻辑

### 3.1 POST /api/match/analyze

**入参**:
```json
{
  "job_id": 1,                    // 目标岗位 ID（必须）
  "resume_text": "optional",      // 可选：直接传简历文本
  "use_profile_skills": true,     // 是否从用户 profile 读技能
  "use_parsed_resume_cache": true  // 是否用已解析的简历缓存
}
```

**工作流程**:
```
1. JWT 鉴权 → 获取 user_id
2. 加载岗位信息 → SEED_JOBS 中查找 job_id
3. 加载 quality_context → cross_validate() 全技能验证状态
4. 提取用户画像 (按优先级):
   ├─ 直接传入的 resume_text
   ├─ profile 已解析的简历缓存 (uploads/resumes/{uid}_*.json)
   ├─ profile.skills 字段 (用户手动填写的)
   └─ 无画像 → 返回 NO_PROFILE
5. 检查缓存 → 3 分钟内同岗位结果直接返回
6. 计算匹配分数 → compute_match_score()
7. 写入缓存 → 供 3 分钟内复用
8. 返回完整结果
```

**响应**:
```json
{
  "success": true,
  "data": {
    "score_version": "v1.0.0",
    "overall": 78.5,
    "grade": "B",
    "dims": {
      "skill":     {"score": 72, "weight": 0.5, "weighted": 36},
      "experience": {"score": 80, "weight": 0.2, "weighted": 16},
      "education":  {"score": 100, "weight": 0.15, "weighted": 15},
      "salary":    {"score": 75, "weight": 0.15, "weighted": 11.25}
    },
    "skills": {
      "have": [{"skill": "Java", "confidence": 0.85, "verified": true, "is_core": true}],
      "miss": [{"skill": "Docker", "priority": "high", "reason": "高频需求"}],
      "extra": ["Redis"]
    },
    "summary": "您的匹配度为 78 分...",
    "recommendations": ["优先补 Docker...", ...],
    "learning_path_input": {"target_job_title": "Java后端", "missing_skills": [...]},
    "raw_inputs_snapshot": {"profile_skill_count": 3, "matched_count": 2, ...},
    "cache_hit": false,
    "computed_at": "2026-07-15T10:30:00"
  }
}
```

### 3.2 POST /api/match/recommend

**入参**:
```json
{
  "limit": 5,
  "skills": ["Java", "Python", "Git"],  // 直接传入技能列表
  "resume_text": "optional"              // 或传入简历文本
}
```

**工作流程**:
```
1. JWT 鉴权
2. 确定用户技能来源 (优先级):
   ├─ 请求中的 resume_text
   ├─ 请求中的 skills 列表
   ├─ profile 已解析的简历缓存
   └─ profile.skills 字段
3. 遍历所有 SEED_JOBS，逐个 compute_match_score()
4. 按 overall 降序排序
5. 返回前 limit 个
```

### 3.3 DELETE /api/match/cache

**工作流程**:
```
1. JWT 鉴权
2. 删除所有 uploads/resumes/{uid}_* 文件
3. 删除所有 match_cache/{uid}_*.json 文件
4. 清空 profile.skills 和 profile.bio
5. 返回删除文件数量
```

---

## 4. 前端组件逻辑

### 4.1 JobMatch.tsx (主页面)

**状态机**:
```
type MatchState =
  | { kind: 'loading' }                                          // 初始加载
  | { kind: 'no_profile'; reason: 'no_data' }                   // 无简历/技能
  | { kind: 'low_confidence'; confidence: number; ... }         // 解析置信度低
  | { kind: 'matched'; result: MatchResult; recommendations }   // 匹配成功
  | { kind: 'error'; message: string }                          // 出错
```

**核心函数**:
| 函数 | 作用 |
|---|---|
| `loadJobs()` | 加载岗位列表 (GET /api/jobs) |
| `checkProfile()` | 检测用户是否有技能画像 |
| `runAnalyze()` | 执行匹配分析 (POST /analyze) |
| `handleManualSkillsConfirm()` | 手输技能后匹配指定岗位 |
| `handleAutoMatch()` | 手输技能后智能推荐最佳岗位 |
| `buildLearningPhases()` | 按优先级将缺失技能分为 3 阶段 |
| `handleDeleteCache()` | 删除简历和匹配数据 |

### 4.2 子组件

| 组件 | 职责 | 关键 Props |
|---|---|---|
| **MatchGauge** | 圆形仪表盘 + 等级徽章 | `overall: number, grade: string, scoreVersion: string` |
| **DimensionBars** | 4 维度横向条形图 + ⓘ tooltip | `dims: MatchDims, dimensions: Record<string, any>` |
| **SkillGapCards** | 三列对比卡片 | `have: SkillItem[], miss: SkillItem[], extra: SkillItem[]` |
| **LearningTimeline** | 3 阶段纵向时间轴 | `phases: any[], totalWeeks: string, targetJobTitle: string` |
| **RecommendationCarousel** | 推荐岗位横滑卡片 | `jobs: RecommendedJob[], onSelect: (job) => void` |
| **ManualSkillInput** | 分类技能选择器 | `onConfirm, onAutoMatch, onSkip, onGoToResume, targetJobTitle` |
| **LowConfidenceBanner** | 低置信度提示 | `confidenceAvg: number, lowConfidenceSkills: string[], onDismiss` |

---

## 5. 评分算法详解

### 5.1 技能匹配 (权重 50%)

```
jd_skills = ['Java', 'Spring Boot', 'MyBatis', 'MySQL', 'Redis', 'Docker', 'K8s', '微服务', '分布式', 'RabbitMQ', 'Git']

for idx, jd_skill in enumerate(jd_skills):
    is_core = 0.2 if idx < len(jd_skills) // 3 else 0  # 前 1/3 核心
    weight = 1.0 + is_core                               # 核心技能权重 ×1.2

    if jd_skill 在 profile_skills 中（含同义词匹配）:
        verified_bonus = 1.2 if quality_verified else 0.8
        weighted_score += weight × verified_bonus
        have.append(...)
    else:
        miss.append(...)

skill_score = weighted_score / sum(all_weights) × 100
```

**同义词匹配示例**:
- JD "K8s" ↔ user "Kubernetes" (通过 `is_synonym()` 匹配)
- JD "Spring Boot" ↔ user "springboot" (同义词表)

### 5.2 经验匹配 (权重 20%)

```
公式: 1 - |profile_years - jd_midpoint| / jd_range

示例:
  profile = 3 年
  JD = "2-5年" → midpoint=3.5, range=3
  score = 1 - |3 - 3.5| / 3 = 0.833 → 83 分

边界:
  未知经验 → 50 分
  完全匹配 → 100 分
```

### 5.3 学历匹配 (权重 15%)

```
规则:
  博士 = 100
  硕士 =  90
  本科 =  75
  大专 =  50
  高中 =  20
  
  达到要求 = 100
  每差一级 = -25

边界:
  未知学历 → 60 分
  JD 未要求 → 80 分
```

### 5.4 薪资匹配 (权重 15%)

```
规则:
  完全重叠 = 100
  部分重叠 = 重叠比 × 100 + 50 bonus
  无重叠 = max(0, 100 - 距离 × 5)

边界:
  未知薪资 → 70 分
```

### 5.5 综合分数

```
overall = skill × 0.5 + experience × 0.2 + education × 0.15 + salary × 0.15

等级:
  S = 90-100
  A = 80-89
  B = 70-79
  C = 60-69
  D = 0-59
```

### 5.6 缺失技能优先级

```
score = 0
+ 3  岗位核心技能（JD 列表前 1/3）
+ 2  全平台出现率 > 50%
+ 1  全平台出现率 >= 15%
+ 1  邻接技能已掌握（学习成本低）
- 1  出现率 < 10%（长尾冷僻）

核心技能强制晋级:
  if is_core: score = max(score, 4)

优先级:
  high   = score >= 4
  medium = score >= 2
  low    = score < 2

学习路径分组:
  第1阶段 = high 优先级技能
  第2阶段 = medium 优先级技能
  第3阶段 = low 优先级技能
```

---

## 6. 数据流图

### 6.1 完整请求流程

```
用户点击岗位卡片
        │
        ▼
┌───────────────────────────────────────────────────────────────────┐
│ 前端 JobMatch.tsx                                                  │
│                                                                   │
│ 1. setAnalyzing(true) → 显示全屏 Loading                           │
│ 2. POST /api/match/analyze?token=xxx                              │
│    body: { job_id: 1, use_profile_skills: true }                  │
└───────────────────────────────┬───────────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────────┐
│ 后端 match_api.py :: api_match_analyze()                          │
│                                                                   │
│ 1. verify_token(token) → payload                                  │
│ 2. 加载岗位: SEED_JOBS[job_id]                                    │
│ 3. 加载 quality_context: cross_validate(all_jobs)                 │
│ 4. 提取画像: extract_profile_features()                           │
│    ├─ 检查 uploads/resumes/{uid}_*.json 缓存                      │
│    └─ 检查 profile.skills 字段                                    │
│ 5. 检查缓存: match_cache/{uid}_{job_id}.json                      │
│    └─ 3 分钟内 → 直接返回 (cache_hit=true)                        │
│ 6. compute_match_score(profile, job, quality_context)              │
│ 7. 写入缓存                                                       │
│ 8. 返回结果                                                       │
└───────────────────────────────┬───────────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────────┐
│ 后端 match_analyzer.py :: compute_match_score()                   │
│                                                                   │
│ 1. 技能匹配: 遍历 JD skills，同义词匹配 → have/miss/extra         │
│ 2. 经验匹配: _calc_experience_score()                             │
│ 3. 学历匹配: _calc_education_score()                              │
│ 4. 薪资匹配: _calc_salary_score()                                 │
│ 5. 综合加权: skill×0.5 + exp×0.2 + edu×0.15 + salary×0.15       │
│ 6. 等级: S/A/B/C/D                                                │
│ 7. 改进建议: _generate_recommendations()                          │
│ 8. 总结: _generate_summary()                                      │
│ 9. 返回完整 result dict                                           │
└───────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────────┐
│ 前端 JobMatch.tsx                                                  │
│                                                                   │
│ 1. setResult(d.data)                                              │
│ 2. POST /api/match/recommend → setRecommendations(d2.data)        │
│ 3. setStep('result') → 渲染结果页                                 │
│ 4. setAnalyzing(false) → 隐藏 Loading                             │
└───────────────────────────────────────────────────────────────────┘
```

### 6.2 缓存机制

```
首次分析:
  compute_match_score() → 计算 → 写入 match_cache/{uid}_{job_id}.json
                          ↓
                     返回 cache_hit=false

3 分钟内再次请求:
  读取 match_cache/{uid}_{job_id}.json
  检查 created_at 是否在 3 分钟内
  是 → 直接返回缓存 (cache_hit=true)
  否 → 重新计算

强制刷新:
  点击"重新分析"按钮 → 直接调 API → 重新计算（忽略缓存）

清除缓存:
  点击 🗑 → DELETE /api/match/cache → 删除所有缓存文件
```

---

## 7. 关键文件清单

| 文件 | 职责 | 行数 |
|---|---|---|
| `frontend/src/pages/jobseeker/JobMatch.tsx` | 主页面 + 状态机 + 布局 | ~700 |
| `frontend/src/components/match/MatchGauge.tsx` | 圆形仪表盘 | ~80 |
| `frontend/src/components/match/DimensionBars.tsx` | 维度条形图 + tooltip | ~120 |
| `frontend/src/components/match/SkillGapCards.tsx` | 技能差距三列卡片 | ~180 |
| `frontend/src/components/match/LearningTimeline.tsx` | 学习路径时间轴 | ~120 |
| `frontend/src/components/match/RecommendationCarousel.tsx` | 推荐岗位卡片 | ~80 |
| `frontend/src/components/match/ManualSkillInput.tsx` | 技能选择器 | ~200 |
| `frontend/src/components/match/LowConfidenceBanner.tsx` | 低置信度提示 | ~30 |
| `backend/match_api.py` | 3 个 API 路由 | ~250 |
| `backend/match_analyzer.py` | 核心评分算法 | ~450 |
| `backend/skill_synonyms.py` | 同义词扩展表 | ~100 |
| `backend/test_match.py` | 准确率测试 | ~170 |

---

## 8. 配置与常量

```python
# match_analyzer.py
SCORE_VERSION = "v1.0.0"
WEIGHTS = {"skill": 0.50, "experience": 0.20, "education": 0.15, "salary": 0.15}
GRADE_THRESHOLDS = {"S": 90, "A": 80, "B": 70, "C": 60}

# match_api.py
CACHE_TTL_SECONDS = 180  # 3 分钟
MATCH_CACHE_DIR = "match_cache/"
UPLOAD_DIR = "uploads/"

# database.py
JWT_ALGO = "HS256"
JWT_MIN_BYTES = 32  # 强制最低 32 字节
```

---

## 9. 测试

```bash
# 运行准确率测试
cd backend
JWT_SECRET="your-32-byte-secret-key-here!!" python test_match.py

# 预期输出:
# [train]  P=0.895  R=0.973  F1=0.933  (n=70)
# [dev]    P=0.924  R=0.988  F1=0.955  (n=10)
# [test]   P=0.879  R=0.979  F1=0.926  (n=20)  ← 最终指标
# [PASS] Test F1=0.926 >= 0.90
```

---

## 10. 常见问题

**Q: 为什么