from sqlmodel import SQLModel, Field, create_engine, Session
from datetime import datetime
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Database path
project_root = Path(__file__).resolve().parent.parent.parent
DB_PATH = project_root / "data" / "sessions.db"

class InterviewSession(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_ip: str = Field(index=True)
    topic: str
    score: int
    created_at: datetime = Field(default_factory=datetime.now)

engine = create_engine(f"sqlite:///{DB_PATH}")

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