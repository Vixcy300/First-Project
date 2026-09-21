# This file defines Pydantic schemas. 
# While SQLAlchemy models (in models.py) define how data is stored in the database,
# Pydantic schemas define the shape of data as it enters and leaves our API.
# This ensures data validation and serialization/deserialization.

from pydantic import BaseModel, ConfigDict
from typing import Optional, List

# --- User Schemas ---

# Base schema contains attributes common to creating and reading a user.
class UserBase(BaseModel):
    name: str
    email: str

# Schema used when creating a user (inherits everything from UserBase).
class UserCreate(UserBase):
    password: str

# Schema used when returning user data from the API.
class User(UserBase):
    id: int

    # ConfigDict(from_attributes=True) tells Pydantic to read data even if it is not a dict,
    # but an ORM model (like our SQLAlchemy User model).
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


# --- Task Schemas ---

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: Optional[str] = "To Do"
    assigned_user_id: Optional[int] = None

class TaskCreate(TaskBase):
    project_id: int # We must specify which project a task belongs to when creating it.
    project_id: int

# Schema for updating a task (all fields are optional because we might only update one field)
class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
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

# When we fetch a project, we also want to fetch all the tasks associated with it.
# When we fetch a project, we also include owner, members, and tasks.
class Project(ProjectBase):
    id: int
    tasks: List[Task] = [] # A list of Task schemas
    owner_id: Optional[int] = None
    owner: Optional[User] = None
    members: List[ProjectMember] = []
    tasks: List[Task] = []

    model_config = ConfigDict(from_attributes=True)
