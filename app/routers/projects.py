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
