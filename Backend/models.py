# This file defines our database schema using SQLAlchemy ORM (Object Relational Mapper).
# Each class here represents a table in the database, and attributes represent columns.

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    # The __tablename__ attribute tells SQLAlchemy the actual name of the table in the database.
    __tablename__ = "users"

    # Define columns with their data types.
    # primary_key=True makes this column the unique identifier for the row.
    # index=True makes queries searching by this column faster.
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String, nullable=True)
    
    # Establish a relationship with the Task model.
    # This means a User can have multiple tasks assigned to them.
    # The 'back_populates' argument links this relationship back to the 'assignee' attribute in the Task model.
    # Establish relationships
    # 1. Tasks assigned to this user
    tasks = relationship("Task", back_populates="assignee")
    # 2. Projects owned by this user
    owned_projects = relationship("Project", back_populates="owner", foreign_keys="Project.owner_id")
    # 3. Project memberships (projects where this user is a member)
    project_memberships = relationship("ProjectMember", back_populates="user")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(Text, nullable=True) # nullable=True means this field is optional
    description = Column(Text, nullable=True)
    
    # Week 3: Project owner (the user who created the project)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    owner = relationship("User", back_populates="owned_projects", foreign_keys=[owner_id])
    
    # Week 3: Members of this project (including the owner and invited team members)
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    
    # A project can have many tasks.
    tasks = relationship("Task", back_populates="project")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")


class ProjectMember(Base):
    """
    Week 3: Project Membership Model
    Links a User to a Project, indicating they are part of the project team.
    Role can be 'owner' or 'member'.
    """
    __tablename__ = "project_members"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String, default="member")  # e.g., 'owner', 'member'

    # Relationships
    project = relationship("Project", back_populates="members")
    user = relationship("User", back_populates="project_memberships")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(Text, nullable=True)
    status = Column(String, default="To Do") # Default status when a task is created
    
    # Foreign keys link this task to a specific project and a specific user.
    project_id = Column(Integer, ForeignKey("projects.id"))
    assigned_user_id = Column(Integer, ForeignKey("users.id"), nullable=True) # A task might not be assigned immediately
    # Foreign keys link this task to a specific project and an assigned user.
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    # Week 3 Rule: assigned_user_id must belong to a member of this project
    assigned_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # These relationships allow us to easily access the related Project or User object 
    # directly from a Task instance (e.g., task.project.title).
    # Relationships
    project = relationship("Project", back_populates="tasks")
    assignee = relationship("User", back_populates="tasks")
