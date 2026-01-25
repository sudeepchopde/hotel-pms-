"""
Vercel Serverless Function Entry Point
Minimal version to test Vercel Python runtime
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import sys

# Create a minimal app first
app = FastAPI(title="SyncGuard PMS API")

# Add CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/ping")
def ping():
    return {"status": "ok", "version": "1.2", "runtime": "vercel-minimal"}

@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "python_version": sys.version,
        "env_database_url": "set" if os.getenv("DATABASE_URL") else "not set"
    }

# Try to import the full app, but catch errors gracefully
_full_app_loaded = False
_import_error = None

try:
    # Add project root to path
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if project_root not in sys.path:
        sys.path.insert(0, project_root)
    
    # Try to import the main app's routes
    from main import app as main_app
    
    # Copy routes from main_app to our app
    for route in main_app.routes:
        if hasattr(route, 'path') and route.path not in ['/api/ping', '/api/health']:
            app.routes.append(route)
    
    _full_app_loaded = True
    
except Exception as e:
    _import_error = str(e)
    
    # Add error reporting endpoint
    @app.get("/api/debug")
    def debug_error():
        return {
            "full_app_loaded": _full_app_loaded,
            "import_error": _import_error,
            "python_path": sys.path[:5],  # First 5 entries
            "cwd": os.getcwd(),
            "files_in_root": os.listdir(project_root) if os.path.exists(project_root) else "not found"
        }

# Always add debug endpoint
@app.get("/api/status")
def status():
    return {
        "full_app_loaded": _full_app_loaded,
        "import_error": _import_error
    }
