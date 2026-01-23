import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv('.env.local')
api_key = os.getenv("VITE_GEMINI_API_KEY")

if not api_key:
    print("No API Key found")
    exit(1)

genai.configure(api_key=api_key)

models_to_test = [
    'gemini-2.0-flash-exp', 
    'gemini-2.0-flash',
    'gemini-2.0-flash-001',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro',
    'gemini-pro',
    'gemini-flash-latest'
]

print(f"Testing {len(models_to_test)} models with key: {api_key[:10]}...")

for m in models_to_test:
    print(f"Testing {m}...", end=" ")
    try:
        model = genai.GenerativeModel(m)
        response = model.generate_content("Hello")
        print(f"SUCCESS")
    except Exception as e:
        print(f"FAILED: {e}")
