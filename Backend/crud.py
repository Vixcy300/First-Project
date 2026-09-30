import csv
import io
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


def update_project(db: Session, project_id: int, project_update: schemas.ProjectUpdate):
    db_project = get_project(db, project_id)
    if not db_project:
        return None
    data = project_update.model_dump(exclude_unset=True)
    for key, val in data.items():
        setattr(db_project, key, val)
    db.commit()
    db.refresh(db_project)
    return db_project


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
    """
    Return the ProjectMember rows of a project (with their nested `user`).

    Returning ProjectMember objects keeps the membership `role` alongside the
    user data, which is what the API/frontend expect from
    GET /projects/{project_id}/members (List[schemas.ProjectMember]).
    """
    return db.query(models.ProjectMember).filter(
        models.ProjectMember.project_id == project_id
    ).all()


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

    # If assigned to another user, trigger notification
    if db_task.assigned_user_id and db_task.assigned_user_id != user_id:
        create_notification(
            db,
            user_id=db_task.assigned_user_id,
            title="Task Assigned",
            message=f"You have been assigned to task '{db_task.title}'",
            link="/tasks"
        )

    return db_task


def update_task(db: Session, task_id: int, task_update: schemas.TaskUpdate, user_id: Optional[int] = None):
    db_task = get_task(db, task_id)
    if not db_task:
        return None

    update_data = task_update.model_dump(exclude_unset=True)

    # Track changes for Activity Audit Log
    activities = []
    old_assigned_user_id = db_task.assigned_user_id
    old_status = db_task.status

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

    # Trigger notifications:
    # 1. If assigned to a new user
    if "assigned_user_id" in update_data and update_data["assigned_user_id"] and update_data["assigned_user_id"] != old_assigned_user_id:
        if update_data["assigned_user_id"] != user_id:
            create_notification(
                db,
                user_id=update_data["assigned_user_id"],
                title="Task Assigned",
                message=f"You have been assigned to task '{db_task.title}'",
                link="/tasks"
            )

    # 2. If status was changed to 'Done'
    if "status" in update_data and update_data["status"] == "Done" and old_status != "Done":
        project = get_project(db, db_task.project_id)
        if project and project.owner_id and project.owner_id != user_id:
            create_notification(
                db,
                user_id=project.owner_id,
                title="Task Completed",
                message=f"Task '{db_task.title}' in '{project.title}' was marked as Done",
                link="/tasks"
            )

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


# --- Notifications CRUD ---

def create_notification(db: Session, user_id: int, title: str, message: str, link: Optional[str] = None):
    notification = models.Notification(
        user_id=user_id,
        title=title,
        message=message,
        link=link,
        is_read=False
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def get_user_notifications(db: Session, user_id: int, limit: int = 50):
    return db.query(models.Notification).filter(
        models.Notification.user_id == user_id
    ).order_by(models.Notification.created_at.desc()).limit(limit).all()


def mark_notification_read(db: Session, notification_id: int, user_id: int):
    notification = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == user_id
    ).first()
    if notification:
        notification.is_read = True
        db.commit()
        db.refresh(notification)
    return notification


def mark_all_notifications_read(db: Session, user_id: int):
    db.query(models.Notification).filter(
        models.Notification.user_id == user_id,
        models.Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return True


# --- Subtasks CRUD ---

def get_subtasks(db: Session, task_id: int):
    return db.query(models.Subtask).filter(
        models.Subtask.task_id == task_id
    ).order_by(models.Subtask.created_at.asc()).all()


def create_subtask(db: Session, task_id: int, title: str):
    subtask = models.Subtask(task_id=task_id, title=title, completed=False)
    db.add(subtask)
    db.commit()
    db.refresh(subtask)
    return subtask


def update_subtask(db: Session, subtask_id: int, update_data: schemas.SubtaskUpdate):
    subtask = db.query(models.Subtask).filter(models.Subtask.id == subtask_id).first()
    if not subtask:
        return None
    data = update_data.model_dump(exclude_unset=True)
    for key, val in data.items():
        setattr(subtask, key, val)
    db.commit()
    db.refresh(subtask)
    return subtask


def delete_subtask(db: Session, subtask_id: int):
    subtask = db.query(models.Subtask).filter(models.Subtask.id == subtask_id).first()
    if subtask:
        db.delete(subtask)
        db.commit()
    return subtask


# --- Task Comments CRUD ---

def create_task_comment(db: Session, task_id: int, user_id: int, content: str):
    comment = models.TaskComment(task_id=task_id, user_id=user_id, content=content)
    db.add(comment)
    db.commit()
    db.refresh(comment)

    # Also log in activity
    create_task_activity(db, task_id=task_id, user_id=user_id, action="commented on this task")

    # Notify task assignee if someone else commented
    task = get_task(db, task_id)
    commenter = get_user(db, user_id)
    commenter_name = commenter.name if commenter else "A teammate"

    if task:
        if task.assigned_user_id and task.assigned_user_id != user_id:
            create_notification(
                db,
                user_id=task.assigned_user_id,
                title="New Comment",
                message=f"{commenter_name} commented on '{task.title}': \"{content[:40]}{'...' if len(content)>40 else ''}\"",
                link="/tasks"
            )

    return comment


def get_task_comments(db: Session, task_id: int):
    return db.query(models.TaskComment).filter(models.TaskComment.task_id == task_id).order_by(models.TaskComment.created_at.asc()).all()


# --- CSV Import & Bulk Update CRUD ---

def import_csv_data(db: Session, current_user: models.User, csv_content: str):
    # Support both UTF-8 with BOM and without
    if csv_content.startswith('\ufeff'):
        csv_content = csv_content[1:]

    reader = csv.DictReader(io.StringIO(csv_content))
    
    projects_created = 0
    tasks_created = 0
    tasks_updated = 0
    errors: List[str] = []
    
    # Cache user accessible projects
    accessible_projects = get_projects(db, user_id=current_user.id)
    project_map = {p.title.strip().lower(): p for p in accessible_projects}
    
    valid_statuses = {"To Do", "In Progress", "Done"}
    valid_priorities = {"Low", "Medium", "High", "Urgent"}
    
    row_num = 1
    for raw_row in reader:
        row_num += 1
        # Normalize column names: strip whitespace, lowercase
        row = {}
        for k, v in raw_row.items():
            if k is not None:
                cleaned_key = k.strip().lower().replace(" ", "_")
                cleaned_val = v.strip() if isinstance(v, str) else v
                row[cleaned_key] = cleaned_val

        project_title = row.get("project_title") or row.get("project") or ""
        task_title = row.get("task_title") or row.get("task") or row.get("title") or ""
        
        # Skip completely blank lines
        if not project_title and not task_title:
            continue
            
        if not project_title:
            errors.append(f"Row {row_num}: Missing 'project_title'")
            continue
            
        if not task_title:
            errors.append(f"Row {row_num}: Missing 'task_title'")
            continue

        # 1. Get or create project
        proj_key = project_title.lower()
        if proj_key in project_map:
            project = project_map[proj_key]
        else:
            project_create = schemas.ProjectCreate(
                title=project_title,
                description=f"Imported from CSV on {current_user.name}'s workspace"
            )
            project = create_project(db, project=project_create, owner_id=current_user.id)
            project_map[proj_key] = project
            projects_created += 1

        # 2. Check if task already exists in this project
        existing_task = db.query(models.Task).filter(
            models.Task.project_id == project.id,
            models.Task.title.ilike(task_title)
        ).first()

        # Parse task attributes
        description = row.get("task_description") or row.get("description") or ""
        
        status_val = row.get("status") or "To Do"
        status_match = next((s for s in valid_statuses if s.lower() == status_val.lower()), "To Do")
        
        priority_val = row.get("priority") or "Medium"
        priority_match = next((p for p in valid_priorities if p.lower() == priority_val.lower()), "Medium")
        
        due_date = row.get("due_date") or None
        if due_date:
            due_date = due_date.strip()
            # Basic validation for YYYY-MM-DD
            if len(due_date) != 10 or due_date[4] != '-' or due_date[7] != '-':
                due_date = None

        # Assignee matching by email
        assigned_user_id = None
        assignee_email = row.get("assignee_email") or row.get("assignee") or ""
        if assignee_email:
            assigned_user = get_user_by_email(db, assignee_email)
            if assigned_user:
                if not is_project_member_or_owner(db, project_id=project.id, user_id=assigned_user.id):
                    # Add as member if current user is owner
                    if project.owner_id == current_user.id:
                        add_project_member(db, project_id=project.id, user_id=assigned_user.id, role="member")
                        assigned_user_id = assigned_user.id
                    else:
                        errors.append(f"Row {row_num}: User '{assignee_email}' is not a member of project '{project_title}'")
                else:
                    assigned_user_id = assigned_user.id
            else:
                errors.append(f"Row {row_num}: Assignee email '{assignee_email}' not found in registered users")

        if existing_task:
            # Update existing task
            update_data = schemas.TaskUpdate(
                title=task_title,
                description=description if description else existing_task.description,
                status=status_match,
                priority=priority_match,
                due_date=due_date if due_date is not None else existing_task.due_date,
                assigned_user_id=assigned_user_id if assigned_user_id is not None else existing_task.assigned_user_id
            )
            update_task(db, task_id=existing_task.id, task_update=update_data, user_id=current_user.id)
            tasks_updated += 1
        else:
            # Create new task
            task_create = schemas.TaskCreate(
                title=task_title,
                description=description,
                status=status_match,
                priority=priority_match,
                due_date=due_date,
                project_id=project.id,
                assigned_user_id=assigned_user_id
            )
            create_task(db, task=task_create, user_id=current_user.id)
            tasks_created += 1

    return {
        "projects_created": projects_created,
        "tasks_created": tasks_created,
        "tasks_updated": tasks_updated,
        "errors": errors
    }
