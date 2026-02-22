from PIL import Image

logo_path = r'c:\Users\PC\Documents\pms\public\logo.png'
try:
    with Image.open(logo_path) as img:
        bbox = img.getbbox()
        if bbox:
            left, top, right, bottom = bbox
            # The icon is on the left. Let's find the horizontal center of the non-black content block that is 'the icon'
            # Usually the icon is separated by some space from the text.
            # But let's just find the center of the first 25% of the image which should be the icon.
            icon_region = img.crop((0, 0, img.width // 2, img.height))
            icon_bbox = icon_region.getbbox()
            if icon_bbox:
                i_left, i_top, i_right, i_bottom = icon_bbox
                icon_center_x = (i_left + i_right) / 2
                percent_x = (icon_center_x / img.width) * 100
                print(f"Icon center percent: {percent_x}%")
            else:
                print("No icon found in left half")
        else:
            print("Empty image")
except Exception as e:
    print(f"Error: {e}")
