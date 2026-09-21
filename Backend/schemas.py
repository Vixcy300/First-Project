from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import Optional, List

# --- User Schemas ---

class UserBase(BaseModel):
    name: str
    email: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    email: Optional[str] = None


# --- Project Membership Schemas (Week 3) ---

class ProjectMember(BaseModel):
    id: int
    project_id: int
    user_id: int
    role: str = "member"  # 'owner' or 'member'
    user: Optional[User] = None

    model_config = ConfigDict(from_attributes=True)

class ProjectMemberAdd(BaseModel):
    user_id: Optional[int] = None
    email: Optional[str] = None
    role: Optional[str] = "member"


# --- Task Activity & Comment Schemas ---

class TaskActivity(BaseModel):
    id: int
    task_id: int
    user_id: int
    action: str
    created_at: datetime
    user: Optional[User] = None

    model_config = ConfigDict(from_attributes=True)


class TaskCommentBase(BaseModel):
    content: str

class TaskCommentCreate(TaskCommentBase):
    pass

class TaskComment(TaskCommentBase):
    id: int
    task_id: int
    user_id: int
    created_at: datetime
    user: Optional[User] = None

    model_config = ConfigDict(from_attributes=True)


# --- Task Schemas ---

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: Optional[str] = "To Do"
    priority: Optional[str] = "Medium"  # Low, Medium, High, Urgent
    due_date: Optional[str] = None     # YYYY-MM-DD
    assigned_user_id: Optional[int] = None

class TaskCreate(TaskBase):
    project_id: int

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None
    assigned_user_id: Optional[int] = None

class Task(TaskBase):
    id: int
    project_id: int
    assignee: Optional[User] = None

    model_config = ConfigDict(from_attributes=True)


# --- Project Schemas ---

class ProjectBase(BaseModel):
    title: str
    description: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass

class Project(ProjectBase):
    id: int
    owner_id: Optional[int] = None
    owner: Optional[User] = None
    members: List[ProjectMember] = []
    tasks: List[Task] = []

    model_config = ConfigDict(from_attributes=True)
