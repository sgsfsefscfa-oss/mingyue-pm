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
