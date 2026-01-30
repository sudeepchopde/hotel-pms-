from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Try to load dotenv but don't fail if files don't exist (e.g., on Vercel)
try:
    from dotenv import load_dotenv
    load_dotenv('.env')
    load_dotenv('.env.local', override=True)
except:
    pass

# Get DATABASE_URL from environment variable
# Vercel's Neon integration may use different variable names
DATABASE_URL = (
    os.getenv("POSTGRES_URL") or 
    os.getenv("POSTGRES_PRISMA_URL") or 
    os.getenv("POSTGRES_URL_NON_POOLING") or
    os.getenv("DATABASE_URL") or 
    "postgresql://postgres:postgres@localhost:5432/hotel_pms"
)

# Fix Neon's postgres:// URL format to postgresql:// for SQLAlchemy
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Neon PostgreSQL requires SSL and works best with specific pool settings for serverless
engine_args = {
    "pool_pre_ping": True,  # Verify connections before use (important for serverless)
    "pool_recycle": 300,    # Recycle connections every 5 minutes
}

# Add SSL arguments if connecting to Neon (cloud database)
if "neon.tech" in DATABASE_URL:
    engine_args["connect_args"] = {"sslmode": "require"}

engine = create_engine(DATABASE_URL, **engine_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """Dependency for FastAPI endpoints to get a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
