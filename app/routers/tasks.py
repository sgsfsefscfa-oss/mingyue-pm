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
