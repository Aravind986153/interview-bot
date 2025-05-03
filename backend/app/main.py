import os
import sys
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse
from interview_logic import InterviewBot
from database import create_db
import logging
from dotenv import load_dotenv
import asyncio

# Set up Python path
app_dir = str(Path(__file__).parent.resolve())
if app_dir not in sys.path:
    sys.path.insert(0, app_dir)

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    try:
        create_db()
        logger.info("PostgreSQL database initialized")
    except Exception as e:
        logger.error(f"Database init failed: {e}")

# Root endpoint
@app.get("/", response_class=HTMLResponse)
async def root():
    return """
    <html>
        <head><title>Interview Bot API</title></head>
        <body>
            <h1>Interview Bot API</h1>
            <p>WebSocket endpoint: <code>/ws</code></p>
            <p>Frontend: <a href="https://interview-cbot.netlify.app">interview-cbot.netlify.app</a></p>
        </body>
    </html>
    """

# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        await websocket.close(code=1008, reason="Server missing API configuration")
        return
    await websocket.accept()
    logger.info("WebSocket connection established")
    bot = None
    try:
        bot = InterviewBot()
        while True:
            try:
                data = await websocket.receive_text()
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
