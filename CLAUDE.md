# 明月工作台 · 项目上下文

## 项目简介

本地 FastAPI 项目管理工具，供赵明月个人使用。原为静态 HTML 单文件，现重构为 FastAPI + SQLite + Jinja2 + Poetry 架构。

## 技术栈

| 层 | 技术 |
|---|---|
| Web 框架 | FastAPI 0.111 |
| 数据库 | SQLite（SQLAlchemy 2.0 ORM） |
| 模板 | Jinja2 3.1 |
| 包管理 | Poetry |
| 测试 | pytest + httpx |
| 部署 | Docker + docker-compose |

## 本地启动

```bash
# 方式 A（推荐）
docker compose up

# 方式 B
~/.local/bin/poetry run uvicorn app.main:app --reload
```

浏览器访问：http://localhost:8000

## 项目结构

```
files/
├── app/
│   ├── main.py          # FastAPI 入口，lifespan seed
│   ├── database.py      # SQLite 连接，DB_PATH 读自 .env
│   ├── models.py        # Project + Task ORM
│   ├── schemas.py       # Pydantic v2 schemas
│   ├── seed.py          # 幂等初始化数据
│   ├── routers/
│   │   ├── projects.py  # GET/POST/PUT/DELETE /api/projects
│   │   ├── tasks.py     # GET/POST/PUT/DELETE /api/tasks（含筛选）
│   │   └── reports.py   # GET /reports/daily|weekly|monthly
│   ├── templates/
│   │   ├── base.html    # 公共 layout，CSS 变量，iconfont
│   │   ├── index.html   # 主页（extends base），两 tab：任务/报告
│   │   └── report_full.html  # 全页响应式报告（standalone）
│   └── static/
│       ├── app.js       # 看板视图 + 筛选 + 拖拽 + modal
│       ├── table.js     # 表格视图（列排序）
│       └── gantt.js     # 甘特图视图（横条 + 菱形标记）
├── data/                # SQLite DB 存放目录（gitignored）
├── docker/Dockerfile
├── docker-compose.yml
├── tests/               # pytest，19 个测试全部通过
└── docs/superpowers/    # 设计文档 + 实施计划
```

## 数据模型

**projects 表**：id(TEXT PK), name, color, icon, short, desc, sort_order, created_at
- 初始 seed：agent / hangqing / tmall / other

**tasks 表**：id(INTEGER PK), title, project(FK), status, priority, start_date, due_date, notes, created_at, updated_at
- status 枚举：`pending` / `running` / `blocked` / `completed`
- priority：0=P0（最高）… 3=P3（最低）

## 功能模块

- **任务 Tab**：看板 / 表格 / 甘特 三视图切换，按项目/状态/优先级/日期筛选，拖拽卡片改状态，双击编辑
- **报告 Tab**：日报/周报/月报卡片，点击在新标签页打开全页响应式 HTML 报告

## 开发分支

当前工作分支：`refactor/fastapi`

## 重要约定

- `Jinja2Templates.TemplateResponse` 使用新签名：`TemplateResponse(request, "template.html", ctx_dict)`
- `proj_map` 在 router 中构建为 `{id: Project}` dict 传入模板，Jinja2 不支持 dict 原地修改
- `escHTML()` 和 `openEditModal()` 定义在 `app.js`，`gantt.js` 直接调用这两个全局函数
- `window._tasks` / `window._projects` 由 `app.js` 的 `loadTasks()` 写入，供 `table.js` 的排序重渲染使用
- 测试使用内存 SQLite（`sqlite:///:memory:`），通过 `dependency_overrides` 替换 `get_db`
