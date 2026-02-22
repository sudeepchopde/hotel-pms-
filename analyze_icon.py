from PIL import Image

logo_path = r'c:\Users\PC\Documents\pms\public\logo.png'
try:
    with Image.open(logo_path) as img:
        # Convert to RGBA to handle transparency if any, or just RGB
        img = img.convert('RGB')
        # Find the first non-black pixel
        bbox = img.getbbox()
        if bbox:
            print(f"Full Content BBox: {bbox}")
            # The icon is the first cluster. Let's find where it ends.
            # Usually there's a gap of black pixels between the icon and the text.
            left, top, right, bottom = bbox
            
            # Find the vertical gap
            icon_right = left
            for x in range(left, img.width):
                has_content = False
                for y in range(top, bottom):
                    if sum(img.getpixel((x,y))) > 30: # more than almost black
                        has_content = True
                        break
                if not has_content and x > left + 20: # found a gap
                    icon_right = x
                    break
                if has_content:
                    icon_right = x
            
            print(f"Icon BBox (Estimated): ({left}, {top}, {icon_right}, {bottom})")
            
            # Now let's calculate centering for a 48x48 container with object-fit: cover
            # height is scaled to 48
            scale = 48 / img.height
            scaled_width = img.width * scale
            scaled_icon_left = left * scale
            scaled_icon_right = icon_right * scale
            scaled_icon_center = (scaled_icon_left + scaled_icon_right) / 2
            
            # We want scaled_icon_center to be at 24 (center of 48px box)
            # Position = scaled_icon_center - 24
            # If Position is positive, we shift the image left by 'Position' pixels.
            # In object-position: P%, P = (shift) / (scaled_width - container_width) * 100
            # Wait, object-position: Xpx means the left edge is at Xpx.
            # So we want left_edge = 24 - scaled_icon_center
            
            shift_px = 24 - scaled_icon_center
            print(f"To center icon, set object-position: {shift_px}px center")
            
        else:
            print("Image is empty")
except Exception as e:
    print(f"Error: {e}")
