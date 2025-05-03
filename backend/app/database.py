from sqlmodel import SQLModel, Field, create_engine, Session
from datetime import datetime
import logging
import os

logger = logging.getLogger(__name__)

# PostgreSQL configuration
def get_database_url():
    # Get from environment (Render provides this)
    url = os.getenv("DATABASE_URL")
    if not url:
        raise ValueError("DATABASE_URL environment variable not set")
    
    # Fix for Render's connection string
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url

# Create engine
engine = create_engine(get_database_url())

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