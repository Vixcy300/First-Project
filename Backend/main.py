from datetime import datetime, timedelta, timezone
from typing import List, Optional

import jwt
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jwt import InvalidTokenError
from sqlalchemy.orm import Session

import crud
import models
import schemas
from database import engine, get_db, init_db

SECRET_KEY = "super-secret-key-change-me-to-a-very-long-secret-key-for-jwt"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

security = HTTPBearer()

# Safely initialize database tables and apply migrations
init_db()

app = FastAPI(title="Task and Project Management Portal API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    auth: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = auth.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except InvalidTokenError:
        raise credentials_exception

    user = crud.get_user_by_email(db, email=email)
    if user is None:
        raise credentials_exception
    return user


# --- Health Check ---
@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Backend is running smoothly!"}


# --- Auth Routes ---
@app.post("/register", response_model=schemas.User)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db=db, user=user)


@app.post("/login", response_model=schemas.Token)
def login_user(user: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, user.email)
    if not db_user or not crud.verify_password(user.password, db_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": db_user.email})
    return {"access_token": access_token, "token_type": "bearer"}


# --- User Routes ---
@app.get("/users/me", response_model=schemas.User)
def read_current_user(current_user: models.User = Depends(get_current_user)):
    return current_user


@app.get("/users/", response_model=List[schemas.User])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_users(db, skip=skip, limit=limit)


# --- Project Routes ---
@app.post("/projects/", response_model=schemas.Project)
def create_project(
    project: schemas.ProjectCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return crud.create_project(db=db, project=project, owner_id=current_user.id)


@app.get("/projects/", response_model=List[schemas.Project])
def read_projects(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return crud.get_projects(db=db, user_id=current_user.id, skip=skip, limit=limit)


@app.get("/projects/{project_id}", response_model=schemas.Project)
def read_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not crud.is_project_member(db, user_id=current_user.id, project_id=project_id):
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    project = crud.get_project(db, project_id=project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@app.delete("/projects/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    project = crud.get_project(db, project_id=project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if not crud.is_project_owner(db, user_id=current_user.id, project_id=project_id):
        raise HTTPException(status_code=403, detail="Only the project owner can delete this project")
    crud.delete_project(db, project_id=project_id)
    return {"message": "Project deleted successfully", "id": project_id}


# --- Project Members Routes ---
@app.get("/projects/{project_id}/members", response_model=List[schemas.User])
def get_project_members(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not crud.is_project_member(db, user_id=current_user.id, project_id=project_id):
        raise HTTPException(status_code=403, detail="Not authorized to view project members")
    return crud.get_project_members(db, project_id=project_id)


@app.post("/projects/{project_id}/members", response_model=schemas.ProjectMember)
def add_project_member(
    project_id: int,
    member_in: schemas.ProjectMemberAdd,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not crud.is_project_member(db, user_id=current_user.id, project_id=project_id):
        raise HTTPException(status_code=403, detail="Not authorized to add members to this project")
    
    target_user = crud.get_user_by_email(db, email=member_in.email) if member_in.email else crud.get_user(db, user_id=member_in.user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if crud.is_project_member(db, user_id=target_user.id, project_id=project_id):
        raise HTTPException(status_code=400, detail="User is already a member of this project")

    return crud.add_project_member(db=db, project_id=project_id, user_id=target_user.id, role=member_in.role)


@app.delete("/projects/{project_id}/members/{user_id}")
def remove_project_member(
    project_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not crud.is_project_owner(db, user_id=current_user.id, project_id=project_id):
        raise HTTPException(status_code=403, detail="Only the project owner can remove members")
    
    success = crud.remove_project_member(db=db, project_id=project_id, user_id=user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Member not found in project")
    return {"message": "Member removed successfully"}


# --- Tasks Routes ---
@app.post("/tasks/", response_model=schemas.Task)
def create_task(
    task: schemas.TaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not crud.is_project_member(db, user_id=current_user.id, project_id=task.project_id):
        raise HTTPException(status_code=403, detail="Must be a project member to create tasks")
    
    if task.assigned_user_id:
        if not crud.is_project_member(db, user_id=task.assigned_user_id, project_id=task.project_id):
            raise HTTPException(status_code=400, detail="Assignee must be a member of the project")

    return crud.create_task(db=db, task=task, user_id=current_user.id)


@app.get("/tasks/", response_model=List[schemas.Task])
def read_tasks(
    project_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return crud.get_tasks(db=db, user_id=current_user.id, project_id=project_id, skip=skip, limit=limit)


@app.patch("/tasks/{task_id}", response_model=schemas.Task)
def update_task(
    task_id: int,
    task_update: schemas.TaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    existing_task = crud.get_task(db, task_id=task_id)
    if not existing_task:
        raise HTTPException(status_code=404, detail="Task not found")

    if not crud.is_project_member(db, user_id=current_user.id, project_id=existing_task.project_id):
        raise HTTPException(status_code=403, detail="Must be a project member to edit tasks")

    if task_update.assigned_user_id:
        if not crud.is_project_member(db, user_id=task_update.assigned_user_id, project_id=existing_task.project_id):
            raise HTTPException(status_code=400, detail="Assignee must be a member of the project")

    return crud.update_task(db, task_id=task_id, task_update=task_update, user_id=current_user.id)


@app.delete("/tasks/{task_id}", response_model=schemas.Task)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    existing_task = crud.get_task(db, task_id=task_id)
    if not existing_task:
        raise HTTPException(status_code=404, detail="Task not found")

    if not crud.is_project_member(db, user_id=current_user.id, project_id=existing_task.project_id):
        raise HTTPException(status_code=403, detail="Must be a project member to delete tasks")

    return crud.delete_task(db, task_id=task_id)


# --- Task Activities (Audit Log) & Comments Routes ---
@app.get("/tasks/{task_id}/activities", response_model=List[schemas.TaskActivity])
def read_task_activities(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = crud.get_task(db, task_id=task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not crud.is_project_member(db, user_id=current_user.id, project_id=task.project_id):
        raise HTTPException(status_code=403, detail="Must be a project member to view task activities")
    return crud.get_task_activities(db, task_id=task_id)


@app.get("/tasks/{task_id}/comments", response_model=List[schemas.TaskComment])
def read_task_comments(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = crud.get_task(db, task_id=task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not crud.is_project_member(db, user_id=current_user.id, project_id=task.project_id):
        raise HTTPException(status_code=403, detail="Must be a project member to view task comments")
    return crud.get_task_comments(db, task_id=task_id)


@app.post("/tasks/{task_id}/comments", response_model=schemas.TaskComment)
def create_task_comment(
    task_id: int,
    comment_in: schemas.TaskCommentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = crud.get_task(db, task_id=task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not crud.is_project_member(db, user_id=current_user.id, project_id=task.project_id):
        raise HTTPException(status_code=403, detail="Must be a project member to comment on this task")
    if not comment_in.content.strip():
        raise HTTPException(status_code=400, detail="Comment content cannot be empty")
    return crud.create_task_comment(db, task_id=task_id, user_id=current_user.id, content=comment_in.content.strip())


# --- CSV Import & Bulk Update Endpoint ---

@app.post("/csv/upload", response_model=schemas.CSVImportResult)
async def upload_csv_data(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files (.csv) are supported")
    
    try:
        content_bytes = await file.read()
        try:
            content = content_bytes.decode("utf-8")
        except UnicodeDecodeError:
            content = content_bytes.decode("latin-1")
            
        result = crud.import_csv_data(db, current_user=current_user, csv_content=content)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process CSV file: {str(e)}")
