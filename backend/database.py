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
POSTGRES_URL = os.getenv("POSTGRES_URL")
POSTGRES_PRISMA_URL = os.getenv("POSTGRES_PRISMA_URL")
DATABASE_URL_ENV = os.getenv("DATABASE_URL")
NEON_DATABASE_URL = os.getenv("NEON_DATABASE_URL")

DATABASE_URL = (
    POSTGRES_URL or 
    POSTGRES_PRISMA_URL or 
    os.getenv("POSTGRES_URL_NON_POOLING") or
    DATABASE_URL_ENV or 
    NEON_DATABASE_URL or
    "sqlite:///./pms.db"
)

print(f"DEBUG: Selected Database Source: {'POSTGRES_URL' if POSTGRES_URL else 'Other'}")
if POSTGRES_PRISMA_URL: print("DEBUG: POSTGRES_PRISMA_URL is set")
if DATABASE_URL_ENV: print("DEBUG: DATABASE_URL is set")
if NEON_DATABASE_URL: print("DEBUG: NEON_DATABASE_URL is set")

# Fix Neon's postgres:// URL format to postgresql:// for SQLAlchemy
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Strict pool settings to avoid exceeding connection limits on free tiers
engine_args = {
    "pool_pre_ping": True,
    "pool_recycle": 360,
    "pool_size": 3,
    "max_overflow": 0,
}

# Add SSL arguments if connecting to Neon (cloud database)
if "neon.tech" in DATABASE_URL:
    engine_args["connect_args"] = {"sslmode": "require"}
elif DATABASE_URL.startswith("sqlite"):
    engine_args["connect_args"] = {"check_same_thread": False}

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
