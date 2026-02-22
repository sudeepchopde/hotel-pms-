from PIL import Image

logo_path = r'c:\Users\PC\Documents\pms\public\logo.png'
try:
    with Image.open(logo_path) as img:
        # Get bounding box of the whole image to find where content starts
        bbox = img.getbbox()
        if bbox:
            left, top, right, bottom = bbox
            # The icon is on the left. Let's find the gap between the icon and the text.
            # We look for a vertical column of empty pixels between the icon and the text.
            # Start from 'left' and go right.
            
            icon_right_edge = left
            for x in range(left + 10, img.width):
                # Check if this column is empty
                is_empty = True
                for y in range(top, bottom):
                    if img.getpixel((x, y))[0] > 10: # Assuming close to black
                        is_empty = False
                        break
                if is_empty:
                    # Found a gap! The icon ends roughly here.
                    icon_right_edge = x
                    break
            
            icon_width = icon_right_edge - left
            print(f"Icon bounding box: left={left}, right={icon_right_edge}, width={icon_width}")
            
            # We want to center this icon (width icon_width) in the container.
            # When object-fit: cover is used:
            # Image is scaled s.t. height = container_height (48)
            # Scale = 48 / img_height (201)
            # Scaled icon width = icon_width * Scale
            # To center this scaled icon in a 48px width container:
            # Offset = (48 - ScaledIconWidth) / 2
            # We need to find the percentage P s.t. 
            # (P * scaled_img_width) - (P * container_width) = -Offset  (wait, no)
            
            # Simple way: if we want the pixel at 'x_center' in the original image 
            # to be at '24' in a 48px wide container (after scaling).
            x_center = (left + icon_right_edge) / 2
            # scaled_x_center = x_center * (48 / img.height)
            # we want scaled_x_center - shift = 24 => shift = scaled_x_center - 24
            # object-position P means: shift = P * (scaled_img_width - container_width)
            # P = (scaled_x_center - 24) / (scaled_img_width - 48)
            
            scaled_img_width = img.width * (48 / img.height)
            scaled_x_center = x_center * (48 / img.height)
            
            P = (scaled_x_center - 24) / (scaled_img_width - 48)
            print(f"Calculated optimal object-position: {P * 100}%")
            
        else:
            print("Empty image")
except Exception as e:
    print(f"Error: {e}")
