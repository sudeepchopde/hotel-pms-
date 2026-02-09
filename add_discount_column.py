import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env')

url = os.getenv('DATABASE_URL')
print(f"Connecting to: {url.split('@')[-1] if url else 'No URL'}")

try:
    conn = psycopg2.connect(url)
    conn.autocommit = True
    cur = conn.cursor()
    
    # Check if discount column exists
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='bookings' AND column_name='discount';")
    result = cur.fetchone()
    
    if result:
        print("Discount column already exists!")
    else:
        print("Adding discount column...")
        cur.execute("ALTER TABLE bookings ADD COLUMN discount JSONB DEFAULT NULL;")
        print("Done!")
    
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
