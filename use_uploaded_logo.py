from PIL import Image
import os

uploaded_path = r'C:\Users\PC\.gemini\antigravity\brain\0345961b-3b6e-461c-a738-5a3d136119fc\media__1771760481566.png'
target_path = r'c:\Users\PC\Documents\pms\public\logo.png'

try:
    with Image.open(uploaded_path) as img:
        print(f"Uploaded Logo Dimensions: {img.width}x{img.height}")
        # Save it as the main logo
        img.save(target_path, 'PNG')
        print(f"Successfully replaced logo at {target_path}")
except Exception as e:
    print(f"Error: {e}")
