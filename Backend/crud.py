# This file contains reusable functions to interact with the database.
# CRUD stands for Create, Read, Update, Delete.
# Keeping these functions separate from our API routes (main.py) makes the code cleaner and easier to test.

from typing import Optional, List
from sqlalchemy.orm import Session
from passlib.context import CryptContext
import models
import schemas

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- Users CRUD ---

def get_user(db: Session, user_id: int):
    # Query the 'User' table, filter by id, and get the first matching result
    return db.query(models.User).filter(models.User.id == user_id).first()


def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()


def get_users(db: Session, skip: int = 0, limit: int = 100):
    # Query all users, but allow skipping and limiting for pagination
    return db.query(models.User).offset(skip).limit(limit).all()


def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str):
    return pwd_context.hash(password)


def create_user(db: Session, user: schemas.UserCreate):
    # 1. Create a new SQLAlchemy User model instance using the data from our Pydantic schema
    db_user = models.User(
        name=user.name,
        email=user.email,
        password_hash=get_password_hash(user.password),
    )
    # 2. Add the instance to the session (like putting it in a staging area)
    db.add(db_user)
    # 3. Commit the session (save the changes to the database)
    db.commit()
    # 4. Refresh the instance to get the newly generated ID from the database
    db.refresh(db_user)
    return db_user

# --- Projects CRUD ---
# --- Projects CRUD (Week 3: Owner & Membership) ---

def get_projects(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Project).offset(skip).limit(limit).all()
def get_projects(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    """
    Week 3 Rule: Users only see projects they own or belong to as a member.
    """
    return db.query(models.Project).outerjoin(
        models.ProjectMember, models.Project.id == models.ProjectMember.project_id
    ).filter(
        (models.Project.owner_id == user_id) | (models.ProjectMember.user_id == user_id)
    ).distinct().offset(skip).limit(limit).all()

def create_project(db: Session, project: schemas.ProjectCreate):
    db_project = models.Project(title=project.title, description=project.description)

def create_project(db: Session, project: schemas.ProjectCreate, owner_id: int):
    """
    Week 3: Create a project with an owner_id.
    Also automatically adds the creator to project_members with role='owner'.
    """
    db_project = models.Project(
        title=project.title,
        description=project.description,
        owner_id=owner_id
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)

    # Automatically add the owner to project_members
    owner_member = models.ProjectMember(
        project_id=db_project.id,
        user_id=owner_id,
        role="owner"
    )
    db.add(owner_member)
    db.commit()
    db.refresh(db_project)
    return db_project


def get_project(db: Session, project_id: int):
    return db.query(models.Project).filter(models.Project.id == project_id).first()


def delete_project(db: Session, project_id: int):
    # Find the project
    db_project = get_project(db, project_id)
    if db_project:
        # Delete related tasks first to avoid foreign key constraint errors
        # Delete related tasks and member records first
        db.query(models.Task).filter(models.Task.project_id == project_id).delete()
        db.query(models.ProjectMember).filter(models.ProjectMember.project_id == project_id).delete()
        # Delete the project
        db.delete(db_project)
        db.commit()
    return db_project

# --- Tasks CRUD ---

def get_tasks(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Task).offset(skip).limit(limit).all()
# --- Project Membership Helpers (Week 3) ---

def is_project_member(db: Session, project_id: int, user_id: int) -> bool:
    """
    Check if a user is either the project owner or a registered project member.
    """
    project = get_project(db, project_id)
    if not project:
        return False
    if project.owner_id == user_id:
        return True
    member = db.query(models.ProjectMember).filter(
        models.ProjectMember.project_id == project_id,
        models.ProjectMember.user_id == user_id
    ).first()
    return member is not None


def is_project_owner(db: Session, project_id: int, user_id: int) -> bool:
    """
    Check if a user is the owner of the project.
    """
    project = get_project(db, project_id)
    if not project:
        return False
    return project.owner_id == user_id


def get_project_members(db: Session, project_id: int):
    """
    Get all members belonging to a project.
    """
    return db.query(models.ProjectMember).filter(models.ProjectMember.project_id == project_id).all()


def add_project_member(db: Session, project_id: int, user_id: int, role: str = "member"):
    """
    Add a user to a project team as a member.
    """
    existing = db.query(models.ProjectMember).filter(
        models.ProjectMember.project_id == project_id,
        models.ProjectMember.user_id == user_id
    ).first()
    if existing:
        return existing
    new_member = models.ProjectMember(project_id=project_id, user_id=user_id, role=role)
    db.add(new_member)
    db.commit()
    db.refresh(new_member)
    return new_member


def remove_project_member(db: Session, project_id: int, user_id: int):
    """
    Remove a member from a project team.
    """
    member = db.query(models.ProjectMember).filter(
        models.ProjectMember.project_id == project_id,
        models.ProjectMember.user_id == user_id
    ).first()
    if member:
        db.delete(member)
        db.commit()
    return member


# --- Tasks CRUD (Week 3: Authorization & Assignment) ---

def get_tasks(db: Session, user_id: int, project_id: Optional[int] = None, skip: int = 0, limit: int = 100):
    """
    Week 3 Rule: Users only see tasks for projects they own or belong to.
    """
    query = db.query(models.Task).join(models.Project).outerjoin(
        models.ProjectMember, models.Project.id == models.ProjectMember.project_id
    ).filter(
        (models.Project.owner_id == user_id) | (models.ProjectMember.user_id == user_id)
    ).distinct()
    
    if project_id is not None:
        query = query.filter(models.Task.project_id == project_id)
        
    return query.offset(skip).limit(limit).all()


def create_task(db: Session, task: schemas.TaskCreate):
    # The double asterisk (**) unpacks the dictionary into keyword arguments.
    # It's equivalent to: title=task.title, description=task.description, etc.
    db_task = models.Task(**task.model_dump())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


def get_task(db: Session, task_id: int):
    return db.query(models.Task).filter(models.Task.id == task_id).first()


def update_task(db: Session, task_id: int, task_update: schemas.TaskUpdate):
    db_task = get_task(db, task_id)
    if db_task:
        # Update only the fields that were provided in the request
        update_data = task_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_task, key, value) # setattr(object, name, value) is like object.name = value
            setattr(db_task, key, value)
        
        db.add(db_task)
        db.commit()
        db.refresh(db_task)
    return db_task


def delete_task(db: Session, task_id: int):
    db_task = get_task(db, task_id)
    if db_task:
        db.delete(db_task)
        db.commit()
    return db_task
