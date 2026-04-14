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
