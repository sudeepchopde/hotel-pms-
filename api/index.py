"""
Vercel Serverless Function Entry Point
This file handles all /api/* routes for Vercel deployment.
"""
import sys
import os

# Add the project root to Python path for imports
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

# Set environment variables before importing the app
from dotenv import load_dotenv
load_dotenv(os.path.join(project_root, '.env'))
load_dotenv(os.path.join(project_root, '.env.local'), override=True)

# Import the FastAPI app
try:
    from main import app
except Exception as e:
    # If main import fails, create a minimal error-reporting app
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
    
    app = FastAPI()
    
    @app.get("/api/{path:path}")
    @app.post("/api/{path:path}")
    @app.put("/api/{path:path}")
    @app.delete("/api/{path:path}")
    async def error_handler(path: str):
        return JSONResponse(
            status_code=500,
            content={
                "error": "Failed to import main app",
                "detail": str(e),
                "path": path
            }
        )

# Vercel expects 'app' to be the ASGI application
# This is automatically detected by @vercel/python
