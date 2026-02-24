import os
import json
from sqlalchemy import create_engine, text

def check():
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        try:
            with open('.env', 'r') as f:
                for line in f:
                    if line.startswith('DATABASE_URL='):
                        db_url = line.split('=', 1)[1].strip()
                        break
        except:
            pass
            
    if not db_url:
        print("No DATABASE_URL")
        return
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    
    engine = create_engine(db_url)
    with engine.connect() as conn:
        print("--- Bookings for Room 101 or Kundan ---")
        query = text("SELECT id, guest_name, room_number, status, check_in, check_out FROM bookings WHERE guest_name ILIKE '%Kundan%' OR room_number = '101' ORDER BY check_in DESC")
        rows = conn.execute(query).fetchall()
        for row in rows:
            print(json.dumps({
                "id": str(row[0]),
                "name": str(row[1]),
                "room": str(row[2]),
                "status": str(row[3]),
                "check_in": str(row[4]),
                "check_out": str(row[5])
            }))

if __name__ == "__main__":
    check()
