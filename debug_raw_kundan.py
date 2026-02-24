import os
import json
import decimal
from sqlalchemy import create_engine, text

def decimal_default(obj):
    if isinstance(obj, decimal.Decimal):
        return float(obj)
    raise TypeError

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
        print("--- RAW Bookings for Kundan ---")
        query = text("SELECT * FROM bookings WHERE guest_name ILIKE '%Kundan%'")
        rows = conn.execute(query).fetchall()
        # Get column names
        keys = conn.execute(text("SELECT * FROM bookings LIMIT 0")).keys()
        
        for row in rows:
            d = dict(zip(keys, row))
            # Process complexity (like JSON fields)
            for k, v in d.items():
                if isinstance(v, str) and (v.startswith('{') or v.startswith('[')):
                    try: d[k] = json.loads(v)
                    except: pass
            print(json.dumps(d, default=str, indent=2))

if __name__ == "__main__":
    check()
