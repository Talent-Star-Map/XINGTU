# ✦ 星图 —— 岗位能力图谱动态演化与分析系统

基于多源异构数据 + 大模型 + 知识图谱，新一代信息技术领域岗位能力分析平台。

---

## 快速开始

### 方式一：Docker 一键启动（推荐）

```bash
git clone https://github.com/Talent-Star-Map/XINGTU.git
cd XINGTU
docker compose up -d
```

浏览器打开 http://localhost:3000

### 方式二：本地开发（改代码用）

```bash
# 1. 启动数据库
docker compose up -d mysql    # MySQL on localhost:3307

# 2. 启动后端
cd backend && pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8081 --reload

# 3. 启动前端
cd frontend && npm install
npm run dev

# 4.（可选）初始化演示数据与管理员账号
cd backend && python -m mock_data.seed         # 10 个测试求职者 + 10 个测试岗位
python -m mock_data.seed_admin                  # 默认管理员账号 admin@xingtu.com / Admin1234
```

浏览器打开 http://localhost:5173

---

## 测试账号

| 角色 | 邮箱 | 密码 |
|---|---|---|
| 求职者 | TUTU@qiuzhi.com | TuTu666 |
| 企业 | XINGXINGHR@zhaopin.com | XingXing666 |
| 管理员 | admin@xingtu.com | Admin1234 |

> 管理员端入口在角色选择页底部"管理员入口"按钮。质检功能（数据质量报告、准确率测试等）已集中到管理员端，求职端/企业端不再展示。

---

## 服务地址

| 服务 | 本地 | 服务器 |
|---|---|---|
| 前端 | http://localhost:3000 | http://180.76.227.159:3000 |
| 后端 API | http://localhost:8081 | http://180.76.227.159:8081 |
| MySQL | localhost:3307 | — |

---

## ⚠️ 不要提交依赖到仓库

已通过 `.gitignore` 排除 `node_modules/`、`dist/`、`*.db`，各自本地安装即可。

---

## 技术栈

React + Vite + TypeScript + FastAPI + SQLAlchemy + MySQL + Docker
