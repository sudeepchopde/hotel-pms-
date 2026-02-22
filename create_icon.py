from PIL import Image

logo_path = r'c:\Users\PC\Documents\pms\public\logo.png'
icon_path = r'c:\Users\PC\Documents\pms\public\icon.png'

try:
    with Image.open(logo_path) as img:
        # Based on previous analysis, icon is in (0, 0, 152, 201)
        # Let's crop it with a bit of padding if possible, or just the icon
        icon = img.crop((0, 0, 152, 201))
        # Create a square icon for better UI usage
        # Current size is 152x201. Let's make it 201x201 with black background
        square_icon = Image.new('RGB', (201, 201), (0, 0, 0))
        # Paste centered
        offset = (201 - 152) // 2
        square_icon.paste(icon, (offset, 0))
        
        square_icon.save(icon_path, 'PNG')
        print(f"Successfully created localized icon at {icon_path}")
except Exception as e:
    print(f"Error: {e}")
