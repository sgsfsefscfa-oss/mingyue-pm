# 明月工作台 — FastAPI 重构设计文档

**日期**：2026-04-14  
**分支**：`refactor/fastapi`  
**状态**：待实现

---

## 一、背景与目标

现有系统为纯静态单文件 HTML（`files/index.html`），数据存储依赖 localStorage + GitHub Gist 同步。本次重构目标：

1. 迁移至 FastAPI + SQLite + Jinja2 + Poetry 技术栈
2. 精简导航，只保留「任务」和「日报」两个模块
3. 任务支持看板/甘特图双视图，支持筛选和拖拽
4. 日报以卡片摘要展示，点击新开全页响应式报告
5. 本地 `uvicorn` 运行，Docker 支持后续部署

---

## 二、项目结构

```
mingyue-pm/
├── pyproject.toml
├── .env.example
├── .env                        # gitignore
├── docker/
│   └── Dockerfile
├── docker-compose.yml
├── app/
│   ├── main.py                 # FastAPI 入口
│   ├── database.py             # SQLite 连接，DB_PATH 读自环境变量
│   ├── models.py               # SQLAlchemy ORM
│   ├── schemas.py              # Pydantic 数据验证
│   ├── seed.py                 # 初始化数据（projects + tasks）
│   ├── routers/
│   │   ├── tasks.py            # /api/tasks CRUD
│   │   ├── projects.py         # /api/projects CRUD
│   │   └── reports.py          # /reports/daily|weekly|monthly
│   ├── templates/
│   │   ├── base.html           # 公共 layout
│   │   ├── index.html          # 主页（extends base）
│   │   └── report_full.html    # 全页报告（响应式）
│   └── static/
│       ├── app.js              # 主交互：视图切换、筛选、API 调用
│       └── gantt.js            # 甘特图渲染
├── data/
│   └── .gitkeep               # DB 文件存放目录，gitignore *.db
└── README.md
```

---

## 三、数据模型

### 3.1 projects 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | 短标识符，如 `agent` |
| name | TEXT NOT NULL | 显示名称 |
| color | TEXT | 十六进制色值 |
| icon | TEXT | iconfont 图标名 |
| short | TEXT | 简称（chip 显示） |
| desc | TEXT | 项目描述 |
| sort_order | INTEGER | 显示排序，默认 0 |
| created_at | TEXT | ISO8601 |

**初始 seed 数据**（从原 PROJECTS 常量迁移）：
- `agent`：AI Agent 打造，#C2410C
- `hangqing`：行情高手，#2563EB
- `tmall`：天猫合作 Agent，#D97706
- `other`：其他事务，#6B7280

### 3.2 tasks 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 |
| title | TEXT NOT NULL | 任务标题 |
| project | TEXT FK→projects.id | 关联项目 |
| status | TEXT | pending/running/blocked/completed |
| priority | INTEGER | 0=最高(P0)，1=P1，2=P2，3=P3，默认 1 |
| start_date | TEXT | 开始日期 YYYY-MM-DD（可空） |
| due_date | TEXT | 截止日期 YYYY-MM-DD（可空） |
| notes | TEXT | 备注 |
| created_at | TEXT | ISO8601，自动写入 |
| updated_at | TEXT | ISO8601，每次 PUT 自动刷新 |

**状态映射**（从原数据迁移）：
- `todo` → `pending`
- `doing` → `running`
- `blocked` → `blocked`
- `done` → `completed`

**迁移规则**：只迁移 `cat:"task"` 条目，`cat:"issue"` 全部丢弃。原 `date` 字段 → `due_date`，`start_date` 默认为空。

---

## 四、API 接口

### 4.1 页面路由
```
GET  /                        → 渲染主页（Jinja2 index.html）
GET  /reports/daily           → 日报全页 HTML
GET  /reports/weekly          → 周报全页 HTML
GET  /reports/monthly         → 月报全页 HTML
```

### 4.2 任务 API
```
GET    /api/tasks             → 任务列表
  查询参数：project, status, priority, start_date_from, due_date_to
POST   /api/tasks             → 新建任务
PUT    /api/tasks/{id}        → 更新任务（含拖拽改状态）
DELETE /api/tasks/{id}        → 删除任务
```

### 4.3 项目 API
```
GET    /api/projects          → 项目列表（按 sort_order 排序）
POST   /api/projects          → 新建项目
PUT    /api/projects/{id}     → 更新项目
DELETE /api/projects/{id}     → 删除（有关联任务时返回 400）
```

所有 API 返回 JSON，HTTP 状态码语义标准。

---

## 五、前端设计

### 5.1 导航
只保留两个 Tab：**任务** | **日报**，默认打开任务 Tab。

### 5.2 筛选栏（任务页常驻）
- 第一行：项目 chips（从 `/api/projects` 动态加载）
- 第二行：状态多选 + 优先级多选 + 日期范围（start_date_from ~ due_date_to）
- 筛选参数变化时重新调用 `/api/tasks?...` 刷新视图

### 5.3 看板视图（默认）
- 4 列：未开始 / 进行中 / 阻塞中 / 已完成
- 卡片显示：标题、项目色块、`P{priority}` 角标、due_date
- HTML5 Drag & Drop：列内排序 + 跨列拖拽（拖拽结束调用 `PUT /api/tasks/{id}` 更新 status）
- FAB `+` 按钮新建任务（modal 表单）

### 5.4 甘特视图
- 时间轴默认显示当前周 ±2 周（可左右滑动扩展）
- 左侧固定列：任务名 + 项目色块（宽度固定 200px）
- 右侧时间轴：`start_date` 到 `due_date` 的彩色横条（颜色按项目 color）
- 无 `start_date` 的任务：在 `due_date` 处显示菱形标记 ◆
- 点击横条/菱形打开编辑 modal
- 纯 JS + CSS 渲染，无外部图表库依赖

### 5.5 日报页
三张并排卡片（桌面）/ 竖排（移动端）：

```
[ 日报 ]      [ 周报 ]      [ 月报 ]
今日概览      本周概览      本月概览
完成2/进行3   完成8/进行5   完成20/进行12
              点击展开 →
```

点击任意卡片 → `window.open('/reports/daily'|'weekly'|'monthly')` 新标签页打开完整报告。

**全页报告（`report_full.html`）**：
- 独立 Jinja2 模板，不 extends base
- 响应式：`font-size` 使用 `clamp()`，布局用 CSS Grid + media query
- 内容：时间范围标题、各项目完成情况、完成/进行中/阻塞/未开始任务分组列表

---

## 六、Docker 部署

### docker/Dockerfile
```dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN pip install poetry
COPY pyproject.toml poetry.lock* ./
RUN poetry config virtualenvs.create false \
    && poetry install --no-dev --no-interaction
COPY app/ ./app/
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### docker-compose.yml 卷挂载
```yaml
services:
  app:
    build:
      context: .
      dockerfile: docker/Dockerfile
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data        # SQLite 持久化
      - ./.env:/app/.env:ro     # 环境变量只读挂载
    env_file:
      - .env
```

### .env.example
```
DB_PATH=data/mingyue.db
```

---

## 七、本地启动

```bash
git checkout -b refactor/fastapi
poetry install
uvicorn app.main:app --reload
# 浏览器访问 http://localhost:8000
```
