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
    db = SessionLocal()
    try:
        seed_db(db)
    finally:
        db.close()
    yield


app = FastAPI(title="明月工作台", lifespan=lifespan)

try:
    app.mount("/static", StaticFiles(directory="app/static"), name="static")
except Exception:
    pass

app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(reports.router)


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return _templates.TemplateResponse("index.html", {"request": request})
