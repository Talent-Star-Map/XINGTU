# job - spider_collector
CSDN / 稀土掘金 / 智联招聘 /GitHub 定时采集项目

```markdown
# Job - Article Spider Collector

技术文章与岗位数据采集与清洗系统。

本项目用于自动采集技术社区文章数据和招聘平台岗位数据，目前支持：
- 智联招聘
- CSDN
- 掘金
- GitHub

系统实现了：
- 多关键词文章采集
- 岗位数据采集
- 文章详情解析
- 岗位详情解析
- 原始数据保存
- 数据清洗
- 标准数据入库
- 定时自动采集

# 一、项目启动

## 1. 环境要求

Python：
```
Python 3.13+
```
安装依赖：
```
pip install -r requirements.txt
```
## 2. 启动项目
项目统一启动入口：
```
python run.py
```
启动成功后：
```
文章采集系统启动
```
随后系统进入等待状态。
到达 scheduler 设置的时间后，会自动依次执行 CSDN、掘金、GitHub 采集任务。
智联招聘采集当前处于暂时注释状态，不执行。

# 二、项目整体架构

整体数据流程：
```

                 run.py
                   |
                   |
                scheduler
                   |
    ------------------------------------------------
    |              |              |              |
  智联            CSDN           掘金          GitHub
    |              |              |              |
    |              |              |              |
 job_raw       article_raw   article_raw    article_raw
    |              |              |              |
    |--------------|--------------|--------------|
                    |
                数据清洗模块
                    |
    --------------------------------
    |                              |
 job_info                      article_info
    |                              |
 标准岗位数据                    标准文章数据

```
数据流说明：
1. collector 负责从网站采集原始数据
2. job_raw / article_raw 保存未经处理的原始数据
3. cleaner 对数据进行清洗和标准化
4. job_info 保存最终可使用的岗位数据
5. article_info 保存最终可使用的文章数据

说明：
- 智联采集的是岗位数据，数据链路为：智联 → job_raw → 清洗 → job_info
- CSDN、掘金、GitHub 采集的是文章数据，数据链路为：来源 → article_raw → 清洗 → article_info
- GitHub 仓库数据额外包含 language、summary、update_time 等字段
---
# 三、主要目录说明
## 1. run.py
项目唯一启动入口。

作用：
  启动整个采集系统
  加载定时任务
  捕获运行异常
  控制项目生命周期

启动方式：

```
python run.py
```

不要直接运行 collector。

# 2. scheduler
目录：

```
scheduler/
```


作用：

负责定时任务管理。


主要文件：

```

scheduler/article_scheduler.py

```

功能：

- 每天固定时间启动采集任务
- 调用智联采集
- 调用 CSDN 采集
- 调用掘金采集
- 调用 GitHub 采集
- 控制任务执行顺序（智联 → CSDN → 掘金 → GitHub）
- 智联登录/验证码自动跳过处理


## 修改采集时间


打开：

```

scheduler/article_scheduler.py

````


找到：

```python
TARGET_HOUR = 0
TARGET_MINUTE = 0
TARGET_SECOND = 0
````

例如：

每天上午10点45：

```python
TARGET_HOUR = 10
TARGET_MINUTE = 45
TARGET_SECOND = 0
```

修改这里即可。

---

# 3. collectors

目录：

```
collectors/
```

负责网站数据采集。

---

## 智联招聘采集

文件：

```
collectors/zhilian/collector.py
```

负责：

* 搜索岗位列表
* 获取岗位详情页
* 提取：

  * 岗位名称
  * 公司名称
  * 城市
  * 薪资
  * 学历
  * 经验
  * 岗位类型
  * 岗位描述
  * 技能标签
  * 发布时间

采集完成后：

```
    collector
        |
        |
     job_raw
```

智联采集关键词位于：

```
scheduler/article_scheduler.py
```

修改：

```
JOBS_KEYWORDS
```

采集数量：

```
max_jobs = 5
```

每个关键词最多采集5个岗位。

---

## CSDN采集

文件：

```
collectors/csdn/collector.py
```

负责：

* 搜索文章
* 获取文章详情页
* 提取：

  * 标题
  * 作者
  * 标签
  * 正文
  * 阅读量
  * 点赞量
  * 收藏量
  * 发布时间

采集完成后：

```
    collector
        |
        |
    article_raw
```

---

## 掘金采集

文件：

```
collectors/juejin/collector.py
```

负责：

* 搜索掘金文章
* 获取文章详情
* 获取正文
* 获取互动数据

数据流程：

```
     collector
         |
         |
    article_raw
```

---

## GitHub 采集

文件：

```
collectors/github/collector.py
```

负责：

* GitHub 关键词搜索仓库
* 获取仓库详情页
* 提取：

  * 仓库名称
  * 作者
  * Star 数
  * Fork 数
  * 编程语言（Language）
  * 项目标签（Topics）
  * README 正文
  * 项目描述（Summary）
  * 创建时间（publish_time）
  * 最新 commit 时间（update_time）

五层过滤：

* STAR 过滤：Star 值过低仓库过滤
* TIME 过滤：长期未更新仓库过滤
* L1 过滤：IT 领域判断
* L2 过滤：工程真实性判断
* L3 过滤：分析价值判断

采集配置：

```python
keyword_count_per_group = 3          # 每组关键词取 3 个
repository_limit_per_keyword = 5     # 每个关键词最多采集 5 个仓库
MAX_SEARCH_PAGE = 10                 # 搜索最多翻 10 页
```

关键词配置：

```
config/github_keywords.py
```

独立于 CSDN/掘金关键词，使用 9 组 GitHub 搜索关键词。

浏览器登录状态：

```
browser_data/github/
```

数据流程：

```
     collector
         |
         |
    article_raw (含 language, summary, update_time)
```

---

# 4. pipeline

目录：

```
pipeline/
```

作用：

负责数据转换流程。

主要文件：

```
pipeline/job_pipeline.py
```

处理内容：

* 将 JobRaw 原始岗位对象转换为 JobInfo 标准岗位对象
* 调用岗位清洗器
* 过滤无技能标签的无效岗位

流程：

```
      job_raw
          ↓
    JobPipeline.process()
          ↓
      job_info
```

---

# 5. cleaners

目录：

```
cleaners/
```

作用：

负责数据清洗。

主要文件：

```
cleaners/article_cleaner.py

cleaners/job_cleaner.py
```

文章清洗（article_cleaner.py）处理内容：

* 字段格式统一
* 时间格式转换
* 标签整理
* 空值处理
* 技术领域识别
* 热度评分
* 质量评分
* 趋势评分
* 摘要生成

流程：

```
      article_raw
          ↓
  clean_article_full()
          ↓
      article_info
```

岗位清洗（job_cleaner.py）处理内容：

* 岗位名称清洗
* 薪资解析
* 岗位分类识别
* 公司类型识别
* 地区整理

流程：

```
      job_raw
          ↓
     JobCleaner.clean()
          ↓
      job_info
```

---

# 6. dao

目录：

```
dao/
```

作用：

数据库访问层。

主要负责：

* 查询数据
* 数据去重
* 数据插入

主要文件：

```
dao/csdn_article_dao.py

dao/juejin_article_dao.py

dao/github_repository_dao.py

dao/article_info_dao.py

dao/job_raw_dao.py

dao/job_info_dao.py
```

对应数据库：

## article_raw

保存：

采集网站得到的原始文章数据。

## article_info

保存：

清洗后的标准文章数据。

## job_raw

保存：

采集招聘平台得到的原始岗位数据。

## job_info

保存：

清洗后的标准岗位数据。

---

# 7. models

目录：

```
models/
```

作用：

定义数据模型。

负责：

```
    网页数据
       ↓
    Model对象
       ↓
      DAO
       ↓
     数据库
```

主要模型：

* models/csdn_article.py：原始文章模型（CSDN、掘金通用）
* models/github_repository.py：GitHub 仓库原始数据模型
* models/job_raw.py：原始岗位模型
* models/job_info.py：标准岗位模型

---

# 8. database

目录：

```
database/
```

作用：

数据库连接管理。

主要文件：

```
database/mysql.py
```

负责：

* MySQL连接
* 数据库配置

连接信息通过项目根目录下的 `.env` 文件读取：

```
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=你的数据库密码
MYSQL_DATABASE=数据库名
```

---

# 四、换电脑或者部署时需要修改的地方

如果其他人使用这个项目，需要修改以下内容。

---

## 1. 数据库配置

项目使用 `.env` 文件配置数据库连接。

文件：

```
.env
```

在项目根目录新建 `.env` 文件，填入：

```
MYSQL_HOST=自己的数据库地址
MYSQL_PORT=3306
MYSQL_USER=自己的用户名
MYSQL_PASSWORD=自己的密码
MYSQL_DATABASE=自己的数据库名
```

例如：

原：

```
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=123456
MYSQL_DATABASE=job_analysis_db
```

换成自己的 MySQL：

```
MYSQL_HOST=自己的数据库地址
MYSQL_PORT=3306
MYSQL_USER=自己的用户名
MYSQL_PASSWORD=自己的密码
MYSQL_DATABASE=自己的数据库名
```

注意：`.env` 已被 `.gitignore` 忽略，不会上传到 Git，需在部署机器上手动创建。

---

## 2. 浏览器登录配置

项目使用 Playwright 持久化浏览器。

文件：

智联：

```
collectors/zhilian/collector.py
```

CSDN：

```
collectors/csdn/collector.py
```

掘金：

```
collectors/juejin/collector.py
```

GitHub：

```
collectors/github/collector.py
```

修改：

```python
USER_DATA_DIR
```

例如：

```python
USER_DATA_DIR = "./browser_data/juejin"
```

换成自己的电脑路径。

第一次运行：
需要登录：
* 智联招聘
* CSDN
* 掘金
* GitHub

登录状态会保存。


## 3. 关键词修改

智联关键词：

```
scheduler/article_scheduler.py
```

修改：

```
JOBS_KEYWORDS
```

CSDN关键词：

```
config/article_keywords.py
```

掘金关键词：

```
collectors/juejin/collector.py
```

GitHub关键词：

```
config/github_keywords.py
```

GitHub 使用独立的关键词配置，包含 9 组搜索关键词。

例如：

```python
KEYWORDS = [
    "Java",
    "Python",
    "人工智能"
]
```

修改成需要采集的技术方向。

---

## 4. 采集数量修改

智联：

修改：

```
max_jobs = 5
```

CSDN：

修改：

```
TARGET_ARTICLES
```

掘金：

修改：

```
TARGET_PER_KEYWORD
```

GitHub：

修改：

```
collectors/github/collector.py
```

配置项：

```python
keyword_count_per_group = 3          # 每组关键词取 3 个
repository_limit_per_keyword = 5     # 每个关键词最多采集 5 个仓库
MAX_SEARCH_PAGE = 10                 # 搜索最多翻 10 页
```

例如：

每个关键词采集10篇：

```python
TARGET_PER_KEYWORD = 10
```

---

# 五、数据库说明

主要数据表：

## article_raw

作用：

保存网站采集的原始文章。

包含：

* 来源
* 文章ID
* 标题
* 作者
* 正文
* 标签
* 发布时间
* 浏览量
* 点赞量

GitHub 仓库数据额外包含：

* language（编程语言）
* summary（项目描述）
* update_time（最新 commit 时间）

---

## article_info

作用：

保存清洗后的标准文章数据。

用于：

* 后续分析
* 搜索
* 推荐
* 数据统计

---

## job_raw

作用：

保存招聘平台采集的原始岗位数据。

包含：

* 来源
* 岗位ID
* 岗位名称
* 公司名称
* 薪资
* 城市
* 学历
* 经验
* 岗位描述
* 技能标签
* 发布时间

---

## job_info

作用：

保存清洗后的标准岗位数据。

包含：

* 岗位名称
* 公司名称
* 城市
* 薪资范围
* 学历
* 经验
* 岗位分类
* 公司类型
* 技能标签
* 岗位描述

用于：

* 后续分析
* 搜索
* 推荐
* 数据统计

---

# 六、项目运行流程

完整流程：

```
      启动项目
        ↓
   python run.py
        ↓
  scheduler等待时间
        ↓
    执行智联采集（当前注释，不执行）
        ↓
     保存job_raw
        ↓
     数据清洗
        ↓
     保存job_info
        ↓
    执行CSDN采集
        ↓
   保存article_raw
        ↓
     数据清洗
        ↓
   保存article_info
        ↓
    执行掘金采集
        ↓
   保存article_raw
        ↓
     数据清洗
        ↓
   保存article_info
        ↓
    执行GitHub采集
        ↓
   保存article_raw
        ↓
     数据清洗
        ↓
   保存article_info
        ↓
   同步到云服务器
        ↓
    等待下一次执行
```

# 七、注意事项

## 不要直接运行：

```
collectors/zhilian/collector.py
```

或者：

```
collectors/csdn/collector.py
```

或者：

```
collectors/juejin/collector.py
```

或者：

```
collectors/github/collector.py
```

这些只是采集模块。

正确启动：

```
python run.py
```

# 八、新环境部署流程

1. 下载项目：

```
git clone 项目地址
```

2. 创建虚拟环境：

```
python -m venv .venv
```

3. 安装依赖：

```
pip install -r requirements.txt
```

4. 配置数据库：

新建 `.env` 文件，填入自己的 MySQL 连接信息：

```
MYSQL_HOST=自己的数据库地址
MYSQL_PORT=3306
MYSQL_USER=自己的用户名
MYSQL_PASSWORD=自己的密码
MYSQL_DATABASE=自己的数据库名
```

5. 配置浏览器路径：

修改：

```
USER_DATA_DIR
```

6. 登录网站：

* 智联招聘
* CSDN
* 掘金
* GitHub

7. 修改采集时间：

```
scheduler/article_scheduler.py
```

8. 启动：

```
python run.py
```

# 九、当前项目完成情况

已完成：

✅ 智联招聘岗位采集

✅ CSDN文章采集

✅ 掘金文章采集

✅ GitHub仓库采集

✅ job_raw原始数据保存

✅ article_raw原始数据保存

✅ job_info清洗数据保存

✅ article_info清洗数据保存

✅ 自动数据清洗流程

✅ 定时自动采集

✅ 项目统一启动入口
```
