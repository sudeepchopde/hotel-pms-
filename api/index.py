"""
Vercel Serverless Function Entry Point
This file wraps the FastAPI app for Vercel's serverless environment.
"""
import sys
import os

# Add the parent directory to the path so we can import from backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the FastAPI app from main.py
from main import app

# Vercel expects the app to be exposed as 'app' or 'handler'
# FastAPI apps work directly with Vercel's Python runtime
