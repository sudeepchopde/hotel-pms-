from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# Load environment variables from .env files
# Priority: .env.local (for local dev) > .env (for production)
load_dotenv('.env')  # Load base .env first
load_dotenv('.env.local', override=True)  # Override with .env.local if exists

# Get DATABASE_URL from environment variable
# Vercel's Neon integration may use different variable names
DATABASE_URL = (
    os.getenv("POSTGRES_URL") or 
    os.getenv("POSTGRES_PRISMA_URL") or 
    os.getenv("POSTGRES_URL_NON_POOLING") or
    os.getenv("DATABASE_URL") or 
    "postgresql://postgres:postgres@localhost:5432/hotel_pms"
)

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
