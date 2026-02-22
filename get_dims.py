from PIL import Image
try:
    with Image.open('c:/Users/PC/Documents/pms/public/logo.png') as img:
        print(f"Width: {img.width}, Height: {img.height}")
except Exception as e:
    print(f"Error: {e}")
