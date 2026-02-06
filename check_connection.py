
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

def check_connection():
    print("Loading environment variables...")
    load_dotenv()
    
    url = os.getenv("DATABASE_URL")
    if not url:
        print("❌ Error: DATABASE_URL not found in .env")
        return

    print(f"Checking connection to: {url.split('@')[-1]}")
    
    try:
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
            
        engine = create_engine(url, connect_args={"sslmode": "require"})
        
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version()"))
            version = result.fetchone()[0]
            print("✅ Connection Successful!")
            print(f"Database Version: {version}")
            
            # Check for generic table existence
            result = conn.execute(text("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'"))
            count = result.fetchone()[0]
            print(f"Table count: {count}")

    except Exception as e:
        print(f"❌ Connection Failed: {e}")

if __name__ == "__main__":
    check_connection()
