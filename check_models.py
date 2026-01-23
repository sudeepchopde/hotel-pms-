import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv('.env.local')
api_key = os.getenv("VITE_GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY")

if not api_key:
    print("No API Key found")
    exit(1)

genai.configure(api_key=api_key)

print(f"Using key: {api_key[:10]}...")

try:
    print("Listing models...")
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(m.name)
except Exception as e:
    print(f"Error: {e}")
