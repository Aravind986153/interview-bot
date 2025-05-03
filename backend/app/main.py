from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from database import create_db  # Changed from database
from interview_logic import InterviewBot  # Changed if it was relative
import logging
import os
from dotenv import load_dotenv
import asyncio

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

app = FastAPI()

# Initialize database on startup
@app.on_event("startup")
def startup_event():
    try:
        create_db()
        logger.info("PostgreSQL database initialized")
    except Exception as e:
        logger.error(f"Database init failed: {e}")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket connection established")
    bot = None
    try:
        bot = InterviewBot()
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                response = await bot.generate_response(data)
                await websocket.send_text(response)
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "ping"})
                continue
            except WebSocketDisconnect:
                logger.info("Client disconnected")
                break
    except Exception as e:
        logger.error(f"Error: {e}")
    finally:
        if bot:
            await bot.close()

@app.get("/")
async def root():
    return RedirectResponse(url=os.getenv("FRONTEND_URL", "https://interview-cbot.netlify.app"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)