import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add current directory to path so we can import our modules
sys.path.append('c:/Users/PC/Documents/pms')

# Avoid hardcoding DATABASE_URL, let main load it from .env or use the one already in env
# os.environ['DATABASE_URL'] = '...' 

from backend.database import SessionLocal
from main import get_bookings, _load_db_imports

def test():
    # Force load DB models in main
    _load_db_imports()
    from main import BookingDB
    
    db = SessionLocal()
    try:
        print("Calling get_bookings()...")
        bookings = get_bookings(db=db)
        print(f"Success! Returned {len(bookings)} bookings.")
    except Exception as e:
        print(f"Error in test: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    test()
