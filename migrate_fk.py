from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv('.env')
url = os.getenv("DATABASE_URL")

if not url:
    print("No DATABASE_URL found")
    exit(1)

engine = create_engine(url)

migration_queries = [
    # 1. Drop existing FK constraint
    "ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_room_type_id_fkey",
    
    # 2. Make the column nullable
    "ALTER TABLE bookings ALTER COLUMN room_type_id DROP NOT NULL",
    
    # 3. Add the FK back with ON DELETE SET NULL
    "ALTER TABLE bookings ADD CONSTRAINT bookings_room_type_id_fkey FOREIGN KEY (room_type_id) REFERENCES room_types(id) ON DELETE SET NULL"
]

with engine.begin() as conn:
    print(f"Connecting to {url.split('@')[-1]}")
    for query in migration_queries:
        print(f"Executing: {query}")
        try:
            conn.execute(text(query))
            print("Successfully executed.")
        except Exception as e:
            print(f"Error executing query: {e}")

print("Migration completed.")
