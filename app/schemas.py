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
