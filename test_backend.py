import requests
import sys

try:
    print("Testing Backend...")
    r = requests.get("http://127.0.0.1:8000/ping")
    print(f"Ping Status: {r.status_code}")
    print(f"Ping Response: {r.json()}")
    
    if r.status_code == 200:
        print("Backend is HEALTHY.")
    else:
        print("Backend is UNHEALTHY.")
        
except Exception as e:
    print(f"Backend Connection Failed: {e}")
