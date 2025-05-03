import websockets
import asyncio

async def test_connection():
    try:
        async with websockets.connect('ws://localhost:8000/ws') as ws:
            print("Successfully connected!")
            
            # Send a test message
            await ws.send("python")
            print("Sent topic: python")
            
            # Get first response
            response = await ws.recv()
            print(f"Received: {response}")
            
            # Send a sample answer
            await ws.send("Python's GIL is a global interpreter lock")
            print("Sent answer")
            
            # Get evaluation
            evaluation = await ws.recv()
            print(f"Evaluation: {evaluation}")
            
    except Exception as e:
        print(f"Connection failed: {str(e)}")

asyncio.run(test_connection())
