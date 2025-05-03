from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
import uvicorn
import logging

app = FastAPI()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"Server received: {data}")
    except WebSocketDisconnect:
        logging.info("Client disconnected")

@app.get("/")
async def root():
    return HTMLResponse("""
    <html>
        <head><title>WebSocket Test</title></head>
        <body>
            <h1>WebSocket Endpoint</h1>
            <p>Connect to: <code>wss://your-service.onrender.com/ws</code></p>
        </body>
    </html>
    """)

if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        ws="websockets",
        ws_ping_interval=20,
        ws_ping_timeout=20
    )
