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
        print("--- ALL Bookings for Room 101 ---")
        query = text("SELECT id, guest_name, room_number, status, check_in, check_out FROM bookings WHERE room_number = '101' ORDER BY check_in DESC")
        rows = conn.execute(query).fetchall()
        for row in rows:
            print(f"Room 101: {row[1]} ({row[3]}) | {row[4]} to {row[5]} | ID: {row[0]}")
            
        print("\n--- ALL Bookings with 'Kundan' ---")
        query = text("SELECT id, guest_name, room_number, status, check_in, check_out FROM bookings WHERE guest_name ILIKE '%Kundan%' ORDER BY check_in DESC")
        rows = conn.execute(query).fetchall()
        for row in rows:
            print(f"Kundan: {row[2]} ({row[3]}) | {row[4]} to {row[5]} | ID: {row[0]}")

if __name__ == "__main__":
    check()
