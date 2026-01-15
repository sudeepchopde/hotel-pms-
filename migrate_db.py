import sys
import os
from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.database import engine

def migrate():
    print("Migrating database schema...")
    try:
        with engine.connect() as conn:
            # Check if reservation_id exists
            result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='bookings' AND column_name='reservation_id'"))
            if not result.fetchone():
                print("Adding reservation_id column to bookings table...")
                conn.execute(text("ALTER TABLE bookings ADD COLUMN reservation_id VARCHAR"))
            
            # Check for other missing columns
            missing_cols = {
                'accessory_guests': 'JSON',
                'channel_sync': 'JSON',
                'rejection_reason': 'VARCHAR'
            }
            for col, col_type in missing_cols.items():
                res = conn.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_name='bookings' AND column_name='{col}'"))
                if not res.fetchone():
                    print(f"Adding {col} column...")
                    conn.execute(text(f"ALTER TABLE bookings ADD COLUMN {col} {col_type}"))
            
            conn.commit()
            print("Schema updated successfully!")
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate()
