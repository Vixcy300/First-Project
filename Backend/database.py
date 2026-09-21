from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./app.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Safely initialize the database:
    1. Create all missing tables without deleting existing data.
    2. Ensure the 'owner_id' column exists on 'projects'.
    3. Ensure 'priority' and 'due_date' exist on 'tasks'.
    4. Ensure existing project owners are added to 'project_members'.
    """
    from sqlalchemy import text
    import models  # Ensure all models are registered on Base
    Base.metadata.create_all(bind=engine)

    with engine.connect() as connection:
        # 1. Projects owner_id migration
        result = connection.execute(text("PRAGMA table_info(projects)")).fetchall()
        project_columns = [row[1] for row in result]
        if project_columns and "owner_id" not in project_columns:
            connection.execute(text("ALTER TABLE projects ADD COLUMN owner_id INTEGER REFERENCES users(id)"))
            connection.execute(text("UPDATE projects SET owner_id = (SELECT id FROM users LIMIT 1) WHERE owner_id IS NULL"))
            connection.commit()

        # 2. Tasks priority & due_date migration
        task_result = connection.execute(text("PRAGMA table_info(tasks)")).fetchall()
        task_columns = [row[1] for row in task_result]
        if task_columns:
            if "priority" not in task_columns:
                connection.execute(text("ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT 'Medium'"))
                connection.commit()
            if "due_date" not in task_columns:
                connection.execute(text("ALTER TABLE tasks ADD COLUMN due_date TEXT"))
                connection.commit()

        # 3. Add project owners to project_members table if not already present
        try:
            connection.execute(text("""
                INSERT INTO project_members (project_id, user_id, role)
                SELECT id, owner_id, 'owner' FROM projects 
                WHERE owner_id IS NOT NULL
                AND NOT EXISTS (
                    SELECT 1 FROM project_members pm WHERE pm.project_id = projects.id AND pm.user_id = projects.owner_id
                )
            """))
            connection.commit()
        except Exception:
            pass
