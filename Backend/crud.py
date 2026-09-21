from typing import Optional, List
from sqlalchemy.orm import Session
from passlib.context import CryptContext
import models
import schemas

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- Users CRUD ---

def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()


def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()


def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.User).offset(skip).limit(limit).all()


def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str):
    return pwd_context.hash(password)


def create_user(db: Session, user: schemas.UserCreate):
    db_user = models.User(
        name=user.name,
        email=user.email,
        password_hash=get_password_hash(user.password),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


# --- Projects CRUD ---

def get_projects(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    """
    Week 3 Rule: Users only see projects they own or belong to as a member.
    """
    return db.query(models.Project).outerjoin(
        models.ProjectMember, models.Project.id == models.ProjectMember.project_id
    ).filter(
        (models.Project.owner_id == user_id) | (models.ProjectMember.user_id == user_id)
    ).distinct().offset(skip).limit(limit).all()


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
    db_project = get_project(db, project_id)
    if db_project:
        db.delete(db_project)
        db.commit()
    return db_project


# --- Project Membership Helpers ---

def is_project_member(db: Session, project_id: int, user_id: int) -> bool:
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
    project = get_project(db, project_id)
    if not project:
        return False
    return project.owner_id == user_id


def get_project_members(db: Session, project_id: int):
    members = db.query(models.ProjectMember).filter(models.ProjectMember.project_id == project_id).all()
    user_ids = [m.user_id for m in members]
    return db.query(models.User).filter(models.User.id.in_(user_ids)).all()


def add_project_member(db: Session, project_id: int, user_id: int, role: str = "member"):
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
    member = db.query(models.ProjectMember).filter(
        models.ProjectMember.project_id == project_id,
        models.ProjectMember.user_id == user_id
    ).first()
    if member:
        db.delete(member)
        db.commit()
    return member


# --- Tasks CRUD ---

def get_tasks(db: Session, user_id: int, project_id: Optional[int] = None, skip: int = 0, limit: int = 100):
    query = db.query(models.Task).join(models.Project).outerjoin(
        models.ProjectMember, models.Project.id == models.ProjectMember.project_id
    ).filter(
        (models.Project.owner_id == user_id) | (models.ProjectMember.user_id == user_id)
    ).distinct()
    
    if project_id is not None:
        query = query.filter(models.Task.project_id == project_id)
        
    return query.offset(skip).limit(limit).all()


def get_task(db: Session, task_id: int):
    return db.query(models.Task).filter(models.Task.id == task_id).first()


def create_task(db: Session, task: schemas.TaskCreate, user_id: Optional[int] = None):
    db_task = models.Task(**task.model_dump())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)

    # Automatically record creation in Activity History
    if user_id:
        create_task_activity(db, task_id=db_task.id, user_id=user_id, action="created this task")

    return db_task


def update_task(db: Session, task_id: int, task_update: schemas.TaskUpdate, user_id: Optional[int] = None):
    db_task = get_task(db, task_id)
    if not db_task:
        return None

    update_data = task_update.model_dump(exclude_unset=True)

    # Track changes for Activity Audit Log
    activities = []
    if "status" in update_data and update_data["status"] != db_task.status:
        activities.append(f"changed status to '{update_data['status']}'")
    if "priority" in update_data and update_data["priority"] != db_task.priority:
        activities.append(f"changed priority to '{update_data['priority']}'")
    if "assigned_user_id" in update_data and update_data["assigned_user_id"] != db_task.assigned_user_id:
        new_assigned_id = update_data["assigned_user_id"]
        if new_assigned_id:
            assigned_u = get_user(db, new_assigned_id)
            name = assigned_u.name if assigned_u else f"User #{new_assigned_id}"
            activities.append(f"assigned task to {name}")
        else:
            activities.append("unassigned this task")
    if "due_date" in update_data and update_data["due_date"] != db_task.due_date:
        activities.append(f"set due date to {update_data['due_date']}")

    for key, value in update_data.items():
        setattr(db_task, key, value)
    
    db.add(db_task)
    db.commit()
    db.refresh(db_task)

    # Log each activity
    if user_id and activities:
        for act in activities:
            create_task_activity(db, task_id=task_id, user_id=user_id, action=act)

    return db_task


def delete_task(db: Session, task_id: int):
    db_task = get_task(db, task_id)
    if db_task:
        db.delete(db_task)
        db.commit()
    return db_task


# --- Task Activity Audit Log CRUD ---

def create_task_activity(db: Session, task_id: int, user_id: int, action: str):
    activity = models.TaskActivity(task_id=task_id, user_id=user_id, action=action)
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


def get_task_activities(db: Session, task_id: int):
    return db.query(models.TaskActivity).filter(models.TaskActivity.task_id == task_id).order_by(models.TaskActivity.created_at.desc()).all()


# --- Task Comments CRUD ---

def create_task_comment(db: Session, task_id: int, user_id: int, content: str):
    comment = models.TaskComment(task_id=task_id, user_id=user_id, content=content)
    db.add(comment)
    db.commit()
    db.refresh(comment)

    # Also log in activity
    create_task_activity(db, task_id=task_id, user_id=user_id, action="commented on this task")
    return comment


def get_task_comments(db: Session, task_id: int):
    return db.query(models.TaskComment).filter(models.TaskComment.task_id == task_id).order_by(models.TaskComment.created_at.asc()).all()
