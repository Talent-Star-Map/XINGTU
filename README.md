# ✦ 星图 —— 岗位能力图谱动态演化与分析系统

基于多源异构数据 + 大模型 + 知识图谱，新一代信息技术领域岗位能力分析平台。

---

## ⚠️ 重要：依赖不要推送到仓库

`node_modules/`、`dist/`、`*.db` 等已通过 `.gitignore` 排除，**禁止手动删除 `.gitignore` 或强行推送依赖到仓库**。

团队协作流程：

```bash
# 1. 克隆项目
git clone <仓库地址>
cd xingtu

# 2. 安装后端依赖
cd backend
pip install -r requirements.txt

# 3. 安装前端依赖
cd ../frontend
npm install

# 4. 一键启动（MySQL + 后端 + 前端）
cd ..
docker compose up -d
```

**不要提交 `node_modules`、`dist`、`.env` 到 Git，各自本地安装即可。**

---

## 快速启动

### Docker 一键启动（推荐）

```bash
docker compose up -d
```

启动后访问 http://localhost:5173

### 本地开发模式

```bash
# 1. 启动 MySQL
docker compose up -d mysql

# 2. 启动后端
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8083 --reload

# 3. 启动前端
cd frontend
npm run dev
```

---

## 测试账号

| 角色 | 邮箱 | 密码 |
|---|---|---|
| 👤 求职者 | `TUTU@qiuzhi.com` | `TuTu666` |
| 🏢 企业 | `XINGXINGHR@zhaopin.com` | `XingXing666` |

---

## 服务地址

| 服务 | 本地地址 | 服务器地址 |
|---|---|---|
| 前端 | http://localhost:5173 | http://180.76.227.159:3000 |
| 后端 API | http://localhost:8083 | http://180.76.227.159:8081 |
| API 文档 | http://localhost:8083/docs | — |
| MySQL | localhost:3307 | — |

---

## 技术栈

- **前端**：React + Vite + TypeScript + TailwindCSS
- **动画**：Framer Motion + Three.js + GSAP
- **后端**：FastAPI + SQLAlchemy + MySQL
- **容器化**：Docker Compose（MySQL + API + Frontend）
