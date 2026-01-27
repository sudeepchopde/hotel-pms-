
import os
import psycopg2
from dotenv import load_dotenv
import sys

def migrate(env_file):
    print(f"Migrating with {env_file}...")
    load_dotenv(env_file, override=True)
    url = os.getenv("DATABASE_URL")
    if not url:
        print(f"DATABASE_URL not found in {env_file}")
        return

    try:
        conn = psycopg2.connect(url)
        conn.autocommit = True
        cur = conn.cursor()
        
        print(f"Connecting to DB: {url.split('@')[-1]}")
        print("Checking for loyalty_tiers column in property_settings...")
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='property_settings' AND column_name='loyalty_tiers';")
        if not cur.fetchone():
            print("Adding loyalty_tiers column...")
            cur.execute("ALTER TABLE property_settings ADD COLUMN loyalty_tiers JSONB DEFAULT '[]'::jsonb;")
            print("Done.")
        else:
            print("Column already exists.")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Migration failed for {env_file}: {e}")

if __name__ == "__main__":
    if os.path.exists(".env.local"):
        migrate(".env.local")
    if os.path.exists(".env"):
        migrate(".env")
