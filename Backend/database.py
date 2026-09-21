# We are using SQLAlchemy to manage our database interactions.
# This file sets up the connection to our database (SQLite in this case)
# and provides a way to get a "session" which is like a workspace for our database queries.

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# 1. Define the database URL. 
# We are using SQLite, which stores the entire database in a single file called 'app.db'.
# This is great for local development because it requires no external setup.
SQLALCHEMY_DATABASE_URL = "sqlite:///./app.db"

# 2. Create the SQLAlchemy Engine.
# The engine is the starting point for any SQLAlchemy application.
# It manages the connection pool and dialect-specific execution.
# 'check_same_thread': False is specific to SQLite and FastAPI to allow multiple requests
# to use the same connection simultaneously.
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# 3. Create a SessionLocal class.
# Each instance of this class will be a database session.
# 'autocommit=False' means we have to manually call session.commit() to save changes.
# 'autoflush=False' prevents SQLAlchemy from automatically pushing changes to the database before querying.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4. Create a Base class.
# All our database models (which represent tables) will inherit from this class.
# SQLAlchemy will use this class to keep track of all our tables.
Base = declarative_base()

# 5. Dependency injection function for FastAPI.
# This function creates a new database session for every incoming request 
# and closes it once the request is finished. 
# The 'yield' keyword makes it a generator, allowing FastAPI to execute code after the response is sent (the 'finally' block).
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
    2. Ensure the 'owner_id' column exists on the 'projects' table.
    3. Ensure existing project owners are added to 'project_members'.
    """
    from sqlalchemy import text
    Base.metadata.create_all(bind=engine)

    with engine.connect() as connection:
        result = connection.execute(text("PRAGMA table_info(projects)")).fetchall()
        columns = [row[1] for row in result]
        if columns and "owner_id" not in columns:
            connection.execute(text("ALTER TABLE projects ADD COLUMN owner_id INTEGER REFERENCES users(id)"))
            # Backfill existing projects with the first user if available
            connection.execute(text("UPDATE projects SET owner_id = (SELECT id FROM users LIMIT 1) WHERE owner_id IS NULL"))
            connection.commit()

        # Add project owners to project_members table if not already present
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
