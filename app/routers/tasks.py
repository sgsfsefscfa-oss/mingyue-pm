from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("/", response_model=list[schemas.TaskOut])
def list_tasks(db: Session = Depends(get_db)):
    return db.query(models.Task).all()


@router.post("/", response_model=schemas.TaskOut, status_code=201)
def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc).isoformat()
    db_task = models.Task(**task.model_dump(), created_at=now, updated_at=now)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task
