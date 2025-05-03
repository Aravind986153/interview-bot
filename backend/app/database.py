from sqlmodel import SQLModel, Field, create_engine, Session
from datetime import datetime
import logging
import os
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

def get_database_url():
    # Local development configuration
    if os.getenv("LOCAL_DEVELOPMENT", "false").lower() == "true":
        return "postgresql://postgres:postgres@localhost:5432/postgres"
    
    # Render production configuration
    url = os.getenv("DATABASE_URL", "")
    
    if not url:
        raise ValueError("DATABASE_URL environment variable not set")
    
    # Fix connection string format if needed
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    
    # For Render's specific connection string
    if "dpg-d0apg9h5pdvs73c121jg-a" in url:
        url = url.replace("-a.", "-a:5432/")
    
    return url

# Create engine with connection pooling
engine = create_engine(
    get_database_url(),
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=300
)

class InterviewSession(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_ip: str = Field(index=True)
    topic: str
    score: int
    created_at: datetime = Field(default_factory=datetime.now)

def save_session(ip: str, topic: str, score: int):
    try:
        with Session(engine) as session:
            session.add(InterviewSession(
                user_ip=ip,
                topic=topic,
                score=score
            ))
            session.commit()
    except Exception as e:
        logger.error(f"Database error: {str(e)}", exc_info=True)
        raise

def create_db():
    SQLModel.metadata.create_all(engine)