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
                'rejection_reason': 'VARCHAR',
                'is_settled': 'BOOLEAN DEFAULT FALSE',
                'payments': 'JSON DEFAULT \'[]\''
            }
            for col, col_type in missing_cols.items():
                res = conn.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_name='bookings' AND column_name='{col}'"))
                if not res.fetchone():
                    print(f"Adding {col} column...")
                    conn.execute(text(f"ALTER TABLE bookings ADD COLUMN {col} {col_type}"))
            
            # Create guest_profiles table if it doesn't exist
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS guest_profiles (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR,
                    phone_number VARCHAR,
                    id_type VARCHAR,
                    id_number VARCHAR,
                    address VARCHAR,
                    dob VARCHAR,
                    nationality VARCHAR,
                    preferences VARCHAR,
                    last_check_in VARCHAR
                )
            """))
            # Check for missing guest_profiles columns
            gp_cols = {
                'gender': 'VARCHAR', 
                'email': 'VARCHAR',
                'passport_number': 'VARCHAR',
                'passport_place_issue': 'VARCHAR',
                'passport_issue_date': 'VARCHAR',
                'passport_expiry': 'VARCHAR',
                'visa_number': 'VARCHAR',
                'visa_type': 'VARCHAR',
                'visa_place_issue': 'VARCHAR',
                'visa_issue_date': 'VARCHAR',
                'visa_expiry': 'VARCHAR',
                'arrived_from': 'VARCHAR',
                'arrival_date_india': 'VARCHAR',
                'arrival_port': 'VARCHAR',
                'next_destination': 'VARCHAR',
                'purpose_of_visit': 'VARCHAR',
                'id_image': 'VARCHAR',
                'id_image_back': 'VARCHAR',
                'visa_page': 'VARCHAR',
                'serial_number': 'INTEGER',
                'father_or_husband_name': 'VARCHAR',
                'city': 'VARCHAR',
                'state': 'VARCHAR',
                'pin_code': 'VARCHAR',
                'country': 'VARCHAR',
                'arrival_time': 'VARCHAR',
                'departure_time': 'VARCHAR',
                'signature': 'VARCHAR'
            }
            for col, col_type in gp_cols.items():
                res = conn.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_name='guest_profiles' AND column_name='{col}'"))
                if not res.fetchone():
                    print(f"Adding {col} column to guest_profiles...")
                    conn.execute(text(f"ALTER TABLE guest_profiles ADD COLUMN {col} {col_type}"))

            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_guest_profiles_name ON guest_profiles (name)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_guest_profiles_phone_number ON guest_profiles (phone_number)"))
            
            # Create property_settings table if it doesn't exist
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS property_settings (
                    id VARCHAR PRIMARY KEY,
                    name VARCHAR NOT NULL,
                    address VARCHAR NOT NULL,
                    phone VARCHAR,
                    email VARCHAR,
                    gst_number VARCHAR,
                    gst_rate FLOAT DEFAULT 12.0
                )
            """))

            # Check for property_settings missing columns
            ps_cols = {
                'food_gst_rate': 'FLOAT DEFAULT 5.0',
                'other_gst_rate': 'FLOAT DEFAULT 18.0'
            }
            for col, col_type in ps_cols.items():
                res = conn.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_name='property_settings' AND column_name='{col}'"))
                if not res.fetchone():
                    print(f"Adding {col} column to property_settings...")
                    conn.execute(text(f"ALTER TABLE property_settings ADD COLUMN {col} {col_type}"))

            conn.commit()
            print("Schema updated successfully!")
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate()
