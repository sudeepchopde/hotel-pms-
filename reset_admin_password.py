"""
Reset the admin user password to admin123.
Run when you cannot log in: python reset_admin_password.py
"""
import os
import sys

# Load env so DATABASE_URL is set
try:
    from dotenv import load_dotenv
    load_dotenv(".env")
    load_dotenv(".env.local", override=True)
except Exception:
    pass

def get_db_url():
    url = (
        os.getenv("DATABASE_URL")
        or os.getenv("POSTGRES_URL")
        or os.getenv("POSTGRES_URL_NON_POOLING")
        or os.getenv("NEON_DATABASE_URL")
        or "sqlite:///./pms.db"
    )
    if url and url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url

def main():
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")
    new_hash = pwd_context.hash("admin123")

    from backend.database import SessionLocal, engine, Base
    from backend.db_models import UserDB

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        admin = db.query(UserDB).filter(UserDB.username == "admin").first()
        if admin:
            admin.password_hash = new_hash
            db.commit()
            print("Password reset successfully. You can now log in with:")
            print("  Username: admin")
            print("  Password: admin123")
        else:
            db.add(UserDB(
                username="admin",
                password_hash=new_hash,
                full_name="Administrator",
                role="admin",
            ))
            db.commit()
            print("Admin user created. Log in with:")
            print("  Username: admin")
            print("  Password: admin123")
    except Exception as e:
        print("Error:", e)
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    main()
