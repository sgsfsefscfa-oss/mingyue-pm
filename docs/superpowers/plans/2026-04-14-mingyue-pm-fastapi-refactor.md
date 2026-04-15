# 明月工作台 FastAPI 重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有静态单文件 HTML 工作台重构为 FastAPI + SQLite + Jinja2 + Poetry 架构，只保留任务和日报两个模块，新增看板/甘特双视图及筛选拖拽功能。

**Architecture:** FastAPI 提供 REST JSON API，Jinja2 渲染主页面 shell 和全页报告，前端原生 JS 处理所有交互（看板拖拽、甘特图渲染、筛选）。SQLite 通过 SQLAlchemy ORM 访问，DB 文件存于 `data/` 目录，Docker volume 挂载持久化。

**Tech Stack:** Python 3.11, FastAPI 0.111, SQLAlchemy 2.0, Jinja2 3.1, SQLite, Poetry, pytest, httpx, Docker

---

## 文件清单

| 路径 | 操作 | 职责 |
|------|------|------|
| `pyproject.toml` | 新建 | Poetry 依赖 |
| `.env.example` | 新建 | 环境变量模板 |
| `.gitignore` | 修改 | 忽略 data/*.db, .env |
| `docker/Dockerfile` | 新建 | 容器构建 |
| `docker-compose.yml` | 新建 | 本地 Docker 一键启动 |
| `app/__init__.py` | 新建 | 包标记 |
| `app/main.py` | 新建 | FastAPI 入口，lifespan seed，挂载路由 |
| `app/database.py` | 新建 | SQLAlchemy engine, SessionLocal, get_db |
| `app/models.py` | 新建 | Project + Task ORM 模型 |
| `app/schemas.py` | 新建 | Pydantic 请求/响应 schema |
| `app/seed.py` | 新建 | 幂等初始化数据 |
| `app/routers/__init__.py` | 新建 | 包标记 |
| `app/routers/projects.py` | 新建 | /api/projects CRUD |
| `app/routers/tasks.py` | 新建 | /api/tasks CRUD + 筛选 |
| `app/routers/reports.py` | 新建 | /reports/daily|weekly|monthly |
| `app/templates/base.html` | 新建 | 公共 layout，CSS 变量，字体，nav |
| `app/templates/index.html` | 新建 | 主页面（extends base），三视图切换 |
| `app/templates/report_full.html` | 新建 | 全页响应式报告（standalone） |
| `app/static/app.js` | 新建 | 主交互：筛选、看板渲染、拖拽、modal |
| `app/static/table.js` | 新建 | 表格视图渲染（列排序） |
| `app/static/gantt.js` | 新建 | 甘特图渲染 |
| `data/.gitkeep` | 新建 | 占位，DB 文件目录 |
| `tests/__init__.py` | 新建 | 包标记 |
| `tests/conftest.py` | 新建 | 测试 DB + TestClient fixture |
| `tests/test_projects.py` | 新建 | projects 路由测试 |
| `tests/test_tasks.py` | 新建 | tasks 路由测试 |
| `tests/test_reports.py` | 新建 | reports 路由测试 |

---

## Task 1：Git 分支 + 项目脚手架

**Files:**
- Create: `pyproject.toml`
- Create: `.env.example`
- Modify: `.gitignore`
- Create: `data/.gitkeep`
- Create: `app/__init__.py`, `app/routers/__init__.py`

- [ ] **Step 1.1：创建 refactor/fastapi 分支**

```bash
cd /Users/edy/Desktop/个人资料/工作台/files
git checkout -b refactor/fastapi
```

Expected: `Switched to a new branch 'refactor/fastapi'`

- [ ] **Step 1.2：创建目录结构**

```bash
mkdir -p app/routers app/templates app/static tests data docker
touch app/__init__.py app/routers/__init__.py tests/__init__.py data/.gitkeep
```

- [ ] **Step 1.3：创建 pyproject.toml**

```toml
[tool.poetry]
name = "mingyue-pm"
version = "0.1.0"
description = "明月工作台 — 项目管理系统"
authors = ["edy"]

[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.111"
uvicorn = {extras = ["standard"], version = "^0.29"}
sqlalchemy = "^2.0"
jinja2 = "^3.1"
python-multipart = "^0.0.9"

[tool.poetry.group.dev.dependencies]
pytest = "^8.0"
httpx = "^0.27"

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"
```

- [ ] **Step 1.4：创建 .env.example**

```
DB_PATH=data/mingyue.db
```

- [ ] **Step 1.5：更新 .gitignore（追加）**

在 `.gitignore` 末尾追加：
```
.env
data/*.db
__pycache__/
*.pyc
.pytest_cache/
test.db
```

- [ ] **Step 1.6：安装依赖并生成 lock 文件**

```bash
poetry install
```

Expected: 无报错，生成 `poetry.lock` 文件

- [ ] **Step 1.7：Commit（含 poetry.lock，确保 Docker build 可复现）**

```bash
git add pyproject.toml poetry.lock .env.example .gitignore data/.gitkeep app/__init__.py app/routers/__init__.py tests/__init__.py
git commit -m "chore: scaffold fastapi project structure"
```

---

## Task 2：数据库层 + ORM 模型

**Files:**
- Create: `app/database.py`
- Create: `app/models.py`
- Create: `tests/conftest.py`

- [ ] **Step 2.1：创建 app/database.py**

```python
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DB_PATH = os.getenv("DB_PATH", "data/mingyue.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 2.2：创建 app/models.py**

```python
from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    color = Column(String, default="#6B7280")
    icon = Column(String, default="")
    short = Column(String, default="")
    desc = Column(Text, default="")
    sort_order = Column(Integer, default=0)
    created_at = Column(String, nullable=False)

    tasks = relationship("Task", back_populates="project_rel")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=False)
    project = Column(String, ForeignKey("projects.id"), nullable=True)
    status = Column(String, default="pending")
    priority = Column(Integer, default=1)
    start_date = Column(String, nullable=True)
    due_date = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)

    project_rel = relationship("Project", back_populates="tasks")
```

- [ ] **Step 2.3：创建 tests/conftest.py**

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db

TEST_DATABASE_URL = "sqlite:///./test.db"
test_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def client():
    from app.main import app
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

- [ ] **Step 2.4：验证模型可导入**

```bash
poetry run python -c "from app.models import Project, Task; print('OK')"
```

Expected: `OK`

- [ ] **Step 2.5：Commit**

```bash
git add app/database.py app/models.py tests/conftest.py
git commit -m "feat: add sqlalchemy models and db setup"
```

---

## Task 3：Pydantic Schemas

**Files:**
- Create: `app/schemas.py`

- [ ] **Step 3.1：创建 app/schemas.py**

```python
from pydantic import BaseModel
from typing import Optional


# ── Projects ──────────────────────────────────────────────
class ProjectCreate(BaseModel):
    id: str
    name: str
    color: str = "#6B7280"
    icon: str = ""
    short: str = ""
    desc: str = ""
    sort_order: int = 0


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    short: Optional[str] = None
    desc: Optional[str] = None
    sort_order: Optional[int] = None


class ProjectOut(BaseModel):
    id: str
    name: str
    color: str
    icon: str
    short: str
    desc: str
    sort_order: int
    created_at: str

    model_config = {"from_attributes": True}


# ── Tasks ─────────────────────────────────────────────────
class TaskCreate(BaseModel):
    title: str
    project: Optional[str] = None
    status: str = "pending"
    priority: int = 1
    start_date: Optional[str] = None
    due_date: Optional[str] = None
    notes: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    project: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[int] = None
    start_date: Optional[str] = None
    due_date: Optional[str] = None
    notes: Optional[str] = None


class TaskOut(BaseModel):
    id: int
    title: str
    project: Optional[str]
    status: str
    priority: int
    start_date: Optional[str]
    due_date: Optional[str]
    notes: Optional[str]
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}
```

- [ ] **Step 3.2：验证 schema 可导入**

```bash
poetry run python -c "from app.schemas import TaskCreate, ProjectCreate; print('OK')"
```

Expected: `OK`

- [ ] **Step 3.3：Commit**

```bash
git add app/schemas.py
git commit -m "feat: add pydantic schemas"
```

---

## Task 4：Seed 数据

**Files:**
- Create: `app/seed.py`

- [ ] **Step 4.1：创建 app/seed.py**

```python
from datetime import datetime, timezone
from . import models


PROJECTS = [
    {"id": "agent",    "name": "AI Agent 打造",   "color": "#C2410C", "icon": "caomeixiong", "short": "Agent", "desc": "场景调研→方案设计→数据协调→开发对接→交付", "sort_order": 0},
    {"id": "hangqing", "name": "行情高手",         "color": "#2563EB", "icon": "niuyouguo",   "short": "行情", "desc": "B端产品全权负责，看板+分析框架",           "sort_order": 1},
    {"id": "tmall",    "name": "天猫合作 Agent",   "color": "#D97706", "icon": "nangua",      "short": "天猫", "desc": "MCP授权对接，维护合作关系",                 "sort_order": 2},
    {"id": "other",    "name": "其他事务",          "color": "#6B7280", "icon": "huacai",      "short": "其他", "desc": "零散任务与临时事项",                       "sort_order": 3},
]

TASKS = [
    {"title": "竞品店铺分析 Skill — L1查询粒度确认",  "project": "agent",    "status": "pending",   "priority": 1, "due_date": "2026-04-11", "notes": "需确认L1级别的查询粒度方案"},
    {"title": "万相台 Agent 投放策略文档迭代",        "project": "agent",    "status": "running",   "priority": 1, "due_date": "2026-04-11", "notes": "V3决策树已完成，待补充新场景"},
    {"title": "天猫 MCP 授权对接跟进",               "project": "tmall",    "status": "blocked",   "priority": 1, "due_date": "2026-04-11", "notes": "平台侧授权接口未开放"},
    {"title": "MCP 需求清单整理发邮件",               "project": "tmall",    "status": "pending",   "priority": 1, "due_date": "2026-04-11", "notes": "先理出完整需求清单，推动跨部门协作"},
    {"title": "抖音短视频模块场景设计",               "project": "hangqing", "status": "pending",   "priority": 2, "due_date": "2026-04-30", "notes": "CEO期望大力扩展，场景设计未启动"},
    {"title": "大有泰评价&商详",                     "project": "agent",    "status": "completed", "priority": 2, "start_date": "2026-04-14", "due_date": "2026-04-14", "notes": "📅 会议 10:00–12:00"},
    {"title": "插件评审",                            "project": "agent",    "status": "completed", "priority": 1, "start_date": "2026-04-15", "due_date": "2026-04-15", "notes": "📅 会议 14:00–16:00"},
]


def seed_db(db) -> None:
    """幂等：仅在 projects 表为空时执行。"""
    if db.query(models.Project).count() > 0:
        return
    now = datetime.now(timezone.utc).isoformat()
    for p in PROJECTS:
        db.add(models.Project(**p, created_at=now))
    db.flush()
    for t in TASKS:
        db.add(models.Task(**t, created_at=now, updated_at=now))
    db.commit()
```

- [ ] **Step 4.2：Commit**

```bash
git add app/seed.py
git commit -m "feat: add idempotent seed data"
```

---

## Task 5：Projects Router + 测试

**Files:**
- Create: `app/routers/projects.py`
- Create: `tests/test_projects.py`

- [ ] **Step 5.1：写失败测试 tests/test_projects.py**

```python
def test_list_projects_empty(client):
    resp = client.get("/api/projects")
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_project(client):
    payload = {"id": "test", "name": "测试项目", "color": "#FF0000", "icon": "", "short": "测", "desc": "", "sort_order": 0}
    resp = client.post("/api/projects", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["id"] == "test"
    assert data["name"] == "测试项目"
    assert "created_at" in data


def test_create_duplicate_project(client):
    payload = {"id": "dup", "name": "A", "color": "#000", "icon": "", "short": "A", "desc": "", "sort_order": 0}
    client.post("/api/projects", json=payload)
    resp = client.post("/api/projects", json=payload)
    assert resp.status_code == 400


def test_update_project(client):
    client.post("/api/projects", json={"id": "p1", "name": "原名", "color": "#000", "icon": "", "short": "P", "desc": "", "sort_order": 0})
    resp = client.put("/api/projects/p1", json={"name": "新名"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "新名"


def test_delete_project_no_tasks(client):
    client.post("/api/projects", json={"id": "del", "name": "删除", "color": "#000", "icon": "", "short": "D", "desc": "", "sort_order": 0})
    resp = client.delete("/api/projects/del")
    assert resp.status_code == 204


def test_delete_project_with_tasks_returns_400(client):
    client.post("/api/projects", json={"id": "busy", "name": "有任务", "color": "#000", "icon": "", "short": "B", "desc": "", "sort_order": 0})
    client.post("/api/tasks", json={"title": "关联任务", "project": "busy"})
    resp = client.delete("/api/projects/busy")
    assert resp.status_code == 400
```

- [ ] **Step 5.2：运行测试，确认全部失败**

```bash
poetry run pytest tests/test_projects.py -v
```

Expected: 全部 FAILED（ImportError 或 404）

- [ ] **Step 5.3：实现 app/routers/projects.py**

```python
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("/", response_model=list[schemas.ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    return db.query(models.Project).order_by(models.Project.sort_order).all()


@router.post("/", response_model=schemas.ProjectOut, status_code=201)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db)):
    if db.query(models.Project).filter(models.Project.id == project.id).first():
        raise HTTPException(status_code=400, detail="Project id already exists")
    now = datetime.now(timezone.utc).isoformat()
    db_proj = models.Project(**project.model_dump(), created_at=now)
    db.add(db_proj)
    db.commit()
    db.refresh(db_proj)
    return db_proj


@router.put("/{project_id}", response_model=schemas.ProjectOut)
def update_project(project_id: str, update: schemas.ProjectUpdate, db: Session = Depends(get_db)):
    db_proj = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not db_proj:
        raise HTTPException(status_code=404, detail="Project not found")
    for k, v in update.model_dump(exclude_unset=True).items():
        setattr(db_proj, k, v)
    db.commit()
    db.refresh(db_proj)
    return db_proj


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: str, db: Session = Depends(get_db)):
    db_proj = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not db_proj:
        raise HTTPException(status_code=404, detail="Project not found")
    task_count = db.query(models.Task).filter(models.Task.project == project_id).count()
    if task_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete project with {task_count} tasks")
    db.delete(db_proj)
    db.commit()
```

- [ ] **Step 5.4：创建 app/main.py（最小版，供测试用）**

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from .database import engine, Base, SessionLocal
from .routers import projects, tasks, reports
from .seed import seed_db

Base.metadata.create_all(bind=engine)

_templates = Jinja2Templates(directory="app/templates")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup: 幂等 seed
    db = SessionLocal()
    try:
        seed_db(db)
    finally:
        db.close()
    yield
    # shutdown: 无需清理


app = FastAPI(title="明月工作台", lifespan=lifespan)

app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(reports.router)


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return _templates.TemplateResponse("index.html", {"request": request})
```

注意：此时 `tasks.router` 和 `reports.router` 尚未实现，需要先创建空文件：

```python
# app/routers/tasks.py （临时占位）
from fastapi import APIRouter
router = APIRouter(prefix="/api/tasks", tags=["tasks"])

# app/routers/reports.py （临时占位）
from fastapi import APIRouter
router = APIRouter(prefix="/reports", tags=["reports"])
```

- [ ] **Step 5.5：运行测试，确认通过**

```bash
poetry run pytest tests/test_projects.py -v
```

Expected: 全部 PASSED

- [ ] **Step 5.6：Commit**

```bash
git add app/routers/projects.py app/routers/tasks.py app/routers/reports.py app/main.py tests/test_projects.py
git commit -m "feat: add projects CRUD router with tests"
```

---

## Task 6：Tasks Router + 测试

**Files:**
- Modify: `app/routers/tasks.py`（替换占位版本）
- Create: `tests/test_tasks.py`

- [ ] **Step 6.1：写失败测试 tests/test_tasks.py**

```python
def _create_project(client, pid="proj"):
    client.post("/api/projects", json={"id": pid, "name": "测试项目", "color": "#000", "icon": "", "short": "T", "desc": "", "sort_order": 0})


def test_list_tasks_empty(client):
    resp = client.get("/api/tasks")
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_task(client):
    _create_project(client)
    resp = client.post("/api/tasks", json={"title": "新任务", "project": "proj", "priority": 1})
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "新任务"
    assert data["status"] == "pending"
    assert data["priority"] == 1
    assert "created_at" in data
    assert "updated_at" in data


def test_update_task_status(client):
    _create_project(client)
    r = client.post("/api/tasks", json={"title": "任务A", "project": "proj"})
    tid = r.json()["id"]
    resp = client.put(f"/api/tasks/{tid}", json={"status": "running"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "running"


def test_update_task_updates_updated_at(client):
    _create_project(client)
    r = client.post("/api/tasks", json={"title": "任务B", "project": "proj"})
    data = r.json()
    tid = data["id"]
    old_ts = data["updated_at"]
    import time; time.sleep(0.1)   # 100ms 确保时间戳有差异
    client.put(f"/api/tasks/{tid}", json={"status": "completed"})
    resp = client.get("/api/tasks")
    new_ts = next(t["updated_at"] for t in resp.json() if t["id"] == tid)
    assert new_ts >= old_ts


def test_delete_task(client):
    _create_project(client)
    r = client.post("/api/tasks", json={"title": "删除任务", "project": "proj"})
    tid = r.json()["id"]
    resp = client.delete(f"/api/tasks/{tid}")
    assert resp.status_code == 204
    assert all(t["id"] != tid for t in client.get("/api/tasks").json())


def test_filter_by_project(client):
    _create_project(client, "p1")
    _create_project(client, "p2")
    client.post("/api/tasks", json={"title": "P1任务", "project": "p1"})
    client.post("/api/tasks", json={"title": "P2任务", "project": "p2"})
    resp = client.get("/api/tasks?project=p1")
    assert len(resp.json()) == 1
    assert resp.json()[0]["project"] == "p1"


def test_filter_by_status(client):
    _create_project(client)
    client.post("/api/tasks", json={"title": "待办", "project": "proj", "status": "pending"})
    client.post("/api/tasks", json={"title": "进行中", "project": "proj", "status": "running"})
    resp = client.get("/api/tasks?status=pending")
    assert len(resp.json()) == 1
    assert resp.json()[0]["status"] == "pending"


def test_filter_by_priority(client):
    _create_project(client)
    client.post("/api/tasks", json={"title": "P0任务", "project": "proj", "priority": 0})
    client.post("/api/tasks", json={"title": "P2任务", "project": "proj", "priority": 2})
    resp = client.get("/api/tasks?priority=0")
    assert len(resp.json()) == 1
    assert resp.json()[0]["priority"] == 0


def test_filter_by_due_date(client):
    _create_project(client)
    client.post("/api/tasks", json={"title": "早期任务", "project": "proj", "due_date": "2026-03-01"})
    client.post("/api/tasks", json={"title": "近期任务", "project": "proj", "due_date": "2026-05-01"})
    resp = client.get("/api/tasks?due_date_to=2026-04-01")
    assert len(resp.json()) == 1
    assert "早期" in resp.json()[0]["title"]


def test_update_nonexistent_task(client):
    resp = client.put("/api/tasks/9999", json={"status": "running"})
    assert resp.status_code == 404
```

- [ ] **Step 6.2：运行测试，确认失败**

```bash
poetry run pytest tests/test_tasks.py -v
```

Expected: 全部 FAILED

- [ ] **Step 6.3：实现 app/routers/tasks.py**

```python
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("/", response_model=list[schemas.TaskOut])
def list_tasks(
    project: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[int] = Query(None),
    start_date_from: Optional[str] = Query(None),
    due_date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(models.Task)
    if project:
        q = q.filter(models.Task.project == project)
    if status:
        q = q.filter(models.Task.status == status)
    if priority is not None:
        q = q.filter(models.Task.priority == priority)
    if start_date_from:
        q = q.filter(models.Task.start_date >= start_date_from)
    if due_date_to:
        q = q.filter(models.Task.due_date <= due_date_to)
    return q.order_by(models.Task.priority, models.Task.created_at).all()


@router.post("/", response_model=schemas.TaskOut, status_code=201)
def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc).isoformat()
    db_task = models.Task(**task.model_dump(), created_at=now, updated_at=now)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


@router.put("/{task_id}", response_model=schemas.TaskOut)
def update_task(task_id: int, update: schemas.TaskUpdate, db: Session = Depends(get_db)):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    for k, v in update.model_dump(exclude_unset=True).items():
        setattr(db_task, k, v)
    db_task.updated_at = datetime.now(timezone.utc).isoformat()
    db.commit()
    db.refresh(db_task)
    return db_task


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(db_task)
    db.commit()
```

- [ ] **Step 6.4：运行测试，确认通过**

```bash
poetry run pytest tests/test_tasks.py -v
```

Expected: 全部 PASSED

- [ ] **Step 6.5：Commit**

```bash
git add app/routers/tasks.py tests/test_tasks.py
git commit -m "feat: add tasks CRUD router with filtering and tests"
```

---

## Task 7：Reports Router + 测试

**Files:**
- Modify: `app/routers/reports.py`（替换占位版本）
- Create: `tests/test_reports.py`

- [ ] **Step 7.1：写失败测试 tests/test_reports.py**

```python
def _setup(client):
    client.post("/api/projects", json={"id": "p", "name": "P", "color": "#000", "icon": "", "short": "P", "desc": "", "sort_order": 0})
    client.post("/api/tasks", json={"title": "完成任务", "project": "p", "status": "completed", "due_date": "2026-04-14"})
    client.post("/api/tasks", json={"title": "进行任务", "project": "p", "status": "running",   "due_date": "2026-04-14"})
    client.post("/api/tasks", json={"title": "未来任务", "project": "p", "status": "pending",   "due_date": "2026-06-01"})


def test_daily_report_returns_html(client):
    _setup(client)
    resp = client.get("/reports/daily")
    assert resp.status_code == 200
    assert "text/html" in resp.headers["content-type"]
    assert "日报" in resp.text


def test_weekly_report_returns_html(client):
    _setup(client)
    resp = client.get("/reports/weekly")
    assert resp.status_code == 200
    assert "周报" in resp.text


def test_monthly_report_returns_html(client):
    _setup(client)
    resp = client.get("/reports/monthly")
    assert resp.status_code == 200
    assert "月报" in resp.text
```

- [ ] **Step 7.2：运行测试，确认失败**

```bash
poetry run pytest tests/test_reports.py -v
```

Expected: FAILED（模板文件不存在）

- [ ] **Step 7.3：实现 app/routers/reports.py**

```python
from datetime import date, timedelta
from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from .. import models
from ..database import get_db

router = APIRouter(prefix="/reports", tags=["reports"])
templates = Jinja2Templates(directory="app/templates")


def _week_range():
    today = date.today()
    start = today - timedelta(days=today.weekday())
    return start.isoformat(), (start + timedelta(days=6)).isoformat()


def _month_range():
    today = date.today()
    start = today.replace(day=1)
    if today.month == 12:
        end = today.replace(month=12, day=31)
    else:
        end = today.replace(month=today.month + 1, day=1) - timedelta(days=1)
    return start.isoformat(), end.isoformat()


def _aggregate(db, start: str | None, end: str | None) -> dict:
    q = db.query(models.Task)
    if start:
        q = q.filter(models.Task.due_date >= start)
    if end:
        q = q.filter(models.Task.due_date <= end)
    tasks = q.all()
    return {
        "completed": [t for t in tasks if t.status == "completed"],
        "running":   [t for t in tasks if t.status == "running"],
        "blocked":   [t for t in tasks if t.status == "blocked"],
        "pending":   [t for t in tasks if t.status == "pending"],
        "total":     len(tasks),
    }


def _proj_map(db) -> dict:
    """返回 {project_id: Project} 字典，供模板直接查找，避免 Jinja2 dict 原地修改限制。"""
    return {p.id: p for p in db.query(models.Project).order_by(models.Project.sort_order).all()}


@router.get("/daily", response_class=HTMLResponse)
def daily_report(request: Request, db: Session = Depends(get_db)):
    today = date.today().isoformat()
    pm = _proj_map(db)
    return templates.TemplateResponse("report_full.html", {
        "request": request,
        "title": f"日报 · {today}",
        "period": "daily",
        "date_label": today,
        "data": _aggregate(db, today, today),
        "projects": list(pm.values()),
        "proj_map": pm,
    })


@router.get("/weekly", response_class=HTMLResponse)
def weekly_report(request: Request, db: Session = Depends(get_db)):
    start, end = _week_range()
    pm = _proj_map(db)
    return templates.TemplateResponse("report_full.html", {
        "request": request,
        "title": f"周报 · {start} ~ {end}",
        "period": "weekly",
        "date_label": f"{start} ~ {end}",
        "data": _aggregate(db, start, end),
        "projects": list(pm.values()),
        "proj_map": pm,
    })


@router.get("/monthly", response_class=HTMLResponse)
def monthly_report(request: Request, db: Session = Depends(get_db)):
    start, end = _month_range()
    pm = _proj_map(db)
    return templates.TemplateResponse("report_full.html", {
        "request": request,
        "title": f"月报 · {start[:7]}",
        "period": "monthly",
        "date_label": start[:7],
        "data": _aggregate(db, start, end),
        "projects": list(pm.values()),
        "proj_map": pm,
    })
```

- [ ] **Step 7.4：创建最小 report_full.html（供测试通过）**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>{{ title }}</title></head>
<body>
<h1>{{ title }}</h1>
<p>完成：{{ data.completed|length }} / 进行中：{{ data.running|length }} / 阻塞：{{ data.blocked|length }} / 未开始：{{ data.pending|length }}</p>
</body>
</html>
```

保存到 `app/templates/report_full.html`

- [ ] **Step 7.5：运行测试，确认通过**

```bash
poetry run pytest tests/test_reports.py -v
```

Expected: 全部 PASSED

- [ ] **Step 7.6：运行全部测试**

```bash
poetry run pytest -v
```

Expected: 全部 PASSED

- [ ] **Step 7.7：Commit**

```bash
git add app/routers/reports.py app/templates/report_full.html tests/test_reports.py
git commit -m "feat: add reports router with daily/weekly/monthly"
```

---

## Task 8：Jinja2 主页面模板

**Files:**
- Create: `app/templates/base.html`
- Create: `app/templates/index.html`
- Modify: `app/main.py`（挂载 StaticFiles）

- [ ] **Step 8.1：更新 app/main.py 挂载静态文件**

在 `app = FastAPI(...)` 之后、`include_router` 之前添加：
```python
from fastapi.staticfiles import StaticFiles
app.mount("/static", StaticFiles(directory="app/static"), name="static")
```

同时在文件顶部确保 `Jinja2Templates` 在 `/` 路由中正确引用：
```python
from fastapi.templating import Jinja2Templates
_templates = Jinja2Templates(directory="app/templates")

@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return _templates.TemplateResponse("index.html", {"request": request})
```

- [ ] **Step 8.2：创建 app/static/.gitkeep（确保目录存在）**

```bash
touch app/static/.gitkeep
```

- [ ] **Step 8.3：创建 app/templates/base.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<title>明月的工作台 · 预策</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌙</text></svg>">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<script src="//at.alicdn.com/t/c/font_5158555_dfm7au5vk0t.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
.ifc{width:1em;height:1em;vertical-align:-0.15em;fill:currentColor;overflow:hidden}
:root{
  --bg:#F7F8FA;--bg2:#FFFFFF;--bg3:#F0F2F5;--bg4:#E8ECF0;
  --border:#E2E6EA;--text:#1A1D21;--text2:#5F6B7A;--text3:#8B95A3;
  --blue:#2E7CF6;--green:#16A34A;--red:#DC2626;--yellow:#D97706;
  --shadow:0 1px 3px rgba(0,0,0,.08);--shadow-lg:0 4px 12px rgba(0,0,0,.1);
}
body{font-family:'Noto Sans SC',-apple-system,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
button{font-family:inherit;cursor:pointer;border:none;outline:none;background:none}
input,select,textarea{font-family:inherit;outline:none}
::-webkit-scrollbar{width:6px}
::-webkit-scrollbar-thumb{background:#D1D5DB;border-radius:3px}

/* Header */
.header{background:var(--bg2);padding:16px 24px;box-shadow:var(--shadow);display:flex;justify-content:space-between;align-items:center}
.header-sub{font-size:9px;color:var(--text3);font-weight:600;letter-spacing:4px;font-family:'JetBrains Mono',monospace}
.header-title{font-size:22px;font-weight:800;margin-top:4px;letter-spacing:-.5px}
.header-date{font-size:11px;color:var(--text3);margin-top:3px}

/* Nav */
.nav{display:flex;background:var(--bg2);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:10;padding:0 32px}
.nav-btn{flex:1;max-width:120px;padding:12px 2px 10px;background:none;display:flex;flex-direction:column;align-items:center;gap:3px;color:var(--text3);border-bottom:2px solid transparent;font-weight:500;transition:all .15s;font-size:11px}
.nav-btn:hover{color:var(--text2)}
.nav-btn.active{color:var(--blue);border-bottom-color:var(--blue);font-weight:700}
.nav-btn svg{width:22px;height:22px}

/* Chips */
.chip{padding:5px 12px;border-radius:16px;font-size:11px;font-weight:600;background:var(--bg4);color:var(--text3);white-space:nowrap;transition:all .15s;cursor:pointer;border:none}
.chip:hover{opacity:.85}
.chip.active{background:var(--blue);color:#fff}

/* Badges */
.badge{padding:3px 8px;border-radius:8px;font-size:10px;font-weight:600;white-space:nowrap;display:inline-block}

/* Buttons */
.pri-btn{padding:9px 20px;background:var(--blue);color:#fff;border-radius:10px;font-weight:700;font-size:13px}
.sec-btn{padding:9px 20px;background:var(--bg4);color:var(--text2);border-radius:10px;font-weight:600;font-size:13px}
.act-btn{padding:5px 12px;border-radius:8px;font-size:10px;font-weight:600;background:var(--bg4);color:var(--text3)}

/* Inputs */
.inp{width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:10px;font-size:13px;background:var(--bg2);color:var(--text)}
.inp:focus{border-color:var(--blue)}
select.inp{-webkit-appearance:none;background:var(--bg2) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%238B95A3' d='M5 7L1 3h8z'/%3E%3C/svg%3E") no-repeat right 10px center;padding-right:28px}
textarea.inp{resize:vertical;min-height:60px}

/* Modal */
.overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.25);backdrop-filter:blur(4px);z-index:30;display:flex;align-items:flex-end;justify-content:center}
.modal{background:var(--bg2);border-radius:16px 16px 0 0;padding:20px 20px 32px;width:100%;max-width:540px;animation:slideUp .25s ease}
.modal-title{font-size:15px;font-weight:700;margin-bottom:14px}
.form-row{display:flex;gap:8px;margin-top:8px}
.form-row>*{flex:1}

/* FAB */
.fab{position:fixed;bottom:24px;right:24px;width:52px;height:52px;border-radius:50%;background:var(--blue);color:#fff;font-size:24px;box-shadow:0 4px 16px rgba(46,124,246,.35);z-index:20;display:flex;align-items:center;justify-content:center}

/* Toast */
.toast{position:fixed;bottom:88px;left:50%;transform:translateX(-50%);background:var(--text);color:#fff;padding:8px 20px;border-radius:20px;font-size:12px;font-weight:700;z-index:40;animation:fadeIn .2s}

/* Layout */
.content{max-width:100%;padding:4px 24px 100px}
.section-title{font-size:13px;font-weight:700;color:var(--text2);margin-bottom:12px}
.empty{text-align:center;padding:40px;color:var(--text3);font-size:12px}

@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}

{% block extra_styles %}{% endblock %}
</style>
</head>
<body>

<div class="header">
  <div>
    <div class="header-sub">YUCE · PROJECT HUB</div>
    <div class="header-title">明月的工作台</div>
    <div class="header-date" id="hdr-date"></div>
  </div>
</div>

{% block nav %}{% endblock %}

{% block content %}{% endblock %}

<div id="modal-slot"></div>
<div id="toast-slot"></div>

<script>
document.getElementById("hdr-date").textContent = new Date().toLocaleDateString("zh-CN",{year:"numeric",month:"long",day:"numeric",weekday:"long"});
function ifc(name, size){ return `<svg class="ifc" style="width:${size||22}px;height:${size||22}px"><use xlink:href="#icon-${name}"></use></svg>`; }
function toast(msg){ const s=document.getElementById("toast-slot"); s.innerHTML=`<div class="toast">${msg}</div>`; setTimeout(()=>s.innerHTML="",1800); }
function closeModal(){ document.getElementById("modal-slot").innerHTML=""; }
</script>
{% block scripts %}{% endblock %}
</body>
</html>
```

- [ ] **Step 8.4：创建 app/templates/index.html**

```html
{% extends "base.html" %}

{% block extra_styles %}
/* ── Filter bar ── */
.filter-bar{padding:10px 24px;display:flex;flex-direction:column;gap:6px;background:var(--bg2);border-bottom:1px solid var(--border)}
.filter-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.filter-label{font-size:10px;font-weight:600;color:var(--text3);width:40px;flex-shrink:0}
.view-toggle{display:flex;gap:4px;margin-left:auto}
.view-btn{padding:5px 14px;border-radius:8px;font-size:11px;font-weight:600;background:var(--bg4);color:var(--text3);border:none;cursor:pointer}
.view-btn.active{background:var(--blue);color:#fff}

/* ── Task Toolbar ── */
.task-toolbar{display:flex;align-items:center;gap:8px;padding:10px 24px;background:var(--bg2);border-bottom:1px solid var(--border)}
.toolbar-views{display:flex;gap:2px;background:var(--bg3);border-radius:8px;padding:3px}
.toolbar-view-btn{padding:5px 14px;border-radius:6px;font-size:11px;font-weight:600;color:var(--text3);border:none;cursor:pointer;background:none;transition:all .15s}
.toolbar-view-btn.active{background:var(--bg2);color:var(--text);box-shadow:var(--shadow)}
.toolbar-divider{width:1px;height:20px;background:var(--border)}
.toolbar-new-btn{margin-left:auto;padding:6px 14px;background:var(--blue);color:#fff;border-radius:8px;font-size:12px;font-weight:700}

/* ── Kanban ── */
.kanban{display:flex;gap:12px;padding:16px 24px;align-items:start;overflow-x:auto;min-height:calc(100vh - 200px)}
.kb-col{background:var(--bg3);border-radius:12px;padding:10px;min-width:260px;width:260px;min-height:120px;flex-shrink:0}
@media(max-width:768px){.kanban{flex-direction:column}.kb-col{width:100%;min-width:0}}
.kb-col-header{font-size:11px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:8px}
.kb-status-pill{padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;display:inline-flex;align-items:center;gap:4px}
.kb-col-count{font-size:10px;color:var(--text3);margin-left:auto}
.kb-card{background:var(--bg2);border-radius:10px;padding:12px;margin-bottom:8px;border:1px solid var(--border);cursor:grab;box-shadow:var(--shadow);transition:box-shadow .15s,transform .1s;user-select:none}
.kb-card:hover{box-shadow:var(--shadow-lg)}
.kb-card:active{cursor:grabbing;transform:scale(0.98)}
.kb-card-id{font-size:9px;font-weight:600;color:var(--text3);font-family:'JetBrains Mono',monospace;margin-bottom:4px}
.kb-card-title{font-size:13px;font-weight:600;margin-bottom:6px;line-height:1.4;color:var(--text)}
.kb-card-title.done{color:var(--text3);text-decoration:line-through}
.kb-card-desc{font-size:11px;color:var(--text3);margin-bottom:8px;line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.kb-card-footer{display:flex;gap:4px;flex-wrap:wrap;align-items:center}
.kb-col.drag-target{background:color-mix(in srgb,var(--blue) 8%,var(--bg3));outline:2px dashed var(--blue);outline-offset:-2px}

/* ── Report Cards ── */
.report-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding:20px 24px}
@media(max-width:600px){.report-cards{grid-template-columns:1fr}}
.report-card-item{background:var(--bg2);border-radius:14px;padding:20px;box-shadow:var(--shadow);border:1px solid var(--border);cursor:pointer;transition:box-shadow .15s}
.report-card-item:hover{box-shadow:var(--shadow-lg)}
.rc-type{font-size:10px;font-weight:700;color:var(--text3);letter-spacing:2px;margin-bottom:6px}
.rc-title{font-size:17px;font-weight:800;margin-bottom:12px}
.rc-stats{display:flex;gap:12px;flex-wrap:wrap}
.rc-stat{text-align:center}
.rc-stat-num{font-size:22px;font-weight:800;font-family:'JetBrains Mono',monospace}
.rc-stat-label{font-size:9px;color:var(--text3);margin-top:2px;font-weight:600}
.rc-open{font-size:11px;color:var(--blue);font-weight:600;margin-top:14px}
{% endblock %}

{% block nav %}
<div class="nav" id="nav-bar">
  <button class="nav-btn active" id="nav-tasks" onclick="switchTab('tasks')">
    <svg class="ifc" style="width:22px;height:22px"><use xlink:href="#icon-qingdan"></use></svg>
    <span>任务</span>
  </button>
  <button class="nav-btn" id="nav-report" onclick="switchTab('report')">
    <svg class="ifc" style="width:22px;height:22px"><use xlink:href="#icon-tubiao"></use></svg>
    <span>日报</span>
  </button>
</div>
{% endblock %}

{% block content %}
<!-- Tasks Tab -->
<div id="tab-tasks">
  <!-- Toolbar（视图切换 + 新建） -->
  <div class="task-toolbar">
    <div class="toolbar-views">
      <button class="toolbar-view-btn active" id="btn-kanban" onclick="setView('kanban')">看板</button>
      <button class="toolbar-view-btn" id="btn-table" onclick="setView('table')">表格</button>
      <button class="toolbar-view-btn" id="btn-gantt" onclick="setView('gantt')">甘特</button>
    </div>
    <div class="toolbar-divider"></div>
    <!-- 筛选控件 -->
    <div id="project-chips" style="display:flex;gap:4px;flex-wrap:wrap"></div>
    <select id="f-status" class="chip" onchange="loadTasks()">
      <option value="">全部状态</option>
      <option value="pending">未开始</option>
      <option value="running">进行中</option>
      <option value="blocked">阻塞中</option>
      <option value="completed">已完成</option>
    </select>
    <select id="f-priority" class="chip" onchange="loadTasks()">
      <option value="">全部优先级</option>
      <option value="0">P0</option>
      <option value="1">P1</option>
      <option value="2">P2</option>
      <option value="3">P3</option>
    </select>
    <input type="date" id="f-date-from" class="chip" onchange="loadTasks()" title="截止日期起">
    <input type="date" id="f-date-to" class="chip" onchange="loadTasks()" title="截止日期至">
    <button class="toolbar-new-btn" onclick="openAddModal()">+ 新建任务</button>
  </div>
  <div id="task-view"></div>
</div>

<!-- Report Tab -->
<div id="tab-report" style="display:none">
  <div class="report-cards" id="report-cards"></div>
</div>
{% endblock %}

{% block scripts %}
<script src="/static/app.js"></script>
<script src="/static/gantt.js"></script>
{% endblock %}
```

- [ ] **Step 8.5：验证服务器可启动**

先创建一个空的 `app/static/app.js` 和 `app/static/gantt.js`：
```bash
touch app/static/app.js app/static/table.js app/static/gantt.js
```

然后启动：
```bash
poetry run uvicorn app.main:app --reload
```

浏览器访问 `http://localhost:8000`，应看到页面 shell（空内容区）。Ctrl+C 停止。

- [ ] **Step 8.6：Commit**

```bash
git add app/main.py app/templates/base.html app/templates/index.html app/static/app.js app/static/gantt.js
git commit -m "feat: add jinja2 templates and main page shell"
```

---

## Task 9：前端主逻辑 — 看板视图 + 筛选 + 拖拽

**Files:**
- Modify: `app/static/app.js`

- [ ] **Step 9.1：实现 app/static/app.js**

```javascript
// ── 常量 ──────────────────────────────────────────────────
const STATUS = {
  pending:   { label: "未开始", color: "#64748B", bg: "#F1F5F9" },
  running:   { label: "进行中", color: "#2563EB", bg: "#EFF6FF" },
  blocked:   { label: "阻塞中", color: "#DC2626", bg: "#FEF2F2" },
  completed: { label: "已完成", color: "#16A34A", bg: "#F0FDF4" },
};
const PRIORITY_LABEL = { 0: "P0", 1: "P1", 2: "P2", 3: "P3" };
const PRIORITY_COLOR = {
  0: { c: "#DC2626", bg: "#FEF2F2" },
  1: { c: "#D97706", bg: "#FFFBEB" },
  2: { c: "#2563EB", bg: "#EFF6FF" },
  3: { c: "#6B7280", bg: "#F9FAFB" },
};
const KB_COLS = ["pending", "running", "blocked", "completed"];

// ── 状态 ──────────────────────────────────────────────────
let projects = [];
let tasks = [];
let currentView = "kanban";
let selectedProject = "all";
let dragTaskId = null;

// ── 初始化 ─────────────────────────────────────────────────
async function init() {
  await loadProjects();
  await loadTasks();
  renderReportCards();
}

// ── Tab 切换 ───────────────────────────────────────────────
function switchTab(tab) {
  document.getElementById("tab-tasks").style.display  = tab === "tasks"  ? "" : "none";
  document.getElementById("tab-report").style.display = tab === "report" ? "" : "none";
  document.getElementById("nav-tasks").classList.toggle("active",  tab === "tasks");
  document.getElementById("nav-report").classList.toggle("active", tab === "report");
}

// ── Projects ───────────────────────────────────────────────
async function loadProjects() {
  const resp = await fetch("/api/projects");
  projects = await resp.json();
  renderProjectChips();
}

function renderProjectChips() {
  const container = document.getElementById("project-chips");
  const allChip = `<button class="chip ${selectedProject === "all" ? "active" : ""}" onclick="selectProject('all')">全部</button>`;
  const chips = projects.map(p =>
    `<button class="chip" style="background:${selectedProject === p.id ? p.color : "var(--bg4)"};color:${selectedProject === p.id ? "#fff" : "var(--text3)"}"
      onclick="selectProject('${p.id}')">${p.short || p.name}</button>`
  ).join("");
  container.innerHTML = allChip + chips;
}

function selectProject(pid) {
  selectedProject = pid;
  renderProjectChips();
  loadTasks();
}

function getProjectById(id) {
  return projects.find(p => p.id === id);
}

// ── Tasks ──────────────────────────────────────────────────
async function loadTasks() {
  const params = new URLSearchParams();
  if (selectedProject !== "all") params.set("project", selectedProject);
  const status = document.getElementById("f-status")?.value;
  const priority = document.getElementById("f-priority")?.value;
  const dateFrom = document.getElementById("f-date-from")?.value;
  const dateTo = document.getElementById("f-date-to")?.value;
  if (status)   params.set("status", status);
  if (priority !== "") params.set("priority", priority);
  if (dateFrom) params.set("start_date_from", dateFrom);
  if (dateTo)   params.set("due_date_to", dateTo);

  const resp = await fetch(`/api/tasks?${params}`);
  tasks = await resp.json();
  renderTaskView();
}

function setView(v) {
  currentView = v;
  ["kanban","table","gantt"].forEach(name => {
    document.getElementById(`btn-${name}`)?.classList.toggle("active", v === name);
  });
  renderTaskView();
}

function renderTaskView() {
  if (currentView === "kanban")      renderKanban();
  else if (currentView === "table")  renderTable(tasks, projects);
  else                               renderGantt(tasks, projects);
}

// ── Kanban ─────────────────────────────────────────────────
const KB_STATUS_STYLE = {
  pending:   { pillBg: "#F1F5F9", pillColor: "#475569", dot: "○" },
  running:   { pillBg: "#DBEAFE", pillColor: "#1D4ED8", dot: "●" },
  blocked:   { pillBg: "#FEE2E2", pillColor: "#DC2626", dot: "⊘" },
  completed: { pillBg: "#DCFCE7", pillColor: "#15803D", dot: "✓" },
};

function renderKanban() {
  const view = document.getElementById("task-view");
  const byStatus = {};
  KB_COLS.forEach(s => byStatus[s] = []);
  tasks.forEach(t => { if (byStatus[t.status]) byStatus[t.status].push(t); });

  view.innerHTML = `<div class="kanban">${KB_COLS.map(status => {
    const st = STATUS[status];
    const sty = KB_STATUS_STYLE[status];
    const colTasks = byStatus[status];
    return `<div class="kb-col" data-status="${status}"
        ondragover="onColDragOver(event,this)" ondrop="onColDrop(event,'${status}')" ondragleave="this.classList.remove('drag-target')">
      <div class="kb-col-header">
        <span class="kb-status-pill" style="background:${sty.pillBg};color:${sty.pillColor}">${sty.dot} ${st.label}</span>
        <span class="kb-col-count">${colTasks.length}</span>
      </div>
      ${colTasks.map(t => renderKanbanCard(t)).join("")}
    </div>`;
  }).join("")}</div>`;
}

function renderKanbanCard(t) {
  const proj = getProjectById(t.project);
  const pr = PRIORITY_COLOR[t.priority] || PRIORITY_COLOR[1];
  const isDone = t.status === "completed";
  const idLabel = `#${String(t.id).padStart(3, "0")}`;
  const snippet = t.notes ? escHTML(t.notes.slice(0, 60)) + (t.notes.length > 60 ? "…" : "") : "";
  return `<div class="kb-card" draggable="true" data-id="${t.id}"
      ondragstart="onCardDragStart(event,${t.id})"
      ondblclick="openEditModal(${t.id})">
    <div class="kb-card-id">${idLabel}${proj ? ` · ${proj.short || proj.name}` : ""}</div>
    <div class="kb-card-title ${isDone ? "done" : ""}">${escHTML(t.title)}</div>
    ${snippet ? `<div class="kb-card-desc">${snippet}</div>` : ""}
    <div class="kb-card-footer">
      <span class="badge" style="background:${pr.bg};color:${pr.c}">${PRIORITY_LABEL[t.priority] ?? "P?"}</span>
      ${proj ? `<span class="badge" style="background:${proj.color}18;color:${proj.color}">${proj.short || proj.name}</span>` : ""}
      ${t.due_date ? `<span style="font-size:9px;color:var(--text3);margin-left:auto;font-family:'JetBrains Mono',monospace">${t.due_date}</span>` : ""}
    </div>
  </div>`;
}

// ── Drag & Drop ────────────────────────────────────────────
function onCardDragStart(e, id) {
  dragTaskId = id;
  e.dataTransfer.effectAllowed = "move";
}

function onColDragOver(e, col) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  col.classList.add("drag-target");
}

function onColDrop(e, newStatus) {
  e.preventDefault();
  e.currentTarget.classList.remove("drag-target");
  if (!dragTaskId) return;
  fetch(`/api/tasks/${dragTaskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: newStatus }),
  }).then(() => { dragTaskId = null; loadTasks(); });
}

// ── Add / Edit Modal ───────────────────────────────────────
function openAddModal() {
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("modal-slot").innerHTML = `
    <div class="overlay" onclick="closeModal()">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-title">添加任务</div>
        <input class="inp" id="m-title" placeholder="任务标题">
        <div class="form-row">
          <select class="inp" id="m-proj">
            <option value="">无项目</option>
            ${projects.map(p => `<option value="${p.id}">${p.short || p.name}</option>`).join("")}
          </select>
          <select class="inp" id="m-pri">
            ${[0,1,2,3].map(i => `<option value="${i}" ${i===1?"selected":""}>${PRIORITY_LABEL[i]}</option>`).join("")}
          </select>
        </div>
        <div class="form-row">
          <select class="inp" id="m-status">
            ${Object.entries(STATUS).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join("")}
          </select>
        </div>
        <div class="form-row">
          <input type="date" class="inp" id="m-start" placeholder="开始日期">
          <input type="date" class="inp" id="m-due" value="${today}" placeholder="截止日期">
        </div>
        <textarea class="inp" id="m-notes" placeholder="备注" style="margin-top:8px"></textarea>
        <div class="form-row" style="margin-top:12px">
          <button class="pri-btn" onclick="submitAdd()">添加</button>
          <button class="sec-btn" onclick="closeModal()">取消</button>
        </div>
      </div>
    </div>`;
}

async function submitAdd() {
  const title = document.getElementById("m-title").value.trim();
  if (!title) return;
  await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      project: document.getElementById("m-proj").value || null,
      priority: parseInt(document.getElementById("m-pri").value),
      status: document.getElementById("m-status").value,
      start_date: document.getElementById("m-start").value || null,
      due_date: document.getElementById("m-due").value || null,
      notes: document.getElementById("m-notes").value || null,
    }),
  });
  closeModal(); toast("已添加"); loadTasks();
}

function openEditModal(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  document.getElementById("modal-slot").innerHTML = `
    <div class="overlay" onclick="closeModal()">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-title">编辑任务</div>
        <input class="inp" id="m-title" value="${escHTML(t.title)}">
        <div class="form-row">
          <select class="inp" id="m-proj">
            <option value="">无项目</option>
            ${projects.map(p => `<option value="${p.id}" ${p.id===t.project?"selected":""}>${p.short || p.name}</option>`).join("")}
          </select>
          <select class="inp" id="m-pri">
            ${[0,1,2,3].map(i => `<option value="${i}" ${i===t.priority?"selected":""}>${PRIORITY_LABEL[i]}</option>`).join("")}
          </select>
        </div>
        <div class="form-row">
          <select class="inp" id="m-status">
            ${Object.entries(STATUS).map(([k,v]) => `<option value="${k}" ${k===t.status?"selected":""}>${v.label}</option>`).join("")}
          </select>
        </div>
        <div class="form-row">
          <input type="date" class="inp" id="m-start" value="${t.start_date || ""}">
          <input type="date" class="inp" id="m-due" value="${t.due_date || ""}">
        </div>
        <textarea class="inp" id="m-notes" style="margin-top:8px">${escHTML(t.notes || "")}</textarea>
        <div class="form-row" style="margin-top:12px">
          <button class="pri-btn" onclick="submitEdit(${id})">保存</button>
          <button class="act-btn" style="color:#DC2626" onclick="deleteTask(${id})">删除</button>
          <button class="sec-btn" onclick="closeModal()">取消</button>
        </div>
      </div>
    </div>`;
}

async function submitEdit(id) {
  const title = document.getElementById("m-title").value.trim();
  if (!title) return;
  await fetch(`/api/tasks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      project: document.getElementById("m-proj").value || null,
      priority: parseInt(document.getElementById("m-pri").value),
      status: document.getElementById("m-status").value,
      start_date: document.getElementById("m-start").value || null,
      due_date: document.getElementById("m-due").value || null,
      notes: document.getElementById("m-notes").value || null,
    }),
  });
  closeModal(); toast("已更新"); loadTasks();
}

async function deleteTask(id) {
  if (!confirm("确认删除此任务？")) return;
  await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  closeModal(); toast("已删除"); loadTasks();
}

// ── Report Cards ───────────────────────────────────────────
function renderReportCards() {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay() + 1);
  const weekEnd   = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const monthStr  = todayStr.substring(0, 7);

  document.getElementById("report-cards").innerHTML = [
    { type: "日报", url: "/reports/daily",   label: todayStr },
    { type: "周报", url: "/reports/weekly",  label: `${weekStart.toISOString().split("T")[0]} ~ ${weekEnd.toISOString().split("T")[0]}` },
    { type: "月报", url: "/reports/monthly", label: monthStr },
  ].map(r => `
    <div class="report-card-item" onclick="window.open('${r.url}','_blank')">
      <div class="rc-type">${r.type}</div>
      <div class="rc-title">${r.label}</div>
      <div class="rc-open">点击展开完整报告 →</div>
    </div>`
  ).join("");
}

// ── Helpers ────────────────────────────────────────────────
function escHTML(s) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── Bootstrap ──────────────────────────────────────────────
init();
```

- [ ] **Step 9.2：启动服务器验证看板视图**

```bash
poetry run uvicorn app.main:app --reload
```

访问 `http://localhost:8000`，应看到：
- 项目 chip 筛选栏（Agent / 行情 / 天猫 / 其他）
- 4列看板（未开始/进行中/阻塞中/已完成）各有初始任务卡片
- 拖拽卡片到其他列后刷新状态

Ctrl+C 停止。

- [ ] **Step 9.3：Commit**

```bash
git add app/static/app.js
git commit -m "feat: kanban view with drag-and-drop and task CRUD modal"
```

---

## Task 10：表格视图

**Files:**
- Create: `app/static/table.js`

- [ ] **Step 10.1：创建 app/static/table.js**

```javascript
// ── 表格视图渲染 ────────────────────────────────────────────
// 由 app.js 中 renderTable(tasks, projects) 调用

let tableSortKey = "priority";
let tableSortAsc = true;

function renderTable(tasks, projects) {
  const view = document.getElementById("task-view");
  const pMap = {};
  projects.forEach(p => pMap[p.id] = p);

  // 排序
  const sorted = [...tasks].sort((a, b) => {
    let av = a[tableSortKey] ?? "";
    let bv = b[tableSortKey] ?? "";
    if (tableSortKey === "priority") { av = Number(av); bv = Number(bv); }
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return tableSortAsc ? cmp : -cmp;
  });

  const cols = [
    { key: "priority", label: "优先级", width: "70px" },
    { key: "title",    label: "标题",   width: "auto" },
    { key: "project",  label: "项目",   width: "100px" },
    { key: "status",   label: "状态",   width: "90px" },
    { key: "due_date", label: "截止日期", width: "110px" },
    { key: "notes",    label: "备注",   width: "200px" },
  ];

  const sortIcon = (key) => {
    if (key !== tableSortKey) return `<span style="color:var(--text3);font-size:9px">↕</span>`;
    return `<span style="color:var(--blue);font-size:9px">${tableSortAsc ? "↑" : "↓"}</span>`;
  };

  const thead = `<thead><tr style="background:var(--bg3)">
    ${cols.map(c => `<th style="width:${c.width};padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:var(--text2);border-bottom:2px solid var(--border);cursor:pointer;white-space:nowrap;user-select:none"
      onclick="tableSort('${c.key}')">${c.label} ${sortIcon(c.key)}</th>`).join("")}
  </tr></thead>`;

  const tbody = `<tbody>${sorted.map(t => {
    const proj = pMap[t.project];
    const pr = { 0:["#DC2626","#FEF2F2"], 1:["#D97706","#FFFBEB"], 2:["#2563EB","#EFF6FF"], 3:["#6B7280","#F9FAFB"] }[t.priority] || ["#6B7280","#F9FAFB"];
    const st = { pending:["#475569","#F1F5F9"], running:["#1D4ED8","#DBEAFE"], blocked:["#DC2626","#FEE2E2"], completed:["#15803D","#DCFCE7"] }[t.status] || ["#6B7280","#F1F5F9"];
    return `<tr style="border-bottom:1px solid var(--border);cursor:pointer" onclick="openEditModal(${t.id})"
        onmouseenter="this.style.background='var(--bg3)'" onmouseleave="this.style.background=''">
      <td style="padding:10px 12px">
        <span class="badge" style="background:${pr[1]};color:${pr[0]}">P${t.priority}</span>
      </td>
      <td style="padding:10px 12px;font-size:13px;font-weight:600;color:var(--text);${t.status==="completed"?"text-decoration:line-through;color:var(--text3)":""}">${escHTML(t.title)}</td>
      <td style="padding:10px 12px">
        ${proj ? `<span class="badge" style="background:${proj.color}18;color:${proj.color}">${proj.short||proj.name}</span>` : "—"}
      </td>
      <td style="padding:10px 12px">
        <span class="badge" style="background:${st[1]};color:${st[0]}">${{pending:"未开始",running:"进行中",blocked:"阻塞中",completed:"已完成"}[t.status]}</span>
      </td>
      <td style="padding:10px 12px;font-size:11px;color:var(--text3);font-family:'JetBrains Mono',monospace">${t.due_date || "—"}</td>
      <td style="padding:10px 12px;font-size:11px;color:var(--text3);max-width:200px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${escHTML(t.notes || "")}</td>
    </tr>`;
  }).join("")}</tbody>`;

  view.innerHTML = `<div style="padding:16px 24px;overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;background:var(--bg2);border-radius:12px;overflow:hidden;box-shadow:var(--shadow)">
      ${thead}${tbody}
    </table>
    ${sorted.length === 0 ? `<div class="empty" style="margin-top:40px">没有匹配的任务</div>` : ""}
  </div>`;
}

function tableSort(key) {
  if (tableSortKey === key) tableSortAsc = !tableSortAsc;
  else { tableSortKey = key; tableSortAsc = true; }
  // 触发重渲染（app.js 已加载 tasks 和 projects）
  renderTable(window._tasks || [], window._projects || []);
}
```

> 注意：`tableSort` 调用 `renderTable(window._tasks, window._projects)`，需在 `app.js` 的 `loadTasks()` 完成后将数据写入 `window._tasks` / `window._projects`（下一步修改 app.js）。

- [ ] **Step 10.2：在 app.js 中暴露全局引用（在 `loadTasks` 内赋值）**

在 `app.js` 的 `loadTasks` 函数末尾，`renderTaskView()` 调用之前，添加：
```javascript
  window._tasks    = tasks;
  window._projects = projects;
```

完整 `loadTasks` 末尾段变为：
```javascript
  tasks = await resp.json();
  window._tasks    = tasks;
  window._projects = projects;   // projects 已在 init() 时加载
  renderTaskView();
```

- [ ] **Step 10.3：在 index.html 添加 table.js 的 script 标签**

在 `{% block scripts %}` 中添加：
```html
<script src="/static/table.js"></script>
```

完整 block 变为：
```html
{% block scripts %}
<script src="/static/app.js"></script>
<script src="/static/table.js"></script>
<script src="/static/gantt.js"></script>
{% endblock %}
```

- [ ] **Step 10.4：启动服务器验证表格视图**

```bash
poetry run uvicorn app.main:app --reload
```

访问 `http://localhost:8000`，点击「表格」按钮：
- 应显示带表头的数据表格
- 点击列头可排序（优先级/标题/截止日期）
- 点击任意行打开编辑 modal

Ctrl+C 停止。

- [ ] **Step 10.5：Commit**

```bash
git add app/static/table.js app/static/app.js app/templates/index.html
git commit -m "feat: table view with column sorting"
```

---

## Task 11：甘特图视图（原 Task 10）

**Files:**
- Modify: `app/static/gantt.js`

- [ ] **Step 10.1：实现 app/static/gantt.js**

```javascript
// ── 甘特图渲染 ─────────────────────────────────────────────
// 依赖 app.js 中的全局函数：escHTML(), openEditModal()
// 确保 index.html 中 app.js 在 gantt.js 之前加载
// 由 app.js 中 renderGantt(tasks, projects) 调用

const GANTT_DAY_PX = 36;      // 每天宽度（像素）
const GANTT_ROW_H  = 44;      // 每行高度
const GANTT_LEFT_W = 200;     // 左侧固定列宽

function renderGantt(tasks, projects) {
  const view = document.getElementById("task-view");

  // 确定时间范围：当前周 ±14 天
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rangeStart = new Date(today);
  rangeStart.setDate(today.getDate() - today.getDay() - 7); // 上周一
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setDate(rangeStart.getDate() + 35); // 5 周

  const totalDays = Math.round((rangeEnd - rangeStart) / 86400000);
  const timelineW = totalDays * GANTT_DAY_PX;

  // 过滤有日期的任务（无 due_date 也展示在列表但不渲染条）
  const sorted = [...tasks].sort((a, b) => (a.due_date || "9999") < (b.due_date || "9999") ? -1 : 1);

  // 构建日期表头
  const months = [];
  let cur = new Date(rangeStart);
  while (cur <= rangeEnd) {
    months.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }

  const pMap = {};
  projects.forEach(p => pMap[p.id] = p);

  const dayHeaders = months.map(d => {
    const isToday = d.toDateString() === today.toDateString();
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    return `<div style="width:${GANTT_DAY_PX}px;text-align:center;font-size:9px;font-weight:${isToday?"700":"400"};
      color:${isToday?"var(--blue)":isWeekend?"var(--text3)":"var(--text2)"}; flex-shrink:0">
      ${d.getMonth()+1}/${d.getDate()}
    </div>`;
  }).join("");

  const rows = sorted.map(t => {
    const proj = pMap[t.project];
    const projColor = proj ? proj.color : "#8B95A3";
    const prColor = (["#DC2626","#D97706","#2563EB","#6B7280"])[t.priority] || "#6B7280";

    // 计算条的位置
    let barHtml = "";
    if (t.due_date) {
      const due = new Date(t.due_date + "T00:00:00");
      const dueOffset = Math.round((due - rangeStart) / 86400000);

      if (t.start_date) {
        const start = new Date(t.start_date + "T00:00:00");
        const startOffset = Math.round((start - rangeStart) / 86400000);
        const barDays = Math.max(1, Math.round((due - start) / 86400000) + 1);
        barHtml = `<div title="${t.title}" onclick="openEditModal(${t.id})" style="
          position:absolute;left:${startOffset * GANTT_DAY_PX}px;top:10px;
          width:${barDays * GANTT_DAY_PX - 4}px;height:24px;
          background:${projColor};border-radius:4px;cursor:pointer;
          opacity:${t.status==="completed"?0.45:0.85};
          display:flex;align-items:center;padding:0 6px;
          font-size:10px;color:#fff;font-weight:600;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">
          ${t.title}
        </div>`;
      } else {
        // 菱形标记
        barHtml = `<div title="${t.title} (${t.due_date})" onclick="openEditModal(${t.id})" style="
          position:absolute;left:${dueOffset * GANTT_DAY_PX + GANTT_DAY_PX/2 - 9}px;top:12px;
          width:18px;height:18px;background:${projColor};
          transform:rotate(45deg);cursor:pointer;opacity:${t.status==="completed"?0.4:1}">
        </div>`;
      }
    }

    return `<div style="display:flex;height:${GANTT_ROW_H}px;border-bottom:1px solid var(--border)">
      <!-- 左侧固定信息列 -->
      <div style="width:${GANTT_LEFT_W}px;min-width:${GANTT_LEFT_W}px;padding:0 12px;display:flex;align-items:center;gap:8px;border-right:1px solid var(--border)">
        <div style="width:3px;height:24px;background:${projColor};border-radius:2px;flex-shrink:0"></div>
        <div style="min-width:0">
          <div style="font-size:11px;font-weight:600;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;${t.status==="completed"?"color:var(--text3);text-decoration:line-through":""}">${escHTML(t.title)}</div>
          <div style="font-size:9px;color:var(--text3);margin-top:2px">${proj ? (proj.short||proj.name) : ""} · <span style="color:${prColor}">P${t.priority}</span></div>
        </div>
      </div>
      <!-- 时间轴 -->
      <div style="position:relative;flex:1;overflow:hidden;height:${GANTT_ROW_H}px">
        ${barHtml}
      </div>
    </div>`;
  }).join("");

  // 今日竖线 offset
  const todayOffset = Math.round((today - rangeStart) / 86400000);
  const todayLineLeft = GANTT_LEFT_W + todayOffset * GANTT_DAY_PX + GANTT_DAY_PX / 2;

  view.innerHTML = `
    <div style="overflow-x:auto;padding:0">
      <div style="min-width:${GANTT_LEFT_W + timelineW}px;position:relative">
        <!-- 今日竖线 -->
        <div style="position:absolute;left:${todayLineLeft}px;top:0;bottom:0;width:1px;background:var(--blue);opacity:.4;z-index:1;pointer-events:none"></div>
        <!-- 表头 -->
        <div style="display:flex;height:32px;border-bottom:2px solid var(--border);background:var(--bg3)">
          <div style="width:${GANTT_LEFT_W}px;min-width:${GANTT_LEFT_W}px;padding:0 12px;display:flex;align-items:center;border-right:1px solid var(--border)">
            <span style="font-size:11px;font-weight:700;color:var(--text2)">任务 (${sorted.length})</span>
          </div>
          <div style="display:flex;align-items:center;overflow:hidden">${dayHeaders}</div>
        </div>
        <!-- 行 -->
        ${rows || `<div class="empty">没有可显示的任务</div>`}
      </div>
    </div>`;
}
```

- [ ] **Step 10.2：启动服务器验证甘特视图**

```bash
poetry run uvicorn app.main:app --reload
```

访问 `http://localhost:8000`，点击「甘特」按钮：
- 应看到时间轴表头（日期）
- 有 start_date 的任务显示彩色横条
- 无 start_date 的任务显示菱形标记
- 今日位置有蓝色竖线

Ctrl+C 停止。

- [ ] **Step 10.3：Commit**

```bash
git add app/static/gantt.js
git commit -m "feat: gantt chart view with timeline bars and milestone markers"
```

---

## Task 12：全页响应式报告模板（原 Task 11）

**Files:**
- Modify: `app/templates/report_full.html`（替换 Task 7 中的最小版本）

- [ ] **Step 11.1：实现完整 report_full.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>{{ title }}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#F7F8FA;--bg2:#fff;--border:#E2E6EA;
  --text:#1A1D21;--text2:#5F6B7A;--text3:#8B95A3;
  --blue:#2E7CF6;--green:#16A34A;--red:#DC2626;--yellow:#D97706;
}
body{font-family:'Noto Sans SC',-apple-system,sans-serif;background:var(--bg);color:var(--text);
     font-size:clamp(13px,2vw,16px);line-height:1.7;padding:clamp(16px,4vw,48px)}
.report-wrap{max-width:860px;margin:0 auto;background:var(--bg2);border-radius:16px;padding:clamp(20px,5vw,48px);box-shadow:0 2px 16px rgba(0,0,0,.08)}
.report-header{border-bottom:2px solid var(--border);padding-bottom:16px;margin-bottom:24px}
.report-type{font-size:clamp(9px,1.5vw,11px);font-weight:700;letter-spacing:4px;color:var(--text3);margin-bottom:6px}
.report-title{font-size:clamp(20px,4vw,28px);font-weight:800;letter-spacing:-.5px}
.report-date{font-size:clamp(11px,2vw,13px);color:var(--text3);margin-top:4px;font-family:'JetBrains Mono',monospace}
.stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:clamp(8px,2vw,16px);margin-bottom:clamp(16px,3vw,28px)}
@media(max-width:480px){.stats-row{grid-template-columns:repeat(2,1fr)}}
.stat-box{background:var(--bg);border-radius:12px;padding:clamp(12px,2vw,20px);text-align:center}
.stat-num{font-size:clamp(24px,5vw,36px);font-weight:800;font-family:'JetBrains Mono',monospace}
.stat-lbl{font-size:clamp(10px,1.5vw,12px);color:var(--text3);margin-top:4px;font-weight:600}
.section{margin-bottom:clamp(16px,3vw,28px)}
.section-hd{font-size:clamp(12px,2vw,14px);font-weight:700;color:var(--text2);margin-bottom:clamp(8px,1.5vw,12px);
            display:flex;align-items:center;gap:8px;padding-bottom:6px;border-bottom:1px solid var(--border)}
.task-item{display:flex;gap:clamp(8px,1.5vw,12px);align-items:flex-start;
           padding:clamp(8px,1.5vw,12px) 0;border-bottom:1px solid var(--border)}
.task-item:last-child{border-bottom:none}
.task-dot{width:8px;height:8px;border-radius:50%;margin-top:6px;flex-shrink:0}
.task-body{flex:1;min-width:0}
.task-title{font-size:clamp(12px,2vw,14px);font-weight:600;line-height:1.4}
.task-title.done{color:var(--text3);text-decoration:line-through}
.task-meta{display:flex;gap:6px;margin-top:4px;flex-wrap:wrap}
.badge{padding:2px 8px;border-radius:6px;font-size:clamp(9px,1.2vw,10px);font-weight:600}
.task-notes{font-size:clamp(11px,1.5vw,12px);color:var(--text3);margin-top:4px;line-height:1.6}
.empty-section{color:var(--text3);font-size:clamp(11px,1.5vw,12px);padding:8px 0}
.print-hint{text-align:center;margin-top:clamp(16px,3vw,28px);font-size:clamp(10px,1.5vw,12px);color:var(--text3)}
@media print{.print-hint{display:none}body{padding:0}
.report-wrap{box-shadow:none;border-radius:0}}
</style>
</head>
<body>
<div class="report-wrap">
  <div class="report-header">
    <div class="report-type">{{ {"daily":"日报","weekly":"周报","monthly":"月报"}[period] }}</div>
    <div class="report-title">{{ title }}</div>
    <div class="report-date">{{ date_label }}</div>
  </div>

  <!-- 统计 -->
  <div class="stats-row">
    {% set stats = [
      ("已完成", data.completed|length, "#16A34A"),
      ("进行中", data.running|length,   "#2563EB"),
      ("阻塞中", data.blocked|length,   "#DC2626"),
      ("未开始", data.pending|length,   "#64748B"),
    ] %}
    {% for lbl, num, color in stats %}
    <div class="stat-box">
      <div class="stat-num" style="color:{{ color }}">{{ num }}</div>
      <div class="stat-lbl">{{ lbl }}</div>
    </div>
    {% endfor %}
  </div>

  <!-- 各状态分组 -->
  {% set sections = [
    ("已完成", data.completed, "#16A34A"),
    ("进行中", data.running,   "#2563EB"),
    ("阻塞中 ⚠", data.blocked, "#DC2626"),
    ("未开始", data.pending,   "#64748B"),
  ] %}
  {# proj_map 由 router 传入，格式为 {project_id: Project}，Jinja2 不支持 dict 原地修改 #}

  {% for section_label, items, color in sections %}
  <div class="section">
    <div class="section-hd" style="color:{{ color }}">{{ section_label }}（{{ items|length }} 项）</div>
    {% if items %}
      {% for t in items %}
      {% set proj = proj_map.get(t.project) %}
      <div class="task-item">
        <div class="task-dot" style="background:{{ color }}"></div>
        <div class="task-body">
          <div class="task-title {{ 'done' if t.status == 'completed' else '' }}">{{ t.title }}</div>
          <div class="task-meta">
            {% if proj %}<span class="badge" style="background:{{ proj.color }}20;color:{{ proj.color }}">{{ proj.short or proj.name }}</span>{% endif %}
            <span class="badge" style="background:#F1F5F9;color:#64748B">P{{ t.priority }}</span>
            {% if t.due_date %}<span style="font-size:10px;color:var(--text3);font-family:'JetBrains Mono',monospace">{{ t.due_date }}</span>{% endif %}
          </div>
          {% if t.notes %}<div class="task-notes">{{ t.notes }}</div>{% endif %}
        </div>
      </div>
      {% endfor %}
    {% else %}
      <div class="empty-section">暂无</div>
    {% endif %}
  </div>
  {% endfor %}

  <div class="print-hint">Cmd/Ctrl + P 可打印或保存为 PDF</div>
</div>
</body>
</html>
```

- [ ] **Step 11.2：运行全部测试确认仍然通过**

```bash
poetry run pytest -v
```

Expected: 全部 PASSED

- [ ] **Step 11.3：验证日报页面**

```bash
poetry run uvicorn app.main:app --reload
```

访问 `http://localhost:8000`，切换到「日报」tab，点击任意卡片，应在新标签页打开完整报告页面，且页面在不同窗口宽度下自适应排版。

- [ ] **Step 11.4：Commit**

```bash
git add app/templates/report_full.html
git commit -m "feat: responsive full-page report template (daily/weekly/monthly)"
```

---

## Task 13：Docker 部署配置（原 Task 12）

**Files:**
- Create: `docker/Dockerfile`
- Create: `docker-compose.yml`

- [ ] **Step 13.1：创建 docker/Dockerfile**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装 Poetry
RUN pip install --no-cache-dir poetry==1.8.3

# 复制依赖文件
COPY pyproject.toml poetry.lock* ./

# 安装生产依赖（不含 dev）
RUN poetry config virtualenvs.create false \
    && poetry install --only main --no-interaction --no-ansi

# 复制应用代码
COPY app/ ./app/

# 创建 data 目录（宿主机 volume 挂载前的占位）
RUN mkdir -p /app/data

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 13.2：创建 docker-compose.yml**

```yaml
services:
  app:
    build:
      context: .
      dockerfile: docker/Dockerfile
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data        # SQLite 数据库持久化
      - ./.env:/app/.env:ro     # 环境变量只读挂载（可选）
    env_file:
      - .env
    restart: unless-stopped
```

- [ ] **Step 13.3：准备 .env 文件（Docker 启动前必须存在）**

```bash
cp .env.example .env
```

- [ ] **Step 13.4：验证 Docker build**

```bash
docker compose build
```

Expected: 构建成功，无报错

- [ ] **Step 13.5：验证 Docker 启动**

```bash
docker compose up
```

访问 `http://localhost:8000`，确认功能正常。Ctrl+C 停止，然后：

```bash
docker compose down
```

- [ ] **Step 13.6：最终全量测试**

```bash
poetry run pytest -v
```

Expected: 全部 PASSED

- [ ] **Step 13.7：最终 Commit**

```bash
git add docker/Dockerfile docker-compose.yml poetry.lock
git commit -m "feat: add docker build and compose with volume mounts"
```

---

## 完成检查清单

- [ ] `poetry run pytest -v` 全部通过
- [ ] `http://localhost:8000` 看板视图正常：彩色列头、卡片含 ID/描述/优先级 badge、卡片可拖拽
- [ ] 表格视图正常：6列展示，点击列头排序，点击行打开编辑
- [ ] 甘特图视图正常：有条/菱形标记，今日竖线
- [ ] 三视图切换按钮（看板/表格/甘特）正常高亮切换
- [ ] 筛选（项目/状态/优先级/日期）可用
- [ ] 日报/周报/月报新标签页打开，响应式正常
- [ ] `docker compose build && docker compose up` 成功
- [ ] `data/mingyue.db` 在 `data/` 目录下正确生成
