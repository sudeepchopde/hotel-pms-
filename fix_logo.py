from PIL import Image
import os

gen_path = r'C:\Users\PC\.gemini\antigravity\brain\0345961b-3b6e-461c-a738-5a3d136119fc\hotel_sathi_logo_wide_premium_v2_1771752636440.png'
target_path = r'c:\Users\PC\Documents\pms\public\logo.png'
backup_path = r'c:\Users\PC\Documents\pms\public\logo_old.png'

try:
    # Backup original
    if os.path.exists(target_path) and not os.path.exists(backup_path):
        os.rename(target_path, backup_path)
    
    with Image.open(gen_path) as img:
        # Original target dimensions: 627x217
        target_w = 627
        target_h = 217
        
        # Current image is square (e.g. 1024x1024)
        # We want to crop a rectangle out of the center that contains the logo
        # The logo occupies a horizontal strip.
        
        # Let's find the bounding box of non-black pixels to be precise
        bbox = img.getbbox()
        if bbox:
            # Expand bbox slightly for breathing room
            left, top, right, bottom = bbox
            content_w = right - left
            content_h = bottom - top
            
            # Goal is to center this content in a 627x217 area
            # Scale the content to fit nicely in 217 height?
            scale = (target_h * 0.8) / content_h
            new_w = int(content_w * scale)
            new_h = int(content_h * scale)
            
            content_resized = img.crop(bbox).resize((new_w, new_h), Image.LANCZOS)
            
            # Create new black image
            final_img = Image.new('RGB', (target_w, target_h), (0, 0, 0))
            
            # Paste resized content centered
            paste_x = (target_w - new_w) // 2
            paste_y = (target_h - new_h) // 2
            final_img.paste(content_resized, (paste_x, paste_y))
            
            final_img.save(target_path, 'PNG')
            print(f"Successfully processed and replaced logo at {target_path}")
        else:
            print("Error: Could not find content in generated image")

except Exception as e:
    print(f"Error: {e}")
