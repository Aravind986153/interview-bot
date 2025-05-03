#!/usr/bin/env python3
import os
import sys
from pathlib import Path

# Set the Python path
app_dir = str(Path(__file__).parent / "backend" / "app")
if app_dir not in sys.path:
    sys.path.insert(0, app_dir)

from backend.app.main import app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
