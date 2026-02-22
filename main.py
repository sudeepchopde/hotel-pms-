from fastapi import FastAPI, HTTPException, Depends, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import time
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from fpdf import FPDF
from collections import defaultdict
import json
import re
import uuid
import logging
from sqlalchemy.exc import IntegrityError
try:
    from dotenv import load_dotenv
    load_dotenv('.env')
    load_dotenv('.env.local', override=True)
except:
    pass


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("hotel-pms")

def normalize_phone(phone: str) -> str:
    """Normalize phone number by removing all non-digit characters."""
    if not phone:
        return ""
    return re.sub(r'\D', '', phone)

# Declare these at module level for DB models (still lazy)
HotelDB = None
RoomTypeDB = None
BookingDB = None
OTAConnectionDB = None
RateRulesDB = None
GuestProfileDB = None
PropertySettingsDB = None
NotificationDB = None
RoomStatusDB = None

# ========== LAZY LOADING FLAGS ==========
_db_imports_loaded = False
_USE_DATABASE = None
_db_connection_error = None

def get_db_url():
    """Robustly get the database URL from environment variables."""
    import os
    url = (
        os.getenv("DATABASE_URL") or 
        os.getenv("POSTGRES_URL") or 
        os.getenv("POSTGRES_URL_NON_POOLING") or
        os.getenv("NEON_DATABASE_URL") or
        "sqlite:///./pms.db"
    )
    # Normalize for SQLAlchemy if needed, but psycopg2 is usually fine with either
    if url and url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url

# Ensure get_db_url() correctly returns the database URL
_current_url = get_db_url()
# DO NOT set os.environ["DATABASE_URL"] here to a default, 
# as it might override the actual env vars in other modules.

# Import Pydantic models at top level for FastAPI type validation
from backend.models import (
    Hotel, 
    RoomType, 
    Booking, 
    OTAConnection, 
    RateRulesConfig, 
    RoomTransferRequest, 
    GuestProfile, 
    PropertySettings,
    OCRRequest,
    RazorpayOrderRequest,
    RazorpayVerifyRequest,
    InboundEmail,
    Notification,
    Notification,
    NotificationCreate,
    NotificationCreate,
    FolioItem,
    RoomStatus,
    UserLogin,
    UserCreate,
    UserUpdate,
    UserResponse,
)
from passlib.context import CryptContext

# Auth Security
pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

from backend.encryption import encrypt_field, decrypt_field, mask_secret

get_db_real = None
engine = None

def _load_db_imports():
    """Lazy load database imports to avoid import-time failures on Vercel."""
    global _db_imports_loaded, _USE_DATABASE, _db_connection_error
    global HotelDB, RoomTypeDB, BookingDB, OTAConnectionDB, RateRulesDB, GuestProfileDB, PropertySettingsDB, NotificationDB, RoomStatusDB, UserDB
    global Hotel, RoomType, Booking, OTAConnection, RateRulesConfig, RoomTransferRequest, GuestProfile, PropertySettings, RoomStatus, UserResponse
    global get_db_real, engine, SessionLocal
    
    if _db_imports_loaded and _USE_DATABASE:
        return True
    
    try:
        from backend.database import get_db as _get_db_real, engine as _engine, SessionLocal as _SessionLocal
        from backend.db_models import (
            HotelDB as _HotelDB, 
            RoomTypeDB as _RoomTypeDB, 
            BookingDB as _BookingDB, 
            OTAConnectionDB as _OTAConnectionDB, 
            RateRulesDB as _RateRulesDB, 
            GuestProfileDB as _GuestProfileDB, 
            PropertySettingsDB as _PropertySettingsDB,
            NotificationDB as _NotificationDB,
            RoomStatusDB as _RoomStatusDB,
            UserDB as _UserDB
        )
        
        # Assign to globals
        get_db_real = _get_db_real
        engine = _engine
        SessionLocal = _SessionLocal
        HotelDB = _HotelDB
        RoomTypeDB = _RoomTypeDB
        BookingDB = _BookingDB
        OTAConnectionDB = _OTAConnectionDB
        RateRulesDB = _RateRulesDB
        GuestProfileDB = _GuestProfileDB
        PropertySettingsDB = _PropertySettingsDB
        NotificationDB = _NotificationDB
        RoomStatusDB = _RoomStatusDB
        UserDB = _UserDB
        
        # Test connection and create tables if they don't exist
        # Ensure tables exist
        from backend.database import Base
        Base.metadata.create_all(bind=engine)
        
        _USE_DATABASE = True
        print("[OK] Connected to PostgreSQL database")
        
        # Create default admin if not exists
        try:
            db = _SessionLocal()
            admin = db.query(_UserDB).filter(_UserDB.username == "admin").first()
            if not admin:
                from main import get_password_hash
                db.add(_UserDB(
                    username="admin",
                    password_hash=get_password_hash("admin123"),
                    full_name="Administrator",
                    role="admin"
                ))
                db.commit()
                print("[OK] Default admin created")
            db.close()
        except Exception as e:
            print(f"[WARN] Could not create default admin: {e}")
        
    except Exception as e:
        _USE_DATABASE = False
        _db_connection_error = str(e)
        print(f"WARNING: Database unavailable, using in-memory data: {e}")
    
    _db_imports_loaded = True
    return _USE_DATABASE

def USE_DATABASE():
    """Property-like function to check if database is available."""
    _load_db_imports()
    return _USE_DATABASE

def get_db():
    """Database session dependency - loads imports on first call."""
    _load_db_imports()
    if _USE_DATABASE and get_db_real:
        yield from get_db_real()
    else:
        yield None

app = FastAPI(title="Hotel Sathi API")

# Mount Billing folder for PDF access
try:
    os.makedirs("Billing", exist_ok=True)
    app.mount("/billing", StaticFiles(directory="Billing"), name="billing")
except Exception:
    pass

# Mount Frontend Assets (Vite build output)
try:
    if os.path.exists("dist"):
        app.mount("/assets", StaticFiles(directory="dist/assets"), name="assets")
        print("[OK] Frontend assets mounted")
except Exception as e:
    print(f"[WARN] Could not mount assets: {e}")

# Include Channel Manager routes for OTA integrations
try:
    from backend.channel_manager.routes import router as channel_router
    app.include_router(channel_router)
    print("[OK] Channel Manager routes loaded")
except Exception as e:
    print(f"[WARN] Channel Manager routes not loaded: {e}")

# Include Payment Gateway routes
try:
    from backend.payment_gateway.routes import router as payment_router
    app.include_router(payment_router)
    print("[OK] Payment Gateway routes loaded")
except Exception as e:
    print(f"[WARN] Payment Gateway routes not loaded: {e}")


@app.on_event("startup")
async def startup_db():
    """Eagerly initialize DB at startup so errors are visible immediately."""
    import traceback
    print("=== STARTUP: Initializing database connection ===")
    try:
        result = _load_db_imports()
        if result:
            print(f"=== STARTUP: [OK] Database ready (USE_DATABASE={_USE_DATABASE}) ===")
        else:
            print(f"=== STARTUP: [FAIL] Database FAILED. Error: {_db_connection_error} ===")
    except Exception as e:
        print(f"=== STARTUP: [FAIL] Exception in _load_db_imports: {e} ===")
        traceback.print_exc()
    
    # Debug: List all registered routes
    print("=== REGISTERED ROUTES ===")
    for route in app.routes:
        if hasattr(route, 'path'):
            print(f"Route: {route.path} -> {route.methods if hasattr(route, 'methods') else ''}")
    print("=========================")

@app.get("/ping")
def ping():
    return {"status": "ok", "version": "1.1", "database": "lazy"}


@app.post("/api/login", response_model=UserResponse)
def login(user: UserLogin, db=Depends(get_db)):
    if not (USE_DATABASE() and db):
        # Fallback for demo/no-db mode
        if user.username == "admin" and user.password == "admin123":
             return UserResponse(
                id=1, username="admin", full_name="System Admin", 
                role="admin", allowed_sections=[]
             )
        raise HTTPException(status_code=503, detail="Database not available")
        
    try:
        db_user = db.query(UserDB).filter(UserDB.username == user.username).first()
        
        if not db_user:
             if user.username == "admin" and user.password == "admin123":
                 return UserResponse(
                    id=1, username="admin", full_name="System Admin", 
                    role="admin", allowed_sections=[]
                 )
             raise HTTPException(status_code=401, detail="Incorrect username or password")
             
        if not verify_password(user.password, db_user.password_hash):
             # Allow admin fallback if hash verification fails (e.g. dummy hash or reset)
             if db_user.username == "admin" and user.password == "admin123":
                 pass
             else:
                 raise HTTPException(status_code=401, detail="Incorrect username or password")
        
        # Parse allowed_sections
        allowed_sections = db_user.allowed_sections
        if isinstance(allowed_sections, str):
            try:
                allowed_sections = json.loads(allowed_sections)
            except:
                allowed_sections = []
        elif allowed_sections is None:
            allowed_sections = []
            
        return UserResponse(
            id=db_user.id, 
            username=db_user.username, 
            full_name=db_user.full_name or "", 
            role=db_user.role, 
            allowed_sections=allowed_sections
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/users", response_model=UserResponse)
def create_user(user: UserCreate, db=Depends(get_db)):
    if not (USE_DATABASE() and db):
        raise HTTPException(status_code=503, detail="Database not available")
        
    try:
        # Check if username exists
        existing = db.query(UserDB).filter(UserDB.username == user.username).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already registered")
            
        hashed_password = get_password_hash(user.password)
        
        new_user = UserDB(
            username=user.username,
            password_hash=hashed_password,
            full_name=user.full_name,
            role=user.role,
            allowed_sections=user.allowed_sections
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        return UserResponse(
            id=new_user.id,
            username=new_user.username,
            full_name=new_user.full_name,
            role=new_user.role,
            allowed_sections=new_user.allowed_sections
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Create User error: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/users")
def list_users(db=Depends(get_db)):
    if not (USE_DATABASE() and db):
        return []
    try:
        users_db = db.query(UserDB).all()
        
        result = []
        for u in users_db:
            sections = u.allowed_sections
            # Handle JSON if stored as string
            if isinstance(sections, str):
                try: sections = json.loads(sections)
                except: sections = []
            elif sections is None:
                sections = []
                
            result.append({
                "id": u.id,
                "username": u.username,
                "full_name": u.full_name or "",
                "role": u.role,
                "allowed_sections": sections
            })
        return result
    except Exception as e:
        print(f"List users error: {e}")
        return []

@app.put("/api/users/{user_id}", response_model=UserResponse)
def update_user(user_id: int, user: UserUpdate, db=Depends(get_db)):
    if not (USE_DATABASE() and db):
        raise HTTPException(status_code=503, detail="Database not available")
        
    try:
        db_user = db.query(UserDB).filter(UserDB.id == user_id).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
            
        if user.username is not None:
            # Check if username exists for other users
            existing = db.query(UserDB).filter(UserDB.username == user.username, UserDB.id != user_id).first()
            if existing:
                raise HTTPException(status_code=400, detail="Username already registered")
            db_user.username = user.username
            
        if user.password is not None:
            db_user.password_hash = get_password_hash(user.password)
            
        if user.full_name is not None:
            db_user.full_name = user.full_name
            
        if user.role is not None:
            db_user.role = user.role
            
        if user.allowed_sections is not None:
            db_user.allowed_sections = user.allowed_sections
            
        db.commit()
        db.refresh(db_user)
        
        sections = db_user.allowed_sections
        if isinstance(sections, str):
            try: sections = json.loads(sections)
            except: sections = []
        elif sections is None:
            sections = []
            
        return UserResponse(
            id=db_user.id,
            username=db_user.username,
            full_name=db_user.full_name or "",
            role=db_user.role,
            allowed_sections=sections
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Update User error: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/users/{user_id}")
def delete_user(user_id: int, db=Depends(get_db)):
    if not (USE_DATABASE() and db):
        raise HTTPException(status_code=503, detail="Database not available")
        
    try:
        if user_id == 1:
            raise HTTPException(status_code=400, detail="Cannot delete admin")
            
        db_user = db.query(UserDB).filter(UserDB.id == user_id).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
             
        if db_user.username == 'admin':
             raise HTTPException(status_code=400, detail="Cannot delete admin user")
             
        db.delete(db_user)
        db.commit()
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Delete user error: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/init-db")
def init_db():
    """Manual trigger to ensure all tables exist - includes all models"""
    _load_db_imports()
    
    if not engine:
        return {
            "status": "error", 
            "message": "Database engine not initialized"
        }
    
    try:
        from backend.database import Base
        # Explicitly ensure all models are imported so Base knows about them
        from backend.db_models import (
            HotelDB, RoomTypeDB, BookingDB, OTAConnectionDB, 
            RateRulesDB, GuestProfileDB, PropertySettingsDB, NotificationDB,
            UserDB
        )
        
        Base.metadata.create_all(bind=engine)
        
        return {
            "status": "success", 
            "message": "All database tables initialized successfully"
        }
    except Exception as e:
        import traceback
        return {
            "status": "error", 
            "message": str(e),
            "traceback": traceback.format_exc()
        }

@app.get("/api/test-notification")
def test_notification(db=Depends(get_db)):
    """Create a test notification to verify the system works"""
    if not (USE_DATABASE() and db):
        return {"status": "error", "message": "Database not connected"}
    
    try:
        notif_id = f"test-{str(uuid.uuid4())[:8]}"
        now = datetime.now(timezone.utc).isoformat()
        
        notif = NotificationDB(
            id=notif_id,
            type="system",
            category="test",
            title="Test Notification",
            message=f"This is a test notification created at {now}",
            priority="normal",
            is_read=False,
            is_dismissed=False,
            created_at=now
        )
        db.add(notif)
        db.commit()
        
        count = db.query(NotificationDB).count()
        
        return {
            "status": "success",
            "message": f"Test notification created with ID: {notif_id}",
            "total_notifications": count
        }
    except Exception as e:
        if db: db.rollback()
        return {"status": "error", "message": str(e)}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# ========== OCR INTEGRATION ==========
# google-genai is imported lazily inside the OCR function to avoid import-time failures
import base64
import re
from pydantic import BaseModel

# class OCRRequest(BaseModel):
#     image: str # Base64 string
#     type: str # 'id' or 'form'

@app.post("/api/ocr")
def process_ocr(request: OCRRequest, db=Depends(get_db)):
    # 1. Get API Key from DB
    api_key = None
    if USE_DATABASE() and db:
        prop = db.query(PropertySettingsDB).filter(PropertySettingsDB.id == "default").first()
        if prop and prop.gemini_api_key:
            api_key = prop.gemini_api_key
    
    # Fallback to env var if not in DB (for dev)
    if not api_key:
        api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise HTTPException(status_code=400, detail="Gemini API Key not configured in Property Settings")

    try:
        # Lazy import google-genai to avoid import-time failures on Vercel
        from google import genai
        from google.genai import types
        
        # Use the newer google-genai SDK
        client = genai.Client(api_key=api_key)
        
        # Clean base64 header if present
        image_data = request.image
        if "base64," in image_data:
            image_data = image_data.split("base64,")[1]
            
        try:
             image_bytes = base64.b64decode(image_data)
        except:
             raise HTTPException(status_code=400, detail="Invalid image data")

        prompt = ""
        if request.type in ['id', 'id_front']:
            prompt = "Extract guest name, ID number, address, DOB (YYYY-MM-DD), gender, nationality from this ID card. Return as clean JSON with these keys: name, idNumber, address, dob, gender, nationality. Only return the JSON."
        elif request.type == 'id_back':
            prompt = "Extract the full address, PIN code, and Father/Husband name from this ID card (Back Side). Return as clean JSON with these keys: address, pinCode, fatherName. Ensure the 'address' field contains the complete address text found."
        else:
            prompt = """
            Extract handwritten guest details from this registration form image.
            Return a clean JSON object with the following specific keys (if found):
            - name (Full Name)
            - phoneNumber (Mobile No)
            - email
            - address (Permanent Address as a single string)
            - idType (Aadhar, Passport, etc)
            - idNumber
            - nationality
            - dob (Date of Birth converted to YYYY-MM-DD format)
            - arrivedFrom
            - nextDestination
            
            Ignore pre-printed text like "Hotel Name", "Booking Conf", or instructions. Focus strictly on the handwritten filled values.
            Only return the JSON.
            """

        # List of models to try (prioritizing stable ones with higher/separate quota)
        models_to_try = [
            'gemini-flash-latest', 
            'gemini-1.5-flash',
            'gemini-1.5-flash-8b',
            'gemini-2.0-flash' 
        ]

        response = None
        last_error = None

        for model_name in models_to_try:
            try:
                print(f"Attempting OCR with model: {model_name}")
                response = client.models.generate_content(
                    model=model_name,
                    contents=[
                        prompt,
                        types.Part.from_bytes(data=image_bytes, mime_type='image/jpeg')
                    ]
                )
                if response:
                    break
            except Exception as e:
                print(f"Model {model_name} failed: {e}")
                last_error = e
                # Continue to next model
        
        if not response:
            raise last_error or HTTPException(status_code=500, detail="All OCR models failed")
        
        text = response.text
        # Clean markdown
        json_match = re.search(r'(\{[\s\S]*\})', text)
        if json_match:
            return {"text": json_match.group(1)}
        else:
            return {"text": text}

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ========== EMAIL RESERVATION PARSER ==========
@app.post("/api/webhooks/inbound-email")
def handle_inbound_email(email: InboundEmail, db=Depends(get_db)):
    """
    Receives forwarded OTA confirmation emails and uses Gemini to extract 
    booking data into a structured format.
    """
    _load_db_imports()
    import uuid
    import time
    
    print(f"=== INBOUND EMAIL RECEIVED ===")
    print(f"Subject: {email.Subject}")
    print(f"From: {email.From}")
    print(f"TextBody length: {len(email.TextBody) if email.TextBody else 0}")
    print(f"HtmlBody length: {len(email.HtmlBody) if email.HtmlBody else 0}")
    
    # 1. Build external reference for deduplication
    # We prioritize the unique Cloudmailin ID or MessageID to distinguish different emails.
    # Cloudmailin's 'id' is unique for every received message even if headers/content are similar.
    external_ref = email.id or email.MessageID
    
    if not external_ref:
        import hashlib
        # Combine subject, from, and FULL body for the hash to avoid collisions on similar test emails
        body_content = email.TextBody or email.HtmlBody or ""
        content_hash = hashlib.md5(f"{email.Subject or ''}{email.From or ''}{body_content}".encode()).hexdigest()
        external_ref = f"hash-{content_hash}"
        
    print(f"External ref: {external_ref}")


    # 2. Get GEMINI API Key
    api_key = None
    if USE_DATABASE() and db:
        prop = db.query(PropertySettingsDB).filter(PropertySettingsDB.id == "default").first()
        if prop and prop.gemini_api_key:
            api_key = prop.gemini_api_key
    if not api_key:
        api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        print("ERROR: No Gemini API key found!")
        raise HTTPException(status_code=400, detail="Gemini API Key for email parsing not configured.")

    # 3. Call Gemini to parse
    try:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=api_key)
        
        # We prefer HTML for richer content, then fallback to text
        content_to_parse = email.HtmlBody or email.TextBody or ""
        if not content_to_parse:
             print("ERROR: Email body is empty!")
             raise HTTPException(status_code=400, detail="Email body is empty")
             
        prompt = """
        Extract reservation details from this hotel booking confirmation email. 
        Return as a clean JSON with these keys:
        - guestName: string (full name of the primary guest)
        - checkIn: string (YYYY-MM-DD format)
        - checkOut: string (YYYY-MM-DD format)
        - amount: number (total price, the Property Gross Charges)
        - source: string ('Booking.com', 'MMT', 'Expedia', or 'Direct')
        - roomTypeRaw: string (e.g., 'Double Bed Room', 'Deluxe AC Room')
        - numberOfRooms: number
        - pax: number (total guests)
        - otaBookingId: string (The booking/reservation ID, e.g. NH74074458022974)
        - pnr: string (The PNR number if available, e.g. 0166806571)
        - paymentStatus: string ('Paid Online', 'Pay at Hotel', 'Prepaid')
        
        Only return the JSON, nothing else.
        """


        # 3.5 Check for Gmail Verification Email explicitly
        if "Gmail Forwarding Confirmation" in (email.Subject or "") or "forwarding-noreply" in (email.From or ""):
             print(f"=== GMAIL VERIFICATION DETECTED ===")
             print(f"BODY: {content_to_parse}")
             return {"status": "ignored", "reason": "gmail_verification", "body_snippet": content_to_parse[:200]}

        # List of models to try (must match available API models)
        models_to_try = [
            'gemini-2.0-flash',
            'gemini-2.5-flash',
            'gemini-2.0-flash-lite',
        ]
        
        response = None
        last_err = None
        
        for model_name in models_to_try:
            try:
                print(f"Trying model: {model_name}")
                response = client.models.generate_content(
                    model=model_name,
                    contents=[prompt, content_to_parse]
                )
                if response and response.text:
                    print(f"Model {model_name} succeeded!")
                    break
            except Exception as e:
                print(f"Model {model_name} failed: {e}")
                last_err = e
        
        if not response or not response.text:
             # Check if it was just a random email that's not a booking
             print("AI failed to extract JSON. Likely not a booking confirmation.")
             return {"status": "ignored", "reason": "not_booking_email"}
                   
        # Clean JSON from markdown wrap
        json_text = response.text
        if "```json" in json_text:
            json_text = json_text.split("```json")[1].split("```")[0]
        elif "```" in json_text:
            json_text = json_text.split("```")[1].split("```")[0]
        
        parsed_data = json.loads(json_text.strip())
        print(f"=== PARSED DATA: {json.dumps(parsed_data, indent=2)} ===")
        
        # 4. Map Room Type
        room_type_id = None
        if USE_DATABASE() and db:
            all_rts = db.query(RoomTypeDB).all()
            raw_room = (parsed_data.get('roomTypeRaw') or '').lower()
            
            for rt in all_rts:
                if rt.name.lower() in raw_room or raw_room in rt.name.lower():
                    room_type_id = rt.id
                    print(f"Matched room type: {rt.name} -> {rt.id}")
                    break
            
            if not room_type_id and all_rts:
                room_type_id = all_rts[0].id
                print(f"Defaulted to first room type: {room_type_id}")

        # 5. Determine Booking ID and PNR
        ota_id = parsed_data.get('otaBookingId')
        pnr = parsed_data.get('pnr')
        new_id = ota_id if ota_id else f"RES-{str(uuid.uuid4())[:8].upper()}"
        print(f"Booking ID: {new_id}, PNR: {pnr}")

        
        # 6. Check for pre-payments
        initial_payments = []
        payment_status = (parsed_data.get('paymentStatus') or '').lower()
        if 'paid' in payment_status or 'prepaid' in payment_status:
            total_amount = parsed_data.get('amount', 0)
            initial_payments.append({
                "id": str(uuid.uuid4()),
                "amount": total_amount,
                "method": "Online (OTA)",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "Completed",
                "category": "Room",
                "description": f"Pre-paid through {parsed_data.get('source', 'OTA')}"
            })
            print(f"Payment recorded: {total_amount} (status: {payment_status})")

        # 7. Check for existing booking to update (Modifies if ID or PNR match)
        if USE_DATABASE() and db:
            # Check by primary ID (new_id)
            existing = db.query(BookingDB).filter(BookingDB.id == new_id).first()
            
            # If not found, check by reservation_id (PNR)
            if not existing and pnr:
                existing = db.query(BookingDB).filter(BookingDB.reservation_id == pnr).first()
                
            # If still not found, check by external_ref (Cloudmailin ID)
            if not existing and external_ref:
                existing = db.query(BookingDB).filter(BookingDB.external_reference_id == external_ref).first()

            if existing:
                print(f"Found existing booking {existing.id}, updating...")
                existing.room_type_id = room_type_id or existing.room_type_id
                existing.guest_name = parsed_data.get('guestName', existing.guest_name)
                existing.check_in = parsed_data.get('checkIn', existing.check_in)
                existing.check_out = parsed_data.get('checkOut', existing.check_out)
                existing.amount = parsed_data.get('amount', existing.amount)
                existing.number_of_rooms = parsed_data.get('numberOfRooms', existing.number_of_rooms)
                existing.pax = parsed_data.get('pax', existing.pax)
                existing.reservation_id = pnr or existing.reservation_id
                existing.external_reference_id = external_ref
                
                # Update payments if provided
                if initial_payments:
                    existing.payments = initial_payments
                
                db.commit()
                db.refresh(existing)
                print(f"=== BOOKING UPDATED: {existing.id} for {existing.guest_name} ===")
                
                # Create Notification for update
                notif_id = f"notif-{str(uuid.uuid4())[:8]}"
                new_notif = NotificationDB(
                    id=notif_id,
                    type="reservation",
                    category="update_booking",
                    title="Booking Updated",
                    message=f"Updated booking for {existing.guest_name} from {existing.source}",
                    priority="normal",
                    is_read=False,
                    is_dismissed=False,
                    created_at=datetime.now(timezone.utc).isoformat(),
                    booking_id=existing.id,
                    room_number=existing.room_number
                )
                db.add(new_notif)
                db.commit()
                
                return {"status": "success", "booking_id": existing.id, "guest": existing.guest_name, "action": "updated"}


        # 8. Create the booking
        new_booking = BookingDB(
            id=new_id,
            room_type_id=room_type_id or "rt-1", 
            room_number="Unassigned",
            guest_name=parsed_data.get('guestName', 'Parsed Guest'),
            source=parsed_data.get('source', 'Direct'),
            status="Confirmed",
            timestamp=int(time.time() * 1000),
            check_in=parsed_data.get('checkIn'),
            check_out=parsed_data.get('checkOut'),
            amount=parsed_data.get('amount'),
            reservation_id=pnr, # Store PNR here
            number_of_rooms=parsed_data.get('numberOfRooms', 1),
            pax=parsed_data.get('pax', 2),
            is_auto_generated=True,
            external_reference_id=external_ref,
            payments=initial_payments,
            guest_details={"name": parsed_data.get('guestName', 'Parsed Guest')}
        )

        
        if USE_DATABASE() and db:
            db.add(new_booking)
            db.commit()
            db.refresh(new_booking)
            print(f"=== BOOKING SAVED: {new_booking.id} for {new_booking.guest_name} ===")
            
            # Create Notification for new booking
            notif_id = f"notif-{str(uuid.uuid4())[:8]}"
            new_notif = NotificationDB(
                id=notif_id,
                type="reservation",
                category="new_booking",
                title="New Booking Parsed",
                message=f"Received a new booking for {new_booking.guest_name} from {new_booking.source}",
                priority="high",
                is_read=False,
                is_dismissed=False,
                created_at=datetime.now(timezone.utc).isoformat(),
                booking_id=new_booking.id,
                room_number=new_booking.room_number
            )
            db.add(new_notif)
            db.commit()
            
            return {"status": "success", "booking_id": new_booking.id, "guest": new_booking.guest_name}
        
        return {"status": "success", "parsed": parsed_data}

    except Exception as e:
        print(f"!!! EMAIL PARSING FAILED: {e}")
        import traceback
        traceback.print_exc()
        if db:
            db.rollback()
        raise HTTPException(status_code=500, detail=f"AI Parsing failed: {str(e)}")


# ========== RAZORPAY INTEGRATION ==========
from pydantic import BaseModel as PydanticBaseModel
import hashlib
import hmac
import time

# class RazorpayOrderRequest(PydanticBaseModel):
#     amount: float  # In INR
#     bookingId: str
#     description: Optional[str] = "Payment for Hotel Stay"

# class RazorpayVerifyRequest(PydanticBaseModel):
#     razorpay_order_id: str
#     razorpay_payment_id: str
#     razorpay_signature: str
#     bookingId: str
#     amount: float

@app.post("/api/razorpay/create-order")
def create_razorpay_order(request: RazorpayOrderRequest, db=Depends(get_db)):
    """Create a Razorpay order for payment collection"""
    # Get property settings to retrieve Razorpay keys
    prop = None
    if USE_DATABASE() and db:
        prop = db.query(PropertySettingsDB).filter(PropertySettingsDB.id == "default").first()
    
    key_id = prop.razorpay_key_id if prop and hasattr(prop, 'razorpay_key_id') else None
    key_secret = prop.razorpay_key_secret if prop and hasattr(prop, 'razorpay_key_secret') else None
    
    if not key_id or not key_secret:
        raise HTTPException(status_code=400, detail="Razorpay credentials not configured. Please set them in Property Setup > Integrations.")
    
    try:
        import razorpay
        client = razorpay.Client(auth=(key_id, key_secret))
        
        # Amount in paise (INR * 100)
        order_data = {
            "amount": int(request.amount * 100),
            "currency": "INR",
            "receipt": f"booking_{request.bookingId}",
            "notes": {
                "booking_id": request.bookingId,
                "description": request.description
            }
        }
        
        order = client.order.create(data=order_data)
        return {
            "order_id": order["id"],
            "amount": request.amount,
            "currency": "INR",
            "key_id": key_id  # Frontend needs this to open checkout
        }
    except ImportError:
        raise HTTPException(status_code=500, detail="Razorpay SDK not installed. Run: pip install razorpay")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create Razorpay order: {str(e)}")

@app.post("/api/razorpay/verify-payment")
def verify_razorpay_payment(request: RazorpayVerifyRequest, db=Depends(get_db)):
    """Verify Razorpay payment signature and record payment"""
    # Get property settings
    prop = None
    if USE_DATABASE() and db:
        prop = db.query(PropertySettingsDB).filter(PropertySettingsDB.id == "default").first()
    
    key_secret = prop.razorpay_key_secret if prop and hasattr(prop, 'razorpay_key_secret') else None
    
    if not key_secret:
        raise HTTPException(status_code=400, detail="Razorpay secret not configured")
    
    # Verify signature
    message = f"{request.razorpay_order_id}|{request.razorpay_payment_id}"
    expected_signature = hmac.new(
        key_secret.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    
    if expected_signature != request.razorpay_signature:
        raise HTTPException(status_code=400, detail="Payment verification failed: Invalid signature")
    
    # Payment verified! Now add to booking
    if USE_DATABASE() and db:
        booking = db.query(BookingDB).filter(BookingDB.id == request.bookingId).first()
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        
        # Create payment record
        new_payment = {
            "id": request.razorpay_payment_id,
            "amount": request.amount,
            "method": "Card",  # Razorpay handles multiple methods
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "category": "Partial",
            "description": f"Online Payment (Razorpay)",
            "status": "Completed"
        }
        
        # Add to payments list
        current_payments = booking.payments or []
        if isinstance(current_payments, str):
            import json
            current_payments = json.loads(current_payments)
        current_payments.append(new_payment)
        booking.payments = current_payments
        
        # Auto-reconcile: Mark unpaid folio items as paid (oldest first)
        remaining = request.amount
        current_folio = booking.folio or []
        if isinstance(current_folio, str):
            import json
            current_folio = json.loads(current_folio)
        
        for item in current_folio:
            if remaining <= 0:
                break
            if not item.get('isPaid', False):
                item['isPaid'] = True
                item['paymentMethod'] = 'Card'
                item['paymentId'] = request.razorpay_payment_id
                remaining -= item.get('amount', 0)
        
        booking.folio = current_folio
        db.commit()
        
        return {"status": "success", "payment_id": request.razorpay_payment_id, "message": "Payment recorded successfully"}
    
    return {"status": "success", "payment_id": request.razorpay_payment_id}



# Configure CORS
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "*", 
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Fallback Data (lazy) ---
_fallback_cache = {}

def get_fallback_hotels():
    if 'hotels' not in _fallback_cache:
        _load_db_imports()
        _fallback_cache['hotels'] = [
            Hotel(
                id='h-1', 
                name='Hotel Satsangi', 
                location='Deoghar', 
                color='indigo', 
                otaConfig={'expedia': 'active', 'booking': 'active', 'mmt': 'active'}
            )
        ] if Hotel else []
    return _fallback_cache['hotels']

def get_fallback_room_types():
    if 'room_types' not in _fallback_cache:
        _load_db_imports()
        _fallback_cache['room_types'] = [
            RoomType(id='rt-1', name='Delux Room (AC)', totalCapacity=10, basePrice=4500, floorPrice=3000, ceilingPrice=8000, baseOccupancy=2, amenities=['WiFi', 'AC', 'TV'], roomNumbers=['101', '102', '103', '104', '105', '106', '107', '108', '109', '110'], extraBedCharge=1200),
            RoomType(id='rt-2', name='Double Bed Room', totalCapacity=10, basePrice=2800, floorPrice=1800, ceilingPrice=5000, baseOccupancy=2, amenities=['WiFi', 'Fan'], roomNumbers=['201', '202', '203', '204', '205', '206', '207', '208', '209', '210'], extraBedCharge=800),
            RoomType(id='rt-3', name='Single Bed Room', totalCapacity=5, basePrice=1800, floorPrice=1200, ceilingPrice=3000, baseOccupancy=1, amenities=['WiFi'], roomNumbers=['301', '302', '303', '304', '305'], extraBedCharge=500),
            RoomType(id='rt-4', name='Dormitory', totalCapacity=3, basePrice=1200, floorPrice=800, ceilingPrice=2500, baseOccupancy=1, amenities=['WiFi', 'Locker'], roomNumbers=['D-1', 'D-2', 'D-3'], extraBedCharge=300),
        ] if RoomType else []
    return _fallback_cache['room_types']

def get_fallback_connections():
    if 'connections' not in _fallback_cache:
        _load_db_imports()
        _fallback_cache['connections'] = [
            OTAConnection(id='mmt', name='MakeMyTrip', key='mkmt_live_••••••••7d2f', isVisible=False, status='connected', lastValidated='2 hours ago'),
            OTAConnection(id='booking', name='Booking.com', key='bcom_auth_••••••••a11b', isVisible=False, status='connected', lastValidated='5 mins ago'),
            OTAConnection(id='expedia', name='Expedia', key='', isVisible=False, status='disconnected'),
        ] if OTAConnection else []
    return _fallback_cache['connections']

def get_fallback_rules():
    if 'rules' not in _fallback_cache:
        _load_db_imports()
        _fallback_cache['rules'] = RateRulesConfig(
            weeklyRules={'isActive': True, 'activeDays': [5, 6], 'modifierType': 'percentage', 'modifierValue': 1.20},
            specialEvents=[
                {'id': 'ev-1', 'name': 'Diwali Festival', 'startDate': '2025-10-30', 'endDate': '2025-11-05', 'modifierType': 'percentage', 'modifierValue': 1.5},
                {'id': 'ev-2', 'name': 'New Year Eve', 'startDate': '2025-12-30', 'endDate': '2026-01-01', 'modifierType': 'fixed', 'modifierValue': 5000}
            ]
        ) if RateRulesConfig else None
    return _fallback_cache['rules']

def get_fallback_property():
    if 'property' not in _fallback_cache:
        _load_db_imports()
        _fallback_cache['property'] = PropertySettings(
            name='Hotel Satsangi',
            address='Satsang Nagar, Deoghar, Jharkhand 814112',
            phone='+91 98765 43210',
            email='contact@hotelsatsangi.com',
            gstNumber='20ABCDE1234F1Z5',
            gstRate=12.0,
            foodGstRate=5.0,
            otherGstRate=18.0,
            publicBaseUrl='http://localhost:3000',
            geminiApiKey='',
            loyaltyTiers=[
                {'name': 'SILVER', 'minNights': 2},
                {'name': 'GOLD ELITE', 'minNights': 5},
                {'name': 'PLATINUM', 'minNights': 10}
            ]
        ) if PropertySettings else None
    return _fallback_cache['property']

def get_fallback_bookings():
    if 'bookings' not in _fallback_cache:
        _fallback_cache['bookings'] = []
    return _fallback_cache['bookings']

# --- Converters (always defined, called only when DB is available) ---
def db_hotel_to_pydantic(db_hotel):
    _load_db_imports()
    return Hotel(
        id=db_hotel.id,
        name=db_hotel.name,
        location=db_hotel.location,
        color=db_hotel.color,
        otaConfig=db_hotel.ota_config or {}
    )

def db_room_type_to_pydantic(db_room):
    _load_db_imports()
    return RoomType(
        id=db_room.id,
        name=db_room.name,
        totalCapacity=db_room.total_capacity,
        basePrice=db_room.base_price,
        floorPrice=db_room.floor_price,
        ceilingPrice=db_room.ceiling_price,
        baseOccupancy=db_room.base_occupancy,
        amenities=db_room.amenities or [],
        roomNumbers=db_room.room_numbers,
        extraBedCharge=db_room.extra_bed_charge,
        extraAdultRate=db_room.extra_adult_rate if hasattr(db_room, 'extra_adult_rate') else 0,
        extraChildRate=db_room.extra_child_rate if hasattr(db_room, 'extra_child_rate') else 0
    )

def db_booking_to_pydantic(db_booking):
    _load_db_imports()
    # Handle potentially malformed JSON fields
    def safe_json_list(value):
        if value is None:
            return []
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            import json
            try:
                parsed = json.loads(value)
                return parsed if isinstance(parsed, list) else []
            except:
                return []
        return []

    def safe_json_dict(value):
        if value is None:
            return {}
        if isinstance(value, dict):
            return value
        if isinstance(value, str):
            import json
            try:
                parsed = json.loads(value)
                return parsed if isinstance(parsed, dict) else {}
            except:
                return {}
        return {}
    
    # Ensure guest name is always populated inside guestDetails
    guest_details_dict = safe_json_dict(db_booking.guest_details)
    if not guest_details_dict.get('name') and db_booking.guest_name:
        guest_details_dict['name'] = db_booking.guest_name

    return Booking(
        id=db_booking.id,
        roomTypeId=db_booking.room_type_id,
        roomNumber=db_booking.room_number,
        guestName=db_booking.guest_name,
        source=db_booking.source if db_booking.source in ['MMT', 'Booking.com', 'Expedia', 'Direct'] else 'Direct',
        status=db_booking.status,
        timestamp=db_booking.timestamp,
        checkIn=db_booking.check_in or "",
        checkOut=db_booking.check_out or "",
        reservationId=db_booking.reservation_id,
        channelSync=safe_json_dict(db_booking.channel_sync),
        amount=db_booking.amount,
        rejectionReason=db_booking.rejection_reason,
        guestDetails=guest_details_dict,
        numberOfRooms=db_booking.number_of_rooms,
        pax=db_booking.pax,
        accessoryGuests=safe_json_list(db_booking.accessory_guests),
        extraBeds=db_booking.extra_beds,
        extraAdults=db_booking.extra_adults,
        extraChildren=db_booking.extra_children,
        specialRequests=db_booking.special_requests,
        isVIP=db_booking.is_vip,
        isSettled=db_booking.is_settled,
        invoiceNumber=db_booking.invoice_number,
        invoicePath=db_booking.invoice_path,
        receiptPath=db_booking.receipt_path,
        isAutoGenerated=getattr(db_booking, 'is_auto_generated', False),
        externalReferenceId=getattr(db_booking, 'external_reference_id', None),
        folio=safe_json_list(db_booking.folio),
        payments=safe_json_list(db_booking.payments),
        discount=getattr(db_booking, 'discount', None)
    )

def db_connection_to_pydantic(db_conn):
    _load_db_imports()
    return OTAConnection(
        id=db_conn.id,
        name=db_conn.name,
        key=mask_secret(db_conn.key) if db_conn.key else "",  # Masked
        isVisible=db_conn.is_visible,
        status=db_conn.status,
        lastValidated=db_conn.last_validated,
        category=db_conn.category,
        markupType=db_conn.markup_type,
        markupValue=db_conn.markup_value,
        isStopped=db_conn.is_stopped
    )

def db_rules_to_pydantic(db_rules):
    _load_db_imports()
    return RateRulesConfig(
        weeklyRules=db_rules.weekly_rules or {},
        specialEvents=db_rules.special_events or []
    )

def db_property_to_pydantic(db_prop):
    _load_db_imports()
    return PropertySettings(
        name=db_prop.name,
        address=db_prop.address,
        phone=db_prop.phone,
        email=db_prop.email,
        gstNumber=db_prop.gst_number,
        gstRate=db_prop.gst_rate,
        foodGstRate=db_prop.food_gst_rate if hasattr(db_prop, 'food_gst_rate') else 5.0,
        otherGstRate=db_prop.other_gst_rate if hasattr(db_prop, 'other_gst_rate') else 18.0,
        razorpayKeyId=db_prop.razorpay_key_id if hasattr(db_prop, 'razorpay_key_id') else None,
        razorpayKeySecret=mask_secret(db_prop.razorpay_key_secret) if hasattr(db_prop, 'razorpay_key_secret') and db_prop.razorpay_key_secret else None,
        publicBaseUrl=db_prop.public_base_url if hasattr(db_prop, 'public_base_url') else None,
        geminiApiKey=mask_secret(db_prop.gemini_api_key) if hasattr(db_prop, 'gemini_api_key') and db_prop.gemini_api_key else None,
        lastInvoiceNumber=db_prop.last_invoice_number if hasattr(db_prop, 'last_invoice_number') else 0,
        checkInTime=db_prop.check_in_time if hasattr(db_prop, 'check_in_time') else "12:00",
        checkOutTime=db_prop.check_out_time if hasattr(db_prop, 'check_out_time') else "11:00",
        loyaltyTiers=db_prop.loyalty_tiers if hasattr(db_prop, 'loyalty_tiers') else []
    )

def _sync_guest_profile(gd, check_in_date, db):
    """Helper to sync GuestDetails with GuestProfileDB"""
    if not gd or not gd.name or not gd.phoneNumber:
        return None
        
    norm_phone = normalize_phone(gd.phoneNumber)
    if not norm_phone:
        return None
        
    logger.info(f"Syncing guest profile: name='{gd.name}', phone='{gd.phoneNumber}' (norm='{norm_phone}'), profileId={gd.profileId}")
        
    existing_profile = None
    if gd.profileId:
        existing_profile = db.query(GuestProfileDB).filter(GuestProfileDB.id == gd.profileId).first()
        if existing_profile:
            logger.info(f"  Found profile by ID: {existing_profile.id} (DB name: '{existing_profile.name}')")
            # Safety check: if name is completely different, this might be a stale profileId
            # We allow it for now but log it. 
            if existing_profile.name.lower() != gd.name.lower():
                logger.warning(f"  Profile ID {gd.profileId} name mismatch: DB='{existing_profile.name}', New='{gd.name}'")
    
    if not existing_profile:
        # Try exact name (case-insensitive) + normalized phone match first
        # Querying by phone suffix as a broad filter
        search_suffix = norm_phone[-7:] if len(norm_phone) >= 7 else norm_phone
        profiles = db.query(GuestProfileDB).filter(GuestProfileDB.phone_number.like(f"%{search_suffix}%")).all()
        for p in profiles:
            if p.name.lower() == gd.name.lower() and normalize_phone(p.phone_number) == norm_phone:
                existing_profile = p
                logger.info(f"  Found profile by name+phone match: {existing_profile.id}")
                break
        
    if not existing_profile:
        logger.info(f"  No existing profile found for '{gd.name}' / '{gd.phoneNumber}'. Creating new.")
        
    if existing_profile:
        # Update existing profile with any new info from this booking
        # We also update the name and phone in case they were slightly different (e.g. casing/format)
        existing_profile.name = gd.name
        existing_profile.phone_number = gd.phoneNumber
        
        if gd.idType: existing_profile.id_type = gd.idType
        if gd.idNumber: existing_profile.id_number = encrypt_field(gd.idNumber)
        if gd.address: existing_profile.address = gd.address
        if gd.dob: existing_profile.dob = gd.dob
        if gd.nationality: existing_profile.nationality = gd.nationality
        if gd.gender: existing_profile.gender = gd.gender
        if gd.email: existing_profile.email = gd.email
        if gd.passportNumber: existing_profile.passport_number = encrypt_field(gd.passportNumber)
        if gd.passportPlaceIssue: existing_profile.passport_place_issue = gd.passportPlaceIssue
        if gd.passportIssueDate: existing_profile.passport_issue_date = gd.passportIssueDate
        if gd.passportExpiry: existing_profile.passport_expiry = gd.passportExpiry
        if gd.visaNumber: existing_profile.visa_number = encrypt_field(gd.visaNumber)
        if gd.visaType: existing_profile.visa_type = gd.visaType
        if gd.visaPlaceIssue: existing_profile.visa_place_issue = gd.visaPlaceIssue
        if gd.visaIssueDate: existing_profile.visa_issue_date = gd.visaIssueDate
        if gd.visaExpiry: existing_profile.visa_expiry = gd.visaExpiry
        if gd.arrivedFrom: existing_profile.arrived_from = gd.arrivedFrom
        if gd.arrivalDateIndia: existing_profile.arrival_date_india = gd.arrivalDateIndia
        if gd.arrivalPort: existing_profile.arrival_port = gd.arrivalPort
        if gd.nextDestination: existing_profile.next_destination = gd.nextDestination
        if gd.purposeOfVisit: existing_profile.purpose_of_visit = gd.purposeOfVisit
        if gd.idImage: existing_profile.id_image = gd.idImage
        if gd.idImageBack: existing_profile.id_image_back = gd.idImageBack
        if gd.visaPage: existing_profile.visa_page = gd.visaPage
        if gd.additionalDocs: existing_profile.additional_docs = gd.additionalDocs
        if gd.formPages: existing_profile.form_pages = gd.formPages
        if gd.serialNumber: existing_profile.serial_number = gd.serialNumber
        if gd.fatherOrHusbandName: existing_profile.father_or_husband_name = gd.fatherOrHusbandName
        if gd.city: existing_profile.city = gd.city
        if gd.state: existing_profile.state = gd.state
        if gd.pinCode: existing_profile.pin_code = gd.pinCode
        if gd.country: existing_profile.country = gd.country
        if gd.arrivalTime: existing_profile.arrival_time = gd.arrivalTime
        if gd.departureTime: existing_profile.departure_time = gd.departureTime
        if gd.signature: existing_profile.signature = gd.signature
        
        existing_profile.last_check_in = check_in_date
        db.flush()
        return existing_profile.id
    else:
        # Create new profile
        new_profile = GuestProfileDB(
            name=gd.name,
            phone_number=gd.phoneNumber or "",
            id_type=gd.idType,
            id_number=encrypt_field(gd.idNumber) if gd.idNumber else None,
            address=gd.address,
            dob=gd.dob,
            nationality=gd.nationality,
            gender=gd.gender,
            email=gd.email,
            passport_number=encrypt_field(gd.passportNumber) if gd.passportNumber else None,
            passport_place_issue=gd.passportPlaceIssue,
            passport_issue_date=gd.passportIssueDate,
            passport_expiry=gd.passportExpiry,
            visa_number=encrypt_field(gd.visaNumber) if gd.visaNumber else None,
            visa_type=gd.visaType,
            visa_place_issue=gd.visaPlaceIssue,
            visa_issue_date=gd.visaIssueDate,
            visa_expiry=gd.visaExpiry,
            arrived_from=gd.arrivedFrom,
            arrival_date_india=gd.arrivalDateIndia,
            arrival_port=gd.arrivalPort,
            next_destination=gd.nextDestination,
            purpose_of_visit=gd.purposeOfVisit,
            id_image=gd.idImage,
            id_image_back=gd.idImageBack,
            visa_page=gd.visaPage,
            additional_docs=gd.additionalDocs or [],
            form_pages=gd.formPages or [],
            serial_number=gd.serialNumber,
            father_or_husband_name=gd.fatherOrHusbandName,
            city=gd.city,
            state=gd.state,
            pin_code=gd.pinCode,
            country=gd.country,
            arrival_time=gd.arrivalTime,
            departure_time=gd.departureTime,
            signature=gd.signature,
            last_check_in=check_in_date
        )
        db.add(new_profile)
        db.flush()
        return new_profile.id

# @app.get("/")
# def read_root():
#     return {"message": "SyncGuard PMS API", "database": "connected" if USE_DATABASE() else "fallback"}

@app.get("/api/hotels")
def get_hotels(db=Depends(get_db)):
    if USE_DATABASE() and db:
        hotels = db.query(HotelDB).all()
        return [db_hotel_to_pydantic(h) for h in hotels]
    return get_fallback_hotels()

@app.get("/api/room-types")
def get_room_types(db=Depends(get_db)):
    if USE_DATABASE() and db:
        room_types = db.query(RoomTypeDB).all()
        return [db_room_type_to_pydantic(rt) for rt in room_types]
    return get_fallback_room_types()

@app.post("/api/room-types")
def create_room_type(room_type: RoomType, db=Depends(get_db)):
    if USE_DATABASE() and db:
        try:
            db_room = RoomTypeDB(
                id=room_type.id,
                name=room_type.name,
                total_capacity=room_type.totalCapacity,
                base_price=room_type.basePrice,
                floor_price=room_type.floorPrice,
                ceiling_price=room_type.ceilingPrice,
                base_occupancy=room_type.baseOccupancy,
                amenities=room_type.amenities or [],
                room_numbers=room_type.roomNumbers or [],
                extra_bed_charge=room_type.extraBedCharge,
                extra_adult_rate=room_type.extraAdultRate,
                extra_child_rate=room_type.extraChildRate
            )
            db.add(db_room)
            db.commit()
            db.refresh(db_room)
            return db_room_type_to_pydantic(db_room)
        except Exception as e:
            print(f"ERROR Saving Room Type: {e}")
            if db: db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
            
    get_fallback_room_types().append(room_type)
    return room_type

@app.put("/api/room-types/{rt_id}")
def update_room_type(rt_id: str, room_type: RoomType, db=Depends(get_db)):
    if USE_DATABASE() and db:
        db_room = db.query(RoomTypeDB).filter(RoomTypeDB.id == rt_id).first()
        
        # If it doesn't exist, Create it (Upsert)
        if not db_room:
            db_room = RoomTypeDB(
                id=rt_id,
                name=room_type.name,
                total_capacity=room_type.totalCapacity,
                base_price=room_type.basePrice,
                floor_price=room_type.floorPrice,
                ceiling_price=room_type.ceilingPrice,
                base_occupancy=room_type.baseOccupancy,
                amenities=room_type.amenities or [],
                room_numbers=room_type.roomNumbers or [],
                extra_bed_charge=room_type.extraBedCharge,
                extra_adult_rate=room_type.extraAdultRate,
                extra_child_rate=room_type.extraChildRate
            )
            db.add(db_room)
        else:
            # Check if any room numbers are being removed that have active or future bookings
            new_room_numbers = room_type.roomNumbers or []
            old_room_numbers = db_room.room_numbers or []
            removed_rooms = [r for r in old_room_numbers if r not in new_room_numbers]
            
            if removed_rooms:
                today = datetime.now().strftime("%Y-%m-%d")
                active_conflicts = db.query(BookingDB).filter(
                    BookingDB.room_number.in_(removed_rooms),
                    BookingDB.status.in_(['Confirmed', 'CheckedIn']),
                    BookingDB.check_out >= today
                ).all()
                
                if active_conflicts:
                    conflict_rooms = ", ".join(list(set([b.room_number for b in active_conflicts])))
                    raise HTTPException(status_code=400, detail=f"Cannot remove room(s) {conflict_rooms} as they have active or future bookings.")

            db_room.name = room_type.name
            db_room.total_capacity = room_type.totalCapacity
            db_room.base_price = room_type.basePrice
            db_room.floor_price = room_type.floorPrice
            db_room.ceiling_price = room_type.ceilingPrice
            db_room.base_occupancy = room_type.baseOccupancy
            db_room.amenities = room_type.amenities or []
            db_room.room_numbers = room_type.roomNumbers or []
            db_room.extra_bed_charge = room_type.extraBedCharge
            db_room.extra_adult_rate = room_type.extraAdultRate
            db_room.extra_child_rate = room_type.extraChildRate
        
        db.commit()
        db.refresh(db_room)
        return db_room_type_to_pydantic(db_room)
    
    # Fallback mode
    for i, rt in enumerate(get_fallback_room_types()):
        if rt.id == rt_id:
            get_fallback_room_types()[i] = room_type
            return room_type
    raise HTTPException(status_code=404, detail="Room Type not found")

@app.delete("/api/room-types/{rt_id}")
def delete_room_type(rt_id: str, db=Depends(get_db)):
    if USE_DATABASE() and db:
        db_room = db.query(RoomTypeDB).filter(RoomTypeDB.id == rt_id).first()
        if not db_room:
            raise HTTPException(status_code=404, detail="Room Type not found")
        
        # Check if there are active or future bookings for this room type
        today = datetime.now().strftime("%Y-%m-%d")
        active_bookings = db.query(BookingDB).filter(
            BookingDB.room_type_id == rt_id,
            BookingDB.status.in_(['Confirmed', 'CheckedIn']),
            BookingDB.check_out >= today
        ).count()
        if active_bookings > 0:
            raise HTTPException(status_code=400, detail="Cannot delete room type with active or future bookings. Please cancel or relocate them first.")
            
        try:
            db.delete(db_room)
            db.commit()
            return {"status": "success"}
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=400, detail="Cannot delete room category because it has past or cancelled bookings tied to it (needed for records). You can rename or repurpose this category instead.")
    
    # In fallback mode, just return success (can't persist changes)
    return {"status": "success"}

@app.get("/api/connections")
def get_connections(db=Depends(get_db)):
    if USE_DATABASE() and db:
        connections = db.query(OTAConnectionDB).all()
        return [db_connection_to_pydantic(c) for c in connections]
    return get_fallback_connections()

@app.get("/api/rules")
def get_rules(db=Depends(get_db)):
    if USE_DATABASE() and db:
        rules = db.query(RateRulesDB).filter(RateRulesDB.id == "default").first()
        if not rules:
            return get_fallback_rules()
        return db_rules_to_pydantic(rules)
    return get_fallback_rules()

@app.put("/api/rules")
def update_rules(rules: RateRulesConfig, db=Depends(get_db)):
    _load_db_imports()
    if USE_DATABASE() and db:
        db_rules = db.query(RateRulesDB).filter(RateRulesDB.id == "default").first()
        if not db_rules:
            db_rules = RateRulesDB(id="default")
            db.add(db_rules)
        
        db_rules.weekly_rules = rules.weeklyRules.dict()
        db_rules.special_events = [e.dict() for e in rules.specialEvents]
        db.commit()
        db.refresh(db_rules)
        return db_rules_to_pydantic(db_rules)
    return rules

@app.get("/api/property")
def get_property_settings(db=Depends(get_db)):
    if USE_DATABASE() and db:
        prop = db.query(PropertySettingsDB).filter(PropertySettingsDB.id == "default").first()
        if not prop:
            return get_fallback_property()
        return db_property_to_pydantic(prop)
    return get_fallback_property()

@app.put("/api/property")
def update_property_settings(settings: PropertySettings, db=Depends(get_db)):
    if USE_DATABASE() and db:
        prop = db.query(PropertySettingsDB).filter(PropertySettingsDB.id == "default").first()
        if not prop:
            prop = PropertySettingsDB(id="default")
            db.add(prop)
        
        prop.name = settings.name
        prop.address = settings.address
        prop.phone = settings.phone
        prop.email = settings.email
        prop.gst_number = settings.gstNumber
        prop.gst_rate = settings.gstRate
        prop.food_gst_rate = settings.foodGstRate
        prop.other_gst_rate = settings.otherGstRate
        
        # Encrypt sensitive keys if they are not masked (showing they are newly input)
        if settings.razorpayKeySecret and not settings.razorpayKeySecret.startswith('•'):
            prop.razorpay_key_secret = encrypt_field(settings.razorpayKeySecret)
            
        if settings.geminiApiKey and not settings.geminiApiKey.startswith('•'):
            prop.gemini_api_key = encrypt_field(settings.geminiApiKey)
            
        prop.razorpay_key_id = settings.razorpayKeyId
        prop.last_invoice_number = settings.lastInvoiceNumber or 0
        prop.public_base_url = settings.publicBaseUrl
        prop.check_in_time = settings.checkInTime
        prop.check_out_time = settings.checkOutTime
        if settings.loyaltyTiers is not None:
            prop.loyalty_tiers = [t.dict() for t in settings.loyaltyTiers]
        
        db.commit()
        db.refresh(prop)
        return db_property_to_pydantic(prop)
    
    # Fallback update not persisted globally for simplicity in fallback mode
    return settings

@app.get("/api/guest/lookup")
def lookup_guest(name: Optional[str] = None, phone: Optional[str] = None, db=Depends(get_db)):
    if USE_DATABASE() and db:
        query = db.query(GuestProfileDB)
        if name:
            query = query.filter(GuestProfileDB.name.ilike(f"%{name}%"))
        
        if phone:
            norm_search = normalize_phone(phone)
            # Use last 10 digits for broad filter, but only if we have enough digits to be safe
            search_suffix = norm_search[-10:] if len(norm_search) >= 10 else norm_search
            
            # DB filter using the suffix to avoid fetching all rows
            if len(search_suffix) >= 4:
                query = query.filter(GuestProfileDB.phone_number.like(f"%{search_suffix}%"))
            
            # We limit to 1000 which covers most active guest sets easily
            all_profiles = query.limit(1000).all()
            profiles = []
            for p in all_profiles:
                p_norm = normalize_phone(p.phone_number)
                if not p_norm:
                    continue
                
                # Perfect match after normalization
                if p_norm == norm_search:
                    if p not in profiles:
                        profiles.append(p)
                    continue
                
                # Check for shared suffix if the numbers are long enough (prevent '91' matching randomly)
                if len(norm_search) >= 7 and len(p_norm) >= 7:
                    len_to_compare = min(10, len(norm_search), len(p_norm))
                    if norm_search[-len_to_compare:] == p_norm[-len_to_compare:]:
                        if p not in profiles:
                            profiles.append(p)
        else:
            profiles = query.order_by(GuestProfileDB.last_check_in.desc()).limit(100).all()
        
        # Sort by check-in descending (in case it wasn't sorted by query or was re-filtered)
        profiles.sort(key=lambda x: x.last_check_in or "", reverse=True)
        
        if profiles:
            results = []
            for profile in profiles:
                results.append({
                    "profileId": profile.id,
                    "id": profile.id,
                    "name": profile.name,
                    "phone_number": profile.phone_number,
                    "email": profile.email,
                    "idType": profile.id_type,
                    "idNumber": decrypt_field(profile.id_number) if profile.id_number else "",
                    "address": profile.address,
                    "dob": profile.dob,
                    "nationality": profile.nationality,
                    "preferences": profile.preferences,
                    "gender": profile.gender,
                    "passportNumber": decrypt_field(profile.passport_number) if profile.passport_number else "",
                    "passportPlaceIssue": profile.passport_place_issue,
                    "passportIssueDate": profile.passport_issue_date,
                    "passportExpiry": profile.passport_expiry,
                    "visaNumber": decrypt_field(profile.visa_number) if profile.visa_number else "",
                    "visaType": profile.visa_type,
                    "visaPlaceIssue": profile.visa_place_issue,
                    "visaIssueDate": profile.visa_issue_date,
                    "visaExpiry": profile.visa_expiry,
                    "arrivedFrom": profile.arrived_from,
                    "arrivalDateIndia": profile.arrival_date_india,
                    "arrivalPort": profile.arrival_port,
                    "nextDestination": profile.next_destination,
                    "purposeOfVisit": profile.purpose_of_visit,
                    "idImage": profile.id_image,
                    "idImageBack": profile.id_image_back,
                    "visaPage": profile.visa_page,
                    "additionalDocs": profile.additional_docs or [],
                    "formPages": profile.form_pages or [],
                    "serialNumber": profile.serial_number,
                    "fatherOrHusbandName": profile.father_or_husband_name,
                    "city": profile.city,
                    "state": profile.state,
                    "pinCode": profile.pin_code,
                    "country": profile.country,
                    "arrivalTime": profile.arrival_time,
                    "departureTime": profile.departure_time,
                    "signature": profile.signature,
                    "lastCheckIn": profile.last_check_in
                })
            return results
    return []
    
@app.get("/api/guest/history")
def get_guest_history(name: str, phone: Optional[str] = None, exclude_booking_id: Optional[str] = None, db=Depends(get_db)):
    if USE_DATABASE() and db:
        query = db.query(BookingDB).filter(BookingDB.guest_name == name)
        
        # If phone is provided, it's safer to match by it too if we can find it in guest_details
        # But for history, name matching is the standard first step.
        
        if exclude_booking_id:
            query = query.filter(BookingDB.id != exclude_booking_id)
            
        history = query.order_by(BookingDB.check_in.desc()).all()
        return [db_booking_to_pydantic(b) for b in history]
    return []

@app.get("/api/bookings")
def get_bookings(db=Depends(get_db)):
    db_available = USE_DATABASE()
    if db_available and db:
        bookings = db.query(BookingDB).all()
        logger.info(f"GET /api/bookings - Fetched {len(bookings)} from PostgreSQL")
        result = []
        for b in bookings:
            try:
                result.append(db_booking_to_pydantic(b))
            except Exception as e:
                print(f"CRITICAL: Failed to convert booking {getattr(b, 'id', 'unknown')} to Pydantic: {e}")
                # Skip invalid bookings so the rest of the app keeps working
                continue
        return result
    
    fallback = get_fallback_bookings()
    logger.warning(f"GET /api/bookings - Using IN-MEMORY FALLBACK (found {len(fallback)} bookings)")
    return fallback

@app.get("/api/statistics")
def get_statistics(db=Depends(get_db)):
    """Fetch aggregated statistics for reports and dashboard"""
    bookings_data = []
    if USE_DATABASE() and db:
        try:
            raw_bookings = db.query(BookingDB).filter(BookingDB.status != 'Cancelled').all()
            for b_db in raw_bookings:
                try:
                    bookings_data.append(db_booking_to_pydantic(b_db))
                except Exception as e:
                    print(f"Skipping malformed booking {b_db.id}: {e}")
        except Exception as e:
             print(f"Error querying bookings: {e}")
    else:
        try:
             bookings_data = [b for b in get_fallback_bookings() if b.status != 'Cancelled']
        except:
             bookings_data = []

    # Get Room Types for popularity mapping
    room_types = {}
    if USE_DATABASE() and db:
        raw_rt = db.query(RoomTypeDB).all()
        room_types = {rt.id: rt.name for rt in raw_rt}
    else:
        room_types = {rt.id: rt.name for rt in get_fallback_room_types()}

    now = datetime.now()
    year_start = datetime(now.year, 1, 1)
    one_month_ago = now - timedelta(days=30)
    six_months_ago = now - timedelta(days=180)

    total_revenue_ytd = 0
    total_bookings_ytd = 0
    total_nights_ytd = 0
    
    # Aggregations for different periods
    revenue_by_source_1y = defaultdict(float)
    revenue_by_source_6m = defaultdict(float)
    revenue_by_source_1m = defaultdict(float)
    
    total_rev_1y = 0
    total_rev_6m = 0
    total_rev_1m = 0

    bookings_by_source = defaultdict(int)
    room_type_popularity = defaultdict(int)
    
    # Trends
    daily_revenue = defaultdict(lambda: defaultdict(float))
    weekly_revenue = defaultdict(lambda: defaultdict(float))
    monthly_revenue = defaultdict(lambda: defaultdict(float))
    
    monthly_counts = defaultdict(lambda: defaultdict(int))

    for b in bookings_data:
        try:
            # Robust date parsing
            try:
                check_in = datetime.strptime(b.checkIn, "%Y-%m-%d")
            except (ValueError, TypeError):
                try:
                     # Try ISO format or split by T
                     check_in = datetime.strptime(b.checkIn.split('T')[0], "%Y-%m-%d")
                except:
                     try:
                        # Fallback to timestamp if it's there
                        check_in = datetime.fromtimestamp(b.timestamp / 1000)
                     except:
                        continue # Skip if date is totally unparseable

            try:
                check_out = datetime.strptime(b.checkOut, "%Y-%m-%d")
            except (ValueError, TypeError):
                try:
                     check_out = datetime.strptime(b.checkOut.split('T')[0], "%Y-%m-%d")
                except:
                     check_out = check_in + timedelta(days=1)
            
            nights = max((check_out - check_in).days, 1)

            # Calculate actual paid amount from payments instead of booking total
            amount = 0
            if b.payments:
                for p in b.payments:
                    # p is a Payment object (Pydantic)
                    if p.status == 'Completed':
                        amount += p.amount
            
            # Fallback (optional): if no payments recorded but status is CheckedOut/Settled, maybe assume full amount? 
            # User specifically asked for "actual amount paid", so 0 is correct if no payments are recorded.
            
            raw_source = b.source or 'Direct'
            source_key = raw_source.lower().replace('.', '').replace('bookingcom', 'bcom').replace('makemytrip', 'mmt').replace('expedia', 'exp').replace('direct', 'dir')
            if source_key not in ['mmt', 'bcom', 'exp', 'dir']: source_key = 'dir'

            # YTD / 1Y Logic
            if check_in >= year_start:
                total_revenue_ytd += amount
                total_bookings_ytd += 1
                total_nights_ytd += nights
                revenue_by_source_1y[source_key] += amount
                total_rev_1y += amount
                
                bookings_by_source[source_key] += 1
                
                # Room Type Logic (only for YTD)
                rt_name = room_types.get(b.roomTypeId, 'Unknown')
                room_type_popularity[rt_name] += 1
            
            # 6 Months Logic
            if check_in >= six_months_ago:
                revenue_by_source_6m[source_key] += amount
                total_rev_6m += amount

            # 1 Month Logic
            if check_in >= one_month_ago:
                revenue_by_source_1m[source_key] += amount
                total_rev_1m += amount

            # Historical Trends
            day_str = check_in.strftime("%Y-%m-%d")
            week_str = f"W{check_in.isocalendar()[1]} {check_in.year}"
            month_str = check_in.strftime("%b %Y")

            daily_revenue[day_str][source_key] += amount
            weekly_revenue[week_str][source_key] += amount
            monthly_revenue[month_str][source_key] += amount
            
            monthly_counts[month_str][source_key] += 1

        except Exception as e:
            print(f"Error processing booking {b.id}: {e}")
            continue

    # Format trends for frontend
    def format_trend(trend_dict, limit=12):
        sorted_keys = sorted(trend_dict.keys())[-limit:]
        return [{
            "label": k,
            "channels": trend_dict[k],
            "total": sum(trend_dict[k].values())
        } for k in sorted_keys]

    def format_share(source_dict, total):
        return [
            {"name": "Booking.com", "value": round((source_dict['bcom'] / total * 100), 1) if total > 0 else 0, "color": "bg-blue-500", "hex": "#3b82f6"},
            {"name": "MakeMyTrip", "value": round((source_dict['mmt'] / total * 100), 1) if total > 0 else 0, "color": "bg-red-500", "hex": "#ef4444"},
            {"name": "Expedia", "value": round((source_dict['exp'] / total * 100), 1) if total > 0 else 0, "color": "bg-yellow-500", "hex": "#eab308"},
            {"name": "Direct", "value": round((source_dict['dir'] / total * 100), 1) if total > 0 else 0, "color": "bg-emerald-500", "hex": "#10b981"},
        ]

    avg_daily_rate = total_revenue_ytd / total_nights_ytd if total_nights_ytd > 0 else 0

    return {
        "summary": {
            "totalRevenueYTD": total_revenue_ytd,
            "totalBookingsYTD": total_bookings_ytd,
            "avgDailyRate": round(avg_daily_rate, 2),
            "revenueGrowth": 12.5,
            "bookingsGrowth": 8.2, 
            "adrGrowth": -1.2
        },
        "revenueShare": {
            "1y": format_share(revenue_by_source_1y, total_rev_1y),
            "6m": format_share(revenue_by_source_6m, total_rev_6m),
            "1m": format_share(revenue_by_source_1m, total_rev_1m)
        },
        "trends": {
            "daily": format_trend(daily_revenue, 14),
            "weekly": format_trend(weekly_revenue, 12),
            "monthly": format_trend(monthly_revenue, 12)
        },
        "popularity": {
            "roomTypes": [{"name": k, "value": v} for k, v in room_type_popularity.items()] or [{"name": "None", "value": 0}],
            "bookingTrend": format_trend(monthly_counts, 6)
        }
    }

@app.get("/api/reports/bookings")
def generate_booking_report(
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    channels: Optional[str] = None,
    db=Depends(get_db)
):
    bookings_data = []
    if USE_DATABASE() and db:
        try:
            bookings_db = db.query(BookingDB).all()
            for b_db in bookings_db:
                 try:
                    bookings_data.append(db_booking_to_pydantic(b_db))
                 except: pass
        except: pass
    else:
        bookings_data = get_fallback_bookings()
    
    filtered = []
    selected_channels = [c.strip() for c in channels.split(',')] if channels and channels != 'null' else ['All']
    if 'All' in selected_channels: selected_channels = ['All']
    
    for b in bookings_data:
        # Date Filter
        if startDate and startDate != 'undefined' and startDate != '':
             if b.checkIn < startDate: continue
        if endDate and endDate != 'undefined' and endDate != '':
             if b.checkOut > endDate: continue
        
        # Channel Filter
        if 'All' not in selected_channels and b.source not in selected_channels: continue
        
        filtered.append(b)

    # Generate PDF
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=10)
    
    # Title
    pdf.set_font("Arial", 'B', 16)
    pdf.cell(190, 10, txt="Bookings", ln=True, align='C')
    pdf.set_font("Arial", size=10)
    pdf.cell(190, 10, txt=f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", ln=True, align='C')
    pdf.ln(10)
    
    # Filters applied
    filter_str = f"Start: {startDate or 'Any'} | End: {endDate or 'Any'} | Channels: {', '.join(selected_channels)}"
    pdf.set_font("Arial", 'I', 8)
    pdf.cell(190, 8, txt=filter_str, ln=True, align='L')
    pdf.ln(5)

    # Table Header
    headers = ["ID", "Name", "Source", "Check-In", "Out", "Bill", "Paid"]
    col_widths = [30, 45, 20, 25, 25, 25, 20]
    
    pdf.set_font("Arial", 'B', 9)
    # Header bg color
    pdf.set_fill_color(240, 240, 240)
    for i, h in enumerate(headers):
        pdf.cell(col_widths[i], 8, h, 1, 0, 'C', True)
    pdf.ln()
    
    # Rows
    pdf.set_font("Arial", size=8)
    total_bill = 0
    total_paid = 0
    
    for b in filtered:
        paid = 0
        if b.payments:
            for p in b.payments:
                if p.status == 'Completed':
                     paid += p.amount
        
        total_bill += (b.amount or 0)
        total_paid += paid
        
        b_id = str(b.id)[:12]
        b_name = b.guestName[:22]
        
        row_data = [
            b_id,
            b_name,
            b.source[:10],
            b.checkIn,
            b.checkOut,
            f"{b.amount or 0:,.0f}",
            f"{paid:,.0f}"
        ]
        
        for i, data in enumerate(row_data):
            align = 'R' if i >= 5 else 'L'
            pdf.cell(col_widths[i], 8, str(data), 1, 0, align)
        pdf.ln()
        
    # Totals
    pdf.ln(5)
    pdf.set_font("Arial", 'B', 10)
    pdf.cell(sum(col_widths[:5]), 10, "Totals:", 0, 0, 'R')
    pdf.cell(col_widths[5], 10, f"{total_bill:,.0f}", 1, 0, 'R')
    pdf.cell(col_widths[6], 10, f"{total_paid:,.0f}", 1, 0, 'R')
    
    # Output
    # Handle Vercel /tmp or local
    out_dir = "/tmp" if os.path.exists("/tmp") else "."
    report_path = os.path.join(out_dir, f"report_{uuid.uuid4().hex}.pdf")
    pdf.output(report_path)
    
    return FileResponse(report_path, filename=f"Booking_List_{datetime.now().strftime('%Y%m%d')}.pdf", media_type='application/pdf')

def generate_upfront_folio_for_booking(booking: Booking, db) -> list:
    """Generates the whole stay's room logic from checkIn to checkOut as folio items."""
    import uuid
    from datetime import datetime, timedelta
    from backend.db_models import RoomTypeDB, PropertySettingsDB
    
    existing_folio = [f.dict() for f in booking.folio] if booking.folio else []
    
    clean_folio = []
    for f in existing_folio:
        desc = f.get('description', '')
        if "Daily Room Rent" in desc or "Extra Adult Charge" in desc or "Extra Child Charge" in desc or "Extra Bed Charge" in desc:
            continue
        clean_folio.append(f)
        
    try:
        prop_res = db.query(PropertySettingsDB).filter(PropertySettingsDB.id == 'default').first()
        prop_gst = prop_res.gst_rate if prop_res and prop_res.gst_rate is not None else 12.0
        
        rt_db = db.query(RoomTypeDB).filter(RoomTypeDB.id == booking.roomTypeId).first()
        if not rt_db:
            return existing_folio
            
        d_start = datetime.strptime(booking.checkIn, '%Y-%m-%d').date()
        d_end = datetime.strptime(booking.checkOut, '%Y-%m-%d').date()
        total_nights = (d_end - d_start).days
        if total_nights < 1: total_nights = 1
        
        nightly_total_incl = (booking.amount or 0) / total_nights
        if nightly_total_incl <= 0: nightly_total_incl = rt_db.base_price or 0
        
        e_adult_c_incl = (booking.extraAdults or 0) * (rt_db.extra_adult_rate or 0)
        e_child_c_incl = (booking.extraChildren or 0) * (rt_db.extra_child_rate or 0)
        e_bed_c_incl = (booking.extraBeds or 0) * (rt_db.extra_bed_charge or 0)
        
        extras_sum_incl = e_adult_c_incl + e_child_c_incl + e_bed_c_incl
        room_only_incl = nightly_total_incl - extras_sum_incl
        if room_only_incl < 0:
            room_only_incl = nightly_total_incl
            e_adult_c_incl = e_child_c_incl = e_bed_c_incl = 0
            
        curr_d = d_start
        while curr_d < d_end:
            date_key = curr_d.strftime('%Y-%m-%d')
            
            clean_folio.append({
                "id": f"folio-room-{str(uuid.uuid4())[:8]}",
                "description": f"Daily Room Rent ({date_key})",
                "amount": round(room_only_incl, 2),
                "category": "Room",
                "isPaid": False,
                "isInclusive": True,
                "date": date_key
            })
            if e_adult_c_incl > 0:
                clean_folio.append({
                    "id": f"folio-ext-a-{str(uuid.uuid4())[:8]}",
                    "description": f"Extra Adult Charge ({date_key})",
                    "amount": round(e_adult_c_incl, 2),
                    "category": "Room",
                    "isPaid": False,
                    "isInclusive": True,
                    "date": date_key
                })
            if e_child_c_incl > 0:
                clean_folio.append({
                    "id": f"folio-ext-c-{str(uuid.uuid4())[:8]}",
                    "description": f"Extra Child Charge ({date_key})",
                    "amount": round(e_child_c_incl, 2),
                    "category": "Room",
                    "isPaid": False,
                    "isInclusive": True,
                    "date": date_key
                })
            if e_bed_c_incl > 0:
                clean_folio.append({
                    "id": f"folio-ext-b-{str(uuid.uuid4())[:8]}",
                    "description": f"Extra Bed Charge ({date_key})",
                    "amount": round(e_bed_c_incl, 2),
                    "category": "Room",
                    "isPaid": False,
                    "isInclusive": True,
                    "date": date_key
                })
            curr_d += timedelta(days=1)
            
        return clean_folio
    except Exception as e:
        logger.error(f"Error generating upfront folio: {e}")
        return existing_folio

@app.post("/api/bookings")
def create_booking(booking: Booking, db=Depends(get_db)):
    db_available = USE_DATABASE()
    logger.info(f"POST /api/bookings - ID: {booking.id}, Guest: {booking.guestName}, DB Available: {db_available}")
    
    if db_available and db:
        try:
            if booking.guestDetails:
                profile_id = _sync_guest_profile(booking.guestDetails, booking.checkIn, db)
                if profile_id:
                    # Update the Pydantic model's guestDetails before converting to DB model
                    booking.guestDetails.profileId = profile_id

            db_booking = BookingDB(
                id=booking.id,
                room_type_id=booking.roomTypeId,
                room_number=booking.roomNumber,
                guest_name=booking.guestName,
                source=booking.source,
                status=booking.status,
                timestamp=booking.timestamp or int(datetime.now().timestamp() * 1000),
                check_in=booking.checkIn,
                check_out=booking.checkOut,
                amount=booking.amount,
                reservation_id=booking.reservationId,
                channel_sync=booking.channelSync or {},
                guest_details=booking.guestDetails.dict() if booking.guestDetails else None,
                number_of_rooms=booking.numberOfRooms or 1,
                pax=booking.pax or 1,
                folio=generate_upfront_folio_for_booking(booking, db),
                discount=booking.discount,
                extra_adults=booking.extraAdults or 0,
                extra_children=booking.extraChildren or 0,
                extra_beds=booking.extraBeds or 0,
                special_requests=booking.specialRequests,
                accessory_guests=[g.dict() for g in booking.accessoryGuests] if booking.accessoryGuests else [],
                is_vip=booking.isVIP or False,
                is_settled=booking.isSettled or False
            )
            db.add(db_booking)
            db.commit()
            db.refresh(db_booking)
            
            # Create notification for new booking
            create_notification_internal(
                db,
                notif_type="reservation",
                category="new_booking",
                title="New Reservation",
                message=f"{booking.guestName or 'Guest'} arriving {booking.checkIn} - Room {booking.roomNumber or 'Unassigned'}",
                priority="normal",
                booking_id=booking.id,
                room_number=booking.roomNumber
            )
            db.commit()
            
            logger.info(f"✓ Successfully saved booking {booking.id} to PostgreSQL")
            return db_booking_to_pydantic(db_booking)
        except Exception as e:
            logger.error(f"CRITICAL: Failed to save booking {booking.id} to PostgreSQL: {e}")
            if db: db.rollback()
            # If we are in DB mode, don't silently fallback to memory as it leads to "disappearing" data
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    
    # Fallback (Only happens if USE_DATABASE() is False)
    logger.warning(f"⚠️ Saving booking {booking.id} to IN-MEMORY FALLBACK (it may disappear on restart)")
    get_fallback_bookings().append(booking)
    return booking

@app.post("/api/bookings/bulk")
def create_bulk_bookings(bookings: List[Booking], db=Depends(get_db)):
    if USE_DATABASE() and db:
        try:
            db_bookings = []
            for booking in bookings:
                # Basic availability check (server-side)
                # Skip conflict check for 'Unassigned' rooms to allow multi-room unassigned bookings
                if booking.roomNumber and booking.roomNumber != 'Unassigned':
                    conflict = db.query(BookingDB).filter(
                        BookingDB.room_number == booking.roomNumber,
                        BookingDB.status.notin_(['Cancelled', 'Rejected', 'CheckedOut']),
                        BookingDB.check_in < booking.checkOut,
                        BookingDB.check_out > booking.checkIn
                    ).first()
                    
                    if conflict:
                        raise HTTPException(status_code=409, detail=f"Room {booking.roomNumber} is already occupied for these dates.")

                if booking.guestDetails:
                    profile_id = _sync_guest_profile(booking.guestDetails, booking.checkIn, db)
                    if profile_id:
                        # Update the Pydantic model's guestDetails before converting to DB model
                        if booking.guestDetails: # Check again to be safe
                            booking.guestDetails.profileId = profile_id

                db_booking = BookingDB(
                    id=booking.id,
                    room_type_id=booking.roomTypeId,
                    room_number=booking.roomNumber,
                    guest_name=booking.guestName,
                    source=booking.source,
                    status=booking.status,
                    timestamp=booking.timestamp,
                    check_in=booking.checkIn,
                    check_out=booking.checkOut,
                    reservation_id=booking.reservationId,
                    channel_sync=booking.channelSync or {},
                    amount=booking.amount,
                    rejection_reason=booking.rejectionReason,
                    guest_details=booking.guestDetails.dict() if booking.guestDetails else None,
                    number_of_rooms=booking.numberOfRooms,
                    pax=booking.pax,
                    accessory_guests=[g.dict() for g in booking.accessoryGuests] if booking.accessoryGuests else [],
                    extra_beds=booking.extraBeds,
                    special_requests=booking.specialRequests,
                    is_vip=booking.isVIP or False,
                    folio=generate_upfront_folio_for_booking(booking, db),
                    discount=booking.discount,
                    extra_adults=booking.extraAdults or 0,
                    extra_children=booking.extraChildren or 0,
                    is_settled=booking.isSettled or False
                )
                db_bookings.append(db_booking)
            
            for db_b in db_bookings:
                db.add(db_b)
            
            db.commit()
            
            try:
                # Create notifications for each booking in the bulk request
                for db_b in db_bookings:
                    create_notification_internal(
                        db,
                        notif_type="reservation",
                        category="new_booking",
                        title="New Reservation",
                        message=f"{db_b.guest_name or 'Guest'} arriving {db_b.check_in} - Room {db_b.room_number or 'Unassigned'}",
                        priority="normal",
                        booking_id=db_b.id,
                        room_number=db_b.room_number
                    )
                
                # If it's a multi-room booking, add a summary notification
                if len(db_bookings) > 1:
                    first_b = db_bookings[0]
                    create_notification_internal(
                        db,
                        notif_type="reservation",
                        category="bulk_booking",
                        title="Bulk Booking Created",
                        message=f"Group booking for {first_b.guest_name} ({len(db_bookings)} rooms) created",
                        priority="high",
                        booking_id=first_b.id
                    )
                
                db.commit()
            except Exception as e:
                print(f"Error creating bulk notifications: {e}")
                db.rollback()
            
            return [db_booking_to_pydantic(db_b) for db_b in db_bookings]
        except Exception as e:
            db.rollback()
            if isinstance(e, HTTPException): raise e
            raise HTTPException(status_code=500, detail=str(e))
    
    # Fallback
    for b in bookings:
        get_fallback_bookings().append(b)
    return bookings

@app.put("/api/bookings/{booking_id}")
def update_booking(booking_id: str, booking: Booking, db=Depends(get_db)):
    try:
        if USE_DATABASE() and db:
            db_booking = db.query(BookingDB).filter(BookingDB.id == booking_id).first()
            if not db_booking:
                raise HTTPException(status_code=404, detail="Booking not found")
            
            # Track old status for notification triggers
            old_status = db_booking.status
            new_status = booking.status

            # Apply late check-in adjustment rule for unpaid direct bookings
            if old_status == 'Confirmed' and new_status == 'CheckedIn':
                # Rule: Only for Direct Bookings with NO payments (sum <= 0)
                total_paid = sum(p.get('amount', 0) for p in (db_booking.payments or []))
                if db_booking.source == 'Direct' and total_paid <= 0:
                    # Use current date (server time)
                    today_str = datetime.now().strftime('%Y-%m-%d')
                    
                    # Check if today is after the scheduled check-in
                    if today_str > db_booking.check_in:
                        try:
                            d_start = datetime.strptime(db_booking.check_in, '%Y-%m-%d')
                            d_end = datetime.strptime(db_booking.check_out, '%Y-%m-%d')
                            d_today = datetime.strptime(today_str, '%Y-%m-%d')
                            
                            old_nights = (d_end - d_start).days
                            new_nights = (d_end - d_today).days
                            
                            if old_nights > 0 and new_nights > 0:
                                # Adjust the incoming 'booking' object so it gets saved to DB correctly
                                # Get room type to check base price for heuristic
                                from backend.db_models import RoomTypeDB
                                rt_item = db.query(RoomTypeDB).filter(RoomTypeDB.id == db_booking.room_type_id).first()
                                
                                rate_per_night = (db_booking.amount or 0) / old_nights
                                
                                # Heuristic: If rate_per_night is suspiciously low but 'amount' matches base price
                                if rt_item and rt_item.base_price > 0 and old_nights > 1:
                                    if rate_per_night < rt_item.base_price * 0.6 and abs((db_booking.amount or 0) - rt_item.base_price) < rt_item.base_price * 0.3:
                                        rate_per_night = db_booking.amount or 0

                                booking.checkIn = today_str
                                booking.amount = rate_per_night * new_nights
                                logger.info(f"Late check-in adjustment: {db_booking.guest_name} from {old_nights} nights starting {db_booking.check_in} to {new_nights} nights starting {today_str}. New amount: {booking.amount}")


                        except Exception as e:
                            logger.error(f"Error adjusting late check-in: {e}")
            
            # Save or update guest profile whenever guest details are present
            if booking.guestDetails:
                updated_gd = booking.guestDetails.dict()
                if booking.guestDetails.name and booking.guestDetails.phoneNumber:
                    profile_id = _sync_guest_profile(booking.guestDetails, booking.checkIn, db)
                    if profile_id:
                        updated_gd['profileId'] = profile_id
                db_booking.guest_details = updated_gd

            # Track folio count
            old_folio_count = len(db_booking.folio or [])
            new_folio_count = len(booking.folio or [])

            # Update fields
            db_booking.room_type_id = booking.roomTypeId
            db_booking.room_number = booking.roomNumber
            db_booking.guest_name = booking.guestName
            db_booking.status = booking.status
            db_booking.check_in = booking.checkIn
            db_booking.check_out = booking.checkOut
            db_booking.amount = booking.amount
            db_booking.reservation_id = booking.reservationId
            db_booking.channel_sync = booking.channelSync or {}
            db_booking.number_of_rooms = booking.numberOfRooms
            db_booking.pax = booking.pax
            db_booking.accessory_guests = [g.dict() for g in booking.accessoryGuests] if booking.accessoryGuests else []
            db_booking.extra_beds = booking.extraBeds
            db_booking.extra_adults = booking.extraAdults or 0
            db_booking.extra_children = booking.extraChildren or 0
            db_booking.special_requests = booking.specialRequests
            db_booking.is_vip = booking.isVIP or False
            db_booking.is_settled = booking.isSettled or False
            db_booking.invoice_number = booking.invoiceNumber
            db_booking.folio = generate_upfront_folio_for_booking(booking, db)
            db_booking.payments = [p.dict() for p in booking.payments] if booking.payments else []
            db_booking.discount = booking.discount
            
            import time
            db_booking.timestamp = int(time.time() * 1000)

            db.commit()
            db.refresh(db_booking)

            # Notification Logic with nested try/except to avoid rolling back booking update
            try:
                if new_folio_count > old_folio_count:
                    last_item = booking.folio[-1]
                    skip_keywords = ["Extra Bed", "Extra Adult", "Extra Child"]
                    if not any(kw in last_item.description for kw in skip_keywords):
                        create_notification_internal(db, 
                            notif_type="housekeeping" if last_item.category == 'Laundry' else "guest_request",
                            category="service_order",
                            title=f"New {last_item.category} Order",
                            message=f"Order for {last_item.description} (₹{last_item.amount}) received from Room {booking.roomNumber}",
                            priority="normal",
                            booking_id=booking_id,
                            room_number=booking.roomNumber
                        )
                        db.commit()

                if old_status != new_status:
                    guest_name = booking.guestName or 'Guest'
                    room_info = f"Room {booking.roomNumber}" if booking.roomNumber else ""
                    
                    if new_status == 'CheckedIn':
                        create_notification_internal(db, notif_type="checkin", category="guest_arrival", title="Guest Checked In",
                            message=f"{guest_name} has checked in to {room_info}", priority="high", booking_id=booking_id, room_number=booking.roomNumber)
                    elif new_status == 'CheckedOut':
                        create_notification_internal(db, notif_type="checkout", category="guest_departure", title="Guest Checked Out",
                            message=f"{guest_name} has checked out from {room_info}", priority="normal", booking_id=booking_id, room_number=booking.roomNumber)
                        if booking.roomNumber and booking.roomNumber != 'Unassigned':
                            try:
                                from sqlalchemy import text
                                exists = db.execute(text("SELECT 1 FROM room_status WHERE room_number = :rn"), {"rn": booking.roomNumber}).fetchone()
                                now_ts = datetime.now().isoformat()
                                if exists:
                                    db.execute(text("UPDATE room_status SET status = 'Dirty' WHERE room_number = :rn"), {"rn": booking.roomNumber})
                                else:
                                    db.execute(text("INSERT INTO room_status (room_number, status, priority, last_cleaned) VALUES (:rn, 'Dirty', 'Medium', :ts)"), {"rn": booking.roomNumber, "ts": now_ts})
                            except: pass
                    elif new_status == 'Cancelled':
                        create_notification_internal(db, notif_type="reservation", category="cancellation", title="Booking Cancelled",
                            message=f"Reservation for {guest_name} ({booking.checkIn}) has been cancelled", priority="high", booking_id=booking_id, room_number=booking.roomNumber)
                    db.commit()
            except Exception as e:
                logger.error(f"Error creating notification: {e}")
                # Don't rollback everything - booking update is already committed
                try: db.rollback() 
                except: pass

            return db_booking_to_pydantic(db_booking)
            
        else: # Handle Fallback
            fallback = get_fallback_bookings()
            idx = next((i for i, b in enumerate(fallback) if b.id == booking_id), -1)
            if idx >= 0:
                # Update status
                old_b = fallback[idx]
                updated_b = booking
                fallback[idx] = updated_b
                save_fallback_bookings(fallback)
                return updated_b
            raise HTTPException(status_code=404, detail="Booking not found in fallback")

    except Exception as e:
        logger.error(f"FATAL ERROR in update_booking: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to update booking: {str(e)}")

@app.post("/api/bookings/{booking_id}/folio")
def add_folio_item(booking_id: str, item: FolioItem, db=Depends(get_db)):
    if USE_DATABASE() and db:
        db_booking = db.query(BookingDB).filter(BookingDB.id == booking_id).first()
        if not db_booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        
        current_folio = db_booking.folio or []
        if isinstance(current_folio, str):
            current_folio = json.loads(current_folio)
        
        current_folio.append(item.dict())
        db_booking.folio = current_folio
        
        # Update timestamp to trigger sync
        import time
        db_booking.timestamp = int(time.time() * 1000)
        
        db.commit()
        db.refresh(db_booking)
        
        # Create notification (skip internal charge items)
        skip_keywords = ["Extra Bed", "Extra Adult", "Extra Child"]
        if not any(kw in (item.description or "") for kw in skip_keywords):
            create_notification_internal(
                db,
                notif_type="housekeeping" if item.category == 'Laundry' else "guest_request",
                category="service_order",
                title=f"New {item.category} Order",
                message=f"Order for {item.description} ({item.amount}) received from Room {db_booking.room_number}",
                priority="normal",
                booking_id=booking_id,
                room_number=db_booking.room_number,
                metadata=item.metadata
            )
            db.commit()
        
        return db_booking_to_pydantic(db_booking)
    
    raise HTTPException(status_code=501, detail="Not implemented in fallback mode")

@app.get("/api/db-status")
def db_status():
    """Check database connection status and environment variables"""
    import os
    db_vars = {
        "DATABASE_URL": "YES" if os.getenv("DATABASE_URL") else "NO",
        "POSTGRES_URL": "YES" if os.getenv("POSTGRES_URL") else "NO",
        "NEON_DATABASE_URL": "YES" if os.getenv("NEON_DATABASE_URL") else "NO",
    }
    
    status = "disconnected"
    message = "Not connected"
    
    if USE_DATABASE():
        status = "connected"
        message = "Connected to database"
    else:
        message = _db_connection_error or "Connection failed (no error captured)"
        
    return {
        "status": status,
        "message": message,
        "env_vars": db_vars
    }

@app.post("/api/bookings/{booking_id}/transfer")
def transfer_booking(booking_id: str, transfer: RoomTransferRequest, db=Depends(get_db)):
    if USE_DATABASE() and db:
        db_booking = db.query(BookingDB).filter(BookingDB.id == booking_id).first()
        if not db_booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        
        # If effectiveDate is the same as check_in, it's a full transfer (just update room)
        if transfer.effectiveDate == db_booking.check_in:
            db_booking.room_type_id = transfer.newRoomTypeId
            db_booking.room_number = transfer.newRoomNumber
            
            if not transfer.keepRate:
                rt = db.query(RoomTypeDB).filter(RoomTypeDB.id == transfer.newRoomTypeId).first()
                if rt:
                    db_booking.amount = rt.base_price
            
            import time
            db_booking.timestamp = int(time.time() * 1000)
            db.commit()
            db.refresh(db_booking)
            return db_booking_to_pydantic(db_booking)
        
        # Mid-stay split (Room Switch)
        import uuid
        import time
        new_id = f"switch-{str(uuid.uuid4())[:8]}"
        res_id = db_booking.reservation_id or f"res-{db_booking.id}"
        
        # Calculate rates
        new_amount = db_booking.amount
        if not transfer.keepRate:
            rt = db.query(RoomTypeDB).filter(RoomTypeDB.id == transfer.newRoomTypeId).first()
            if rt:
                new_amount = rt.base_price

        # Handle folio transfer
        new_folio = []
        if transfer.transferFolio:
            import json
            raw_folio = db_booking.folio or []
            if isinstance(raw_folio, str):
                raw_folio = json.loads(raw_folio)
            
            # Identify current (soon to be previous) room type
            old_rt = db.query(RoomTypeDB).filter(RoomTypeDB.id == db_booking.room_type_id).first()
            old_rt_name = old_rt.name if old_rt else "Std"
            
            for item in raw_folio:
                desc = item.get('description', '')
                origin_suffix = f" (from {old_rt_name})"
                if origin_suffix not in desc:
                    item['description'] = f"{desc}{origin_suffix}"
                new_folio.append(item)
            
            db_booking.folio = []

        new_booking = BookingDB(
            id=new_id,
            room_type_id=transfer.newRoomTypeId,
            room_number=transfer.newRoomNumber,
            guest_name=db_booking.guest_name,
            source=db_booking.source,
            status=db_booking.status,
            timestamp=int(time.time() * 1000),
            check_in=transfer.effectiveDate,
            check_out=db_booking.check_out,
            amount=new_amount,
            reservation_id=res_id,
            folio=new_folio,
            guest_details=db_booking.guest_details,
            number_of_rooms=db_booking.number_of_rooms,
            pax=db_booking.pax,
            accessory_guests=db_booking.accessory_guests,
            channel_sync=db_booking.channel_sync,
            extra_beds=db_booking.extra_beds,
            extra_adults=db_booking.extra_adults,
            extra_children=db_booking.extra_children,
            special_requests=db_booking.special_requests,
            is_vip=db_booking.is_vip,
            discount=db_booking.discount,
            is_settled=db_booking.is_settled
        )
        
        db_booking.check_out = transfer.effectiveDate
        db_booking.reservation_id = res_id
        
        db.add(new_booking)
        db.commit()
        db.refresh(new_booking)
        return db_booking_to_pydantic(new_booking)
    raise HTTPException(status_code=400, detail="Database mode required for transfers")

@app.post("/api/bookings/{booking_id}/checkout")
def checkout_booking(booking_id: str, db=Depends(get_db)):
    if not USE_DATABASE() or not db:
        raise HTTPException(status_code=400, detail="Database required for checkout processing")
    
    booking = db.query(BookingDB).filter(BookingDB.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    prop = db.query(PropertySettingsDB).filter(PropertySettingsDB.id == "default").first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property settings not found")
        
    import os
    import time
    from datetime import datetime, timedelta
    from backend.billing_utils import generate_invoice_pdf, generate_receipt_pdf

    # --- DURATION ADJUSTMENT LOGIC ---
    try:
        # Parse dates
        check_in_date = datetime.strptime(booking.check_in, "%Y-%m-%d").date()
        orig_check_out = datetime.strptime(booking.check_out, "%Y-%m-%d").date()
        original_nights = (orig_check_out - check_in_date).days
        if original_nights < 1: original_nights = 1

        # Current checkout info
        # Note: In a real app, ensure timezone awareness. Here relying on system time.
        now = datetime.now()
        current_date = now.date()
        current_time_str = now.strftime("%H:%M")
        
        # Determine "effective" checkout date based on time
        cutoff_time = prop.check_out_time or "11:00"
        
        # Logic: If checking out AFTER cutoff time, charge for the current night too.
        # This effectively means the checkout date (billing wise) moves to tomorrow.
        
        effective_checkout_date = current_date
        
        # If we are strictly after the cutoff time, increment checkout date
        if current_time_str > cutoff_time:
             effective_checkout_date = current_date + timedelta(days=1)
        
        # Ensure we don't have a checkout before or on checkin (minimum 1 night)
        if effective_checkout_date <= check_in_date:
            effective_checkout_date = check_in_date + timedelta(days=1)

        # Calculate actual nights
        actual_nights = (effective_checkout_date - check_in_date).days
        
        # Update Booking Amount if duration changed
        # We only auto-adjust if the amount seems to be based on nights (simple logic)
        # or we just enforce the rate. For now, we scale linearly.
        if actual_nights != original_nights and original_nights > 0:
             rate_per_night = booking.amount / original_nights
             new_amount = rate_per_night * actual_nights
             
             # Apply updates
             booking.check_out = effective_checkout_date.strftime("%Y-%m-%d")
             booking.amount = new_amount
             print(f"Checkout adjusted: {original_nights} -> {actual_nights} nights. New Amount: {new_amount}")

    except Exception as e:
        print(f"Warning: Failed to recalculate checkout duration: {e}")

    # Generate Invoice Number
    year = time.strftime("%Y")
    new_serial = (prop.last_invoice_number or 0) + 1
    invoice_num = f"INV-{year}-{new_serial:04d}"
    
    # Update Property Settings
    prop.last_invoice_number = new_serial
    
    # Update Booking
    booking.invoice_number = invoice_num
    booking.status = "CheckedOut"
    booking.is_settled = True # Finalized
    
    # Reflect zero balance (mark all folio as paid)
    current_folio = booking.folio or []
    if isinstance(current_folio, str):
        import json
        current_folio = json.loads(current_folio)
    
    for item in current_folio:
        if not item.get('isPaid'):
            item['isPaid'] = True
            item['paymentMethod'] = 'Settled'
    
    booking.folio = current_folio
    
    # 1. Consolidated Stay logic
    res_id = booking.reservation_id
    related_bookings = []
    if res_id:
        related_bookings = db.query(BookingDB).filter(BookingDB.reservation_id == res_id).all()
    else:
        related_bookings = [booking]
        
    # Sort stay history by check-in date
    related_bookings.sort(key=lambda b: b.check_in)
    
    all_folio = []
    all_payments = []
    stay_history = []
    
    for rb in related_bookings:
        # Aggregate Folio
        rb_folio = rb.folio or []
        if isinstance(rb_folio, str):
            rb_folio = json.loads(rb_folio)
        for item in rb_folio:
            # Tag the item with room number and type for clarity on unified invoice
            rb_rt = db.query(RoomTypeDB).filter(RoomTypeDB.id == rb.room_type_id).first()
            rt_name = rb_rt.name if rb_rt else "Std"
            prefix = f"R{rb.room_number} ({rt_name}): "
            
            if not any(x in item.get('description', '') for x in [f"R{rb.room_number}", prefix]):
                item['description'] = f"{prefix}{item.get('description')}"
            all_folio.append(item)
            
        # Aggregate Payments
        rb_payments = rb.payments or []
        if isinstance(rb_payments, str):
            rb_payments = json.loads(rb_payments)
        for p in rb_payments:
            all_payments.append(p)
            
        # Create Stay Segment Record (for PDF room revenue section)
        rb_rt = db.query(RoomTypeDB).filter(RoomTypeDB.id == rb.room_type_id).first()
        rt_name = rb_rt.name if rb_rt else "Standard"
        
        # Mark if this is a "Previous Room Type" relative to the current checkout booking
        label_prefix = ""
        if rb.id != booking.id:
            label_prefix = "[PREVIOUS] "

        stay_history.append({
            "bookingId": rb.id,
            "roomNumber": rb.room_number,
            "roomTypeName": f"{label_prefix}{rt_name}",
            "checkIn": rb.check_in,
            "checkOut": rb.check_out,
            "amount": rb.amount,
            "discount": rb.discount,
            "status": rb.status
        })
    
    # Prepare data for PDF
    booking_pydantic = db_booking_to_pydantic(booking)
    prop_pydantic = db_property_to_pydantic(prop)
    
    booking_dict = booking_pydantic.dict()
    # Replace single-booking folio/payments with stay-wide consolidated lists
    booking_dict['folio'] = all_folio
    booking_dict['payments'] = all_payments
    booking_dict['stayHistory'] = stay_history
    
    # Add room type name for PDF (main room)
    rt = db.query(RoomTypeDB).filter(RoomTypeDB.id == booking.room_type_id).first()
    booking_dict['roomTypeName'] = rt.name if rt else "Standard"
    
    prop_dict = prop_pydantic.dict()
    
    # PDF paths
    os.makedirs("Billing", exist_ok=True)
    invoice_path = f"Billing/Invoice_{invoice_num}.pdf"
    receipt_path = f"Billing/Receipt_{invoice_num}.pdf"
    
    try:
        generate_invoice_pdf(booking_dict, prop_dict, invoice_num, invoice_path)
        
        # Check if paid across the whole stay
        total_paid = sum(p['amount'] for p in all_payments if p.get('status') == 'Completed')
        # We also count paid folio items (high resiliency fallback)
        total_paid += sum(f.get('amount', 0) for f in all_folio if f.get('isPaid') and not f.get('paymentId'))
        
        if total_paid > 0:
            generate_receipt_pdf(booking_dict, prop_dict, invoice_num, receipt_path)
            
        # Save paths to DB
        booking.invoice_path = invoice_path
        if total_paid > 0:
            booking.receipt_path = receipt_path
            
        db.commit()
        return {
            "status": "success", 
            "invoiceNumber": invoice_num,
            "invoicePath": invoice_path,
            "receiptPath": receipt_path if total_paid > 0 else None
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Checkout failed: {str(e)}")


# ========== NOTIFICATIONS API ==========
import uuid

def db_notification_to_pydantic(db_notif):
    """Convert NotificationDB to Pydantic Notification model"""
    return Notification(
        id=db_notif.id,
        type=db_notif.type,
        category=db_notif.category,
        title=db_notif.title,
        message=db_notif.message,
        priority=db_notif.priority,
        isRead=db_notif.is_read,
        isDismissed=db_notif.is_dismissed,
        createdAt=db_notif.created_at,
        readAt=db_notif.read_at,
        bookingId=db_notif.booking_id,
        roomNumber=db_notif.room_number,
        metadata=db_notif.extra_data or {}
    )

def create_notification_internal(db, notif_type: str, category: str, title: str, message: str, 
                                 priority: str = "normal", booking_id: str = None, 
                                 room_number: str = None, metadata: dict = None):
    """Helper function to create a notification from within other endpoints - uses existing session"""
    if not (USE_DATABASE() and db):
        return None
    
    try:
        # Use ORM instead of raw SQL to avoid manual connection management
        notif = NotificationDB(
            id=f"notif-{str(uuid.uuid4())[:8]}",
            type=notif_type,
            category=category,
            title=title,
            message=message,
            priority=priority,
            is_read=False,
            is_dismissed=False,
            created_at=datetime.now(timezone.utc).isoformat(),
            booking_id=booking_id,
            room_number=room_number,
            metadata=metadata or {}
        )
        db.add(notif)
        # We don't commit here, let the calling endpoint handle the commit
        # or we flush to get the ID if needed
        db.flush()
        return notif.id
    except Exception as e:
        print(f"Error creating notification: {e}")
        return None

def audit_no_shows():
    """Background-style check for guests who haven't checked in on time"""
    import os
    import json
    from datetime import datetime, timezone
    
    db_url = get_db_url()
    if not db_url:
        return
        
    try:
        from sqlalchemy import create_engine, text
        from sqlalchemy.pool import NullPool
        engine = create_engine(db_url, poolclass=NullPool)
        
        # Current local date
        today_str = datetime.now().strftime('%Y-%m-%d')
        
        # Query for no-shows: 
        # 1. Status is Confirmed
        # 2. Check-in was BEFORE today
        # 3. Stay is MORE than 1 night
        query = text("""
            SELECT id, guest_name, check_in, check_out, room_number 
            FROM bookings 
            WHERE status = 'Confirmed' 
            AND check_in < :today
            AND (TO_DATE(check_out, 'YYYY-MM-DD') - TO_DATE(check_in, 'YYYY-MM-DD')) > 1
        """)
        
        with engine.connect() as conn:
            result = conn.execute(query, {"today": today_str})
            no_shows = result.fetchall()
            
            for b_id, guest_name, check_in, check_out, room_number in no_shows:
                # Check for existing warning to avoid duplicates
                check_notif = text("""
                    SELECT id FROM notifications 
                    WHERE category = 'no_show_warning' 
                    AND booking_id = :b_id 
                    AND is_dismissed = FALSE 
                    LIMIT 1
                """)
                existing = conn.execute(check_notif, {"b_id": b_id}).fetchone()
                
                if not existing:
                    notif_id = f"notif-ns-{str(uuid.uuid4())[:8]}"
                    now_iso = datetime.now(timezone.utc).isoformat()
                    msg = f"Guest {guest_name} was scheduled to arrive on {check_in} for a multi-day stay but has not checked in. Should this booking be canceled?"
                    
                    conn.execute(text("""
                        INSERT INTO notifications (id, type, category, title, message, priority, is_read, is_dismissed, created_at, booking_id, room_number)
                        VALUES (:id, :type, :category, :title, :message, :priority, :is_read, :is_dismissed, :created_at, :b_id, :room_number)
                    """), {
                        "id": notif_id,
                        "type": "system",
                        "category": "no_show_warning",
                        "title": "No-Show Warning",
                        "message": msg,
                        "priority": "high",
                        "is_read": False,
                        "is_dismissed": False,
                        "created_at": now_iso,
                        "b_id": b_id,
                        "room_number": room_number
                    })
            conn.commit()
    except Exception as e:
        print(f"Error in no-show audit: {e}")

def audit_late_checkouts():
    """Check for guests who are still checked in past their checkout time and create notification for approval."""
    import os
    import json
    import uuid
    import time
    from datetime import datetime, timedelta, timezone
    
    db_url = get_db_url()
    if not db_url: return
    
    try:
        from sqlalchemy import create_engine, text
        from sqlalchemy.pool import NullPool
        engine = create_engine(db_url, poolclass=NullPool)
        
        now = datetime.now()
        today_str = now.strftime('%Y-%m-%d')
        current_time_str = now.strftime('%H:%M')
        
        with engine.connect() as conn:
            # 1. Get checkout time from property settings
            prop_res = conn.execute(text("SELECT check_out_time FROM property_settings WHERE id = 'default'")).fetchone()
            checkout_cutoff = prop_res[0] if prop_res and prop_res[0] else "11:00"
            
            # Only run if we are strictly past the cutoff time today
            if current_time_str <= checkout_cutoff:
                return
            
            # 2. Find Checked-In bookings where check_out <= today
            # These guests are still in-house past their scheduled departure time
            query = text("""
                SELECT id, guest_name, check_in, check_out, amount, folio, room_number, room_type_id 
                FROM bookings 
                WHERE status = 'CheckedIn' AND check_out <= :today
            """)
            result = conn.execute(query, {"today": today_str})
            late_bookings = result.fetchall()
            
            for b_id, guest_name, b_check_in, b_check_out, b_amount, b_folio, b_room_number, b_room_type_id in late_bookings:
                # Prevent duplicate approval notifications for the same day
                notif_check = conn.execute(text("""
                    SELECT id FROM notifications 
                    WHERE booking_id = :bid 
                    AND category = 'late_checkout_approval' 
                    AND created_at LIKE :date_prefix
                """), {"bid": b_id, "date_prefix": f"{today_str}%"}).fetchone()
                
                if notif_check:
                    continue

                # Also check if already charged (fallback)
                folio = b_folio or []
                if isinstance(folio, str):
                    folio = json.loads(folio)
                
                charge_tag = f"Late Checkout Charge ({today_str})"
                # Prevent double-charging if the audit runs multiple times in the same day
                if any(item.get('description') == charge_tag for item in folio):
                    continue
                
                # Calculate daily rate (heuristic: total base amount / original nights)
                try:
                    d1 = datetime.strptime(b_check_in, '%Y-%m-%d')
                    d2 = datetime.strptime(b_check_out, '%Y-%m-%d')
                    nights = (d2 - d1).days
                    if nights <= 0: nights = 1
                    rate = (b_amount or 0) / nights
                except:
                    # Fallback to room type base price
                    rt_res = conn.execute(text("SELECT base_price FROM room_types WHERE id = :rtid"), {"rtid": b_room_type_id}).fetchone()
                    rate = rt_res[0] if rt_res else 0
                
                # Create a system notification to ask staff
                notif_id = f"notif-lc-req-{str(uuid.uuid4())[:8]}"
                now_iso = datetime.now(timezone.utc).isoformat()
                msg = f"Guest {guest_name} (Room {b_room_number}) has not checked out by {checkout_cutoff}. Add late checkout charge of {rate}?"
                
                # Metadata for the action
                metadata = {
                    "actionType": "approve_late_charge",
                    "chargeAmount": rate,
                    "bookingId": b_id,
                    "chargeDescription": charge_tag,
                    "newCheckoutDate": (datetime.strptime(b_check_out, '%Y-%m-%d') + timedelta(days=1)).strftime('%Y-%m-%d')
                }
                
                conn.execute(text("""
                    INSERT INTO notifications (id, type, category, title, message, priority, is_read, is_dismissed, created_at, booking_id, room_number, metadata)
                    VALUES (:id, 'system', 'late_checkout_approval', 'Late Checkout Charge Approval', :msg, 'high', FALSE, FALSE, :ca, :bid, :rn, :md)
                """), {
                    "id": notif_id,
                    "msg": msg,
                    "ca": now_iso,
                    "bid": b_id,
                    "rn": b_room_number,
                    "md": json.dumps(metadata)
                })
            
            conn.commit()
    except Exception as e:
        print(f"Error in late checkout audit: {e}")

def audit_daily_charges():
    """Post daily room and extra person/bed charges to folio for in-house guests."""
    return # DISABLED: Charges are now posted upfront via generate_upfront_folio_for_booking
    import json
    import uuid
    import time
    from datetime import datetime, timedelta, timezone
    
    db_url = get_db_url()
    if not db_url: return
    
    try:
        from sqlalchemy import create_engine, text
        from sqlalchemy.pool import NullPool
        engine = create_engine(db_url, poolclass=NullPool)
        
        now = datetime.now()
        today_date = now.date()
        current_time_str = now.strftime('%H:%M')
        
        with engine.connect() as conn:
            # 1. Get property settings for taxes and checkout time
            prop_res = conn.execute(text("SELECT check_out_time, gst_rate FROM property_settings WHERE id = 'default'")).fetchone()
            checkout_cutoff = prop_res[0] if prop_res and prop_res[0] else "11:00"
            prop_gst = prop_res[1] if prop_res and prop_res[1] is not None else 12.0
            
            # 2. Only run past checkout hour
            if current_time_str < checkout_cutoff:
                return
            
            # 3. Find CheckedIn bookings
            query = text("""
                SELECT b.id, b.guest_name, b.check_in, b.check_out, b.amount, b.folio, b.room_number,
                       rt.base_price, rt.extra_adult_rate, rt.extra_child_rate, rt.extra_bed_charge,
                       b.extra_adults, b.extra_children, b.extra_beds, b.room_type_id
                FROM bookings b
                LEFT JOIN room_types rt ON b.room_type_id = rt.id
                WHERE b.status = 'CheckedIn'
            """)
            result = conn.execute(query)
            active_bookings = result.fetchall()
            
            for row in active_bookings:
                b_id, guest_name, b_check_in, b_check_out, b_amount, b_folio, b_room_num, \
                rt_base, rt_ext_adult, rt_ext_child, rt_ext_bed_c, \
                b_ext_adults, b_ext_children, b_ext_beds, b_rt_id = row

                folio = b_folio or []
                if isinstance(folio, str):
                    folio = json.loads(folio)

                try:
                    d_start = datetime.strptime(b_check_in, '%Y-%m-%d').date()
                    d_end = datetime.strptime(b_check_out, '%Y-%m-%d').date()
                    
                    # Target: today + 1 (as requested: "on second day add for next day")
                    target_date = today_date + timedelta(days=1)
                    curr_d = d_start
                    folio_updated = False
                    
                    while curr_d < d_end and curr_d <= target_date:
                        date_key = curr_d.strftime('%Y-%m-%d')
                        charge_tag = f"Daily Room Rent ({date_key})"
                        
                        # Check if already posted
                        if not any(item.get('description') == charge_tag for item in folio):
                            total_nights = (d_end - d_start).days
                            if total_nights <= 0: total_nights = 1
                            
                            # Booking amount is assumed INCLUSIVE
                            nightly_total_incl = (b_amount or 0) / total_nights
                            if nightly_total_incl <= 0: nightly_total_incl = rt_base or 0
                            
                            # Convert to EXCLUSIVE for folio posting
                            # Base room tax is prop_gst
                            # Extras also usually use base stay tax or other_gst? 
                            # Usually room extras use room tax.
                            
                            nightly_total_excl = nightly_total_incl / (1 + prop_gst / 100)
                            
                            # Breakdown
                            e_adult_c_incl = (b_ext_adults or 0) * (rt_ext_adult or 0)
                            e_child_c_incl = (b_ext_children or 0) * (rt_ext_child or 0)
                            e_bed_c_incl = (b_ext_beds or 0) * (rt_ext_bed_c or 0)
                            
                            extras_sum_incl = e_adult_c_incl + e_child_c_incl + e_bed_c_incl
                            room_only_incl = nightly_total_incl - extras_sum_incl
                            
                            if room_only_incl < 0:
                                room_only_incl = nightly_total_incl
                                e_adult_c_incl = e_child_c_incl = e_bed_c_incl = 0
                            
                            # Post Inclusive amounts as requested
                            folio.append({
                                "id": f"folio-room-{str(uuid.uuid4())[:8]}",
                                "description": charge_tag,
                                "amount": round(room_only_incl, 2),
                                "category": "Room",
                                "isPaid": False,
                                "isInclusive": True,
                                "date": date_key
                            })
                            
                            if e_adult_c_incl > 0:
                                folio.append({
                                    "id": f"folio-ext-a-{str(uuid.uuid4())[:8]}",
                                    "description": f"Extra Adult Charge ({date_key})",
                                    "amount": round(e_adult_c_incl, 2),
                                    "category": "Room",
                                    "isPaid": False,
                                    "isInclusive": True,
                                    "date": date_key
                                })
                            if e_child_c_incl > 0:
                                folio.append({
                                    "id": f"folio-ext-c-{str(uuid.uuid4())[:8]}",
                                    "description": f"Extra Child Charge ({date_key})",
                                    "amount": round(e_child_c_incl, 2),
                                    "category": "Room",
                                    "isPaid": False,
                                    "isInclusive": True,
                                    "date": date_key
                                })
                            if e_bed_c_incl > 0:
                                folio.append({
                                    "id": f"folio-ext-b-{str(uuid.uuid4())[:8]}",
                                    "description": f"Extra Bed Charge ({date_key})",
                                    "amount": round(e_bed_c_incl, 2),
                                    "category": "Room",
                                    "isPaid": False,
                                    "isInclusive": True,
                                    "date": date_key
                                })
                            
                            folio_updated = True
                        
                        curr_d += timedelta(days=1)
                        
                    if folio_updated:
                        conn.execute(text("UPDATE bookings SET folio = :nf, timestamp = :ts WHERE id = :id"), {
                            "nf": json.dumps(folio),
                            "ts": int(time.time() * 1000),
                            "id": b_id
                        })
                except Exception as e:
                    print(f"Error processing daily charge for {b_id}: {e}")
            
            conn.commit()
    except Exception as e:
        print(f"Error in daily charge audit: {e}")

# Automated Audit Throttling
LAST_AUDIT_RUN = 0
AUDIT_COOLDOWN = 1800 # 30 minutes

def run_audits():
    """Trigger automated audits with cooldown to prevent database overload."""
    global LAST_AUDIT_RUN
    now = time.time()
    if now - LAST_AUDIT_RUN < AUDIT_COOLDOWN:
        return
    
    LAST_AUDIT_RUN = now
    print(">>> Starting background property audits...")
    try:
        audit_no_shows()
        audit_late_checkouts()
        audit_daily_charges()
        print(">>> Audits completed.")
    except Exception as e:
        print(f">>> Audits failed: {e}")

@app.get("/api/notifications")
def get_notifications(background_tasks: BackgroundTasks, unread_only: bool = False, type_filter: str = None, limit: int = 50, history_mode: bool = False):
    """Get notifications with optional filters. history_mode=True fetches dismissed notifications."""
    import os
    
    # Run audit logic in background with throttling
    background_tasks.add_task(run_audits)
    
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        return []
    
    try:
        from sqlalchemy import create_engine, text
        from sqlalchemy.pool import NullPool
        
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
        
        engine = create_engine(db_url, poolclass=NullPool)
        
        # Build query
        # IF history_mode is True, we want DISMISSED items.
        # IF history_mode is False, we want ACTIVE (non-dismissed) items.
        sql = "SELECT id, type, category, title, message, priority, is_read, is_dismissed, created_at, read_at, booking_id, room_number, metadata FROM notifications WHERE 1=1"
        
        if history_mode:
            sql += " AND is_dismissed = TRUE"
        else:
            sql += " AND is_dismissed = FALSE"
        
        if unread_only:
            sql += " AND is_read = FALSE"
        if type_filter:
            sql += f" AND type = '{type_filter}'"
        
        sql += " ORDER BY created_at DESC LIMIT :limit"
        
        with engine.connect() as conn:
            result = conn.execute(text(sql), {"limit": limit})
            rows = result.fetchall()
        
        # Convert to dict format
        notifications = []
        for row in rows:
            notifications.append({
                "id": row[0],
                "type": row[1],
                "category": row[2],
                "title": row[3],
                "message": row[4],
                "priority": row[5],
                "isRead": row[6],
                "isDismissed": row[7],
                "createdAt": row[8],
                "readAt": row[9],
                "bookingId": row[10],
                "roomNumber": row[11],
                "metadata": row[12] or {}
            })
        
        return notifications
    except Exception as e:
        print(f"Error fetching notifications: {e}")
        return []

@app.get("/api/notifications/unread-count")
def get_unread_notification_count(background_tasks: BackgroundTasks):
    """Get count of unread notifications"""
    import os
    
    # Run audits periodically in background
    background_tasks.add_task(run_audits)
    
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        return {"count": 0}
    
    try:
        from sqlalchemy import create_engine, text
        from sqlalchemy.pool import NullPool
        
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
        
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM notifications WHERE is_read = FALSE AND is_dismissed = FALSE"))
            count = result.scalar()
        
        return {"count": count or 0}
    except Exception as e:
        print(f"Error counting notifications: {e}")
        return {"count": 0}

@app.post("/api/notifications")
def create_notification(notification: NotificationCreate, db=Depends(get_db)):
    """Create a new notification"""
    if not USE_DATABASE() or not db:
        raise HTTPException(status_code=503, detail="Database not available")
    
    notif_id = f"notif-{str(uuid.uuid4())[:8]}"
    
    new_notif = NotificationDB(
        id=notif_id,
        type=notification.type,
        category=notification.category,
        title=notification.title,
        message=notification.message,
        priority=notification.priority,
        is_read=False,
        is_dismissed=False,
        created_at=datetime.now(timezone.utc).isoformat(),
        booking_id=notification.bookingId,
        room_number=notification.roomNumber,
        extra_data=notification.metadata or {}
    )
    
    db.add(new_notif)
    db.commit()
    db.refresh(new_notif)
    
    return db_notification_to_pydantic(new_notif)

@app.put("/api/notifications/{notification_id}/read")
def mark_notification_read(notification_id: str):
    """Mark a single notification as read"""
    import os
    from datetime import datetime, timezone
    
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        from sqlalchemy import create_engine, text
        from sqlalchemy.pool import NullPool
        
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
        
        engine = create_engine(db_url, poolclass=NullPool)
        now = datetime.now(timezone.utc).isoformat()
        
        with engine.connect() as conn:
            result = conn.execute(
                text("UPDATE notifications SET is_read = TRUE, read_at = :read_at WHERE id = :id"),
                {"id": notification_id, "read_at": now}
            )
            conn.commit()
            
            if result.rowcount == 0:
                raise HTTPException(status_code=404, detail="Notification not found")
        
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/notifications/{notification_id}/action")
def handle_notification_action(notification_id: str, action: str):
    """Handle interactive actions on notifications (e.g. approving a late checkout charge)"""
    import os
    import json
    import uuid
    import time
    from datetime import datetime, timedelta, timezone
    
    db_url = get_db_url()
    if not db_url:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        from sqlalchemy import create_engine, text
        from sqlalchemy.pool import NullPool
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as conn:
            # 1. Get the notification and its metadata
            notif = conn.execute(text("SELECT metadata, booking_id, is_dismissed FROM notifications WHERE id = :id"), {"id": notification_id}).fetchone()
            if not notif:
                raise HTTPException(status_code=404, detail="Notification not found")
            
            if notif[2]: # is_dismissed
                return {"status": "ignored", "message": "Action already processed or dismissed"}
            
            metadata = notif[0]
            if isinstance(metadata, str):
                metadata = json.loads(metadata)
            
            if not metadata or metadata.get("actionType") != "approve_late_charge":
                raise HTTPException(status_code=400, detail="Invalid action for this notification")
            
            if action == "yes":
                # Execute the charge
                b_id = metadata.get("bookingId")
                charge_amount = metadata.get("chargeAmount")
                charge_desc = metadata.get("chargeDescription")
                new_checkout = metadata.get("newCheckoutDate")
                
                # Get current booking data
                booking = conn.execute(text("SELECT amount, folio, guest_name, room_number FROM bookings WHERE id = :id"), {"id": b_id}).fetchone()
                if not booking:
                    raise HTTPException(status_code=404, detail="Booking not found")
                
                amount = booking[0] or 0
                folio = booking[1] or []
                if isinstance(folio, str):
                    folio = json.loads(folio)
                
                guest_name = booking[2]
                room_number = booking[3]
                
                # Add folio item
                new_item = {
                    "id": f"folio-{str(uuid.uuid4())[:8]}",
                    "description": charge_desc,
                    "amount": charge_amount,
                    "category": "Room Charge",
                    "isPaid": False,
                    "date": datetime.now().strftime('%Y-%m-%d')
                }
                folio.append(new_item)
                
                # Update booking
                conn.execute(text("""
                    UPDATE bookings 
                    SET check_out = :nc, amount = :na, folio = :nf, timestamp = :ts
                    WHERE id = :id
                """), {
                    "nc": new_checkout,
                    "na": amount + charge_amount,
                    "nf": json.dumps(folio),
                    "ts": int(time.time() * 1000),
                    "id": b_id
                })
                
                # Also create a follow-up notification confirming the action
                confirm_notif_id = f"notif-lc-confirmed-{str(uuid.uuid4())[:8]}"
                now_iso = datetime.now(timezone.utc).isoformat()
                msg = f"Late checkout charge of {charge_amount} applied to {guest_name} (Room {room_number}). Checkout date updated to {new_checkout}."
                
                conn.execute(text("""
                    INSERT INTO notifications (id, type, category, title, message, priority, is_read, is_dismissed, created_at, booking_id, room_number)
                    VALUES (:id, 'system', 'late_checkout', 'Charge Applied', :msg, 'normal', FALSE, FALSE, :ca, :bid, :rn)
                """), {
                    "id": confirm_notif_id,
                    "msg": msg,
                    "ca": now_iso,
                    "bid": b_id,
                    "rn": room_number
                })
            
            # Dismiss the notification regardless of yes/no (user has responded)
            conn.execute(text("UPDATE notifications SET is_read = TRUE, is_dismissed = TRUE WHERE id = :id"), {"id": notification_id})
            conn.commit()
            
            return {"status": "success", "action": action}
            
    except Exception as e:
        print(f"Error handling notification action: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/notifications/dismiss-all")
def mark_all_notifications_read():
    """Mark all notifications as read"""
    import os
    from datetime import datetime, timezone
    
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        from sqlalchemy import create_engine, text
        from sqlalchemy.pool import NullPool
        
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
        
        engine = create_engine(db_url, poolclass=NullPool)
        now = datetime.now(timezone.utc).isoformat()
        
        with engine.connect() as conn:
            conn.execute(
                text("UPDATE notifications SET is_read = TRUE, read_at = :read_at WHERE is_read = FALSE"),
                {"read_at": now}
            )
            conn.commit()
        
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/notifications/{notification_id}")
def dismiss_notification(notification_id: str, db=Depends(get_db)):
    """Dismiss/delete a notification"""
    if not (USE_DATABASE() and db):
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        notif = db.query(NotificationDB).filter(NotificationDB.id == notification_id).first()
        if not notif:
            raise HTTPException(status_code=404, detail="Notification not found")
            
        notif.is_dismissed = True
        db.commit()
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        if db: db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# ========== HOUSEKEEPING API ==========

@app.get("/api/room-status")
def get_room_statuses(db=Depends(get_db)):
    if not (USE_DATABASE() and db): return []
    
    try:
        # Check if table exists first (handling migration lag)
        rows = db.query(RoomStatusDB).all()
        return [
            {
                "roomNumber": r.room_number,
                "status": r.status,
                "priority": r.priority,
                "notes": r.notes,
                "lastCleaned": r.last_cleaned,
                "housekeeper": r.housekeeper
            }
            for r in rows
        ]
    except Exception as e:
        print(f"Error fetching room statuses: {e}")
        return []

@app.post("/api/room-status")
def update_room_status_endpoint(status_data: RoomStatus, db=Depends(get_db)):
    if not (USE_DATABASE() and db): 
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        # Check if exists
        status_entry = db.query(RoomStatusDB).filter(RoomStatusDB.room_number == status_data.roomNumber).first()
        
        if status_entry:
            status_entry.status = status_data.status
            status_entry.priority = status_data.priority
            status_entry.notes = status_data.notes
            status_entry.last_cleaned = status_data.lastCleaned
            status_entry.housekeeper = status_data.housekeeper
        else:
            new_status = RoomStatusDB(
                room_number=status_data.roomNumber,
                status=status_data.status,
                priority=status_data.priority, 
                notes=status_data.notes,
                last_cleaned=status_data.lastCleaned,
                housekeeper=status_data.housekeeper
            )
            db.add(new_status)
            
        db.commit()
        return status_data
    except Exception as e:
        if db: db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# SPA Catch-all: Handled by checking file existence first, otherwise serving index.html
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    # Skip API routes entirely
    if full_path.startswith("api"):
        raise HTTPException(status_code=404)
    
    # 1. Check if the path exists directly in the dist folder (for logo.png, robots.txt, etc)
    dist_file_path = os.path.join("dist", full_path)
    if os.path.exists(dist_file_path) and os.path.isfile(dist_file_path):
        return FileResponse(dist_file_path)
    
    # 2. Otherwise, serve index.html for SPA routing
    index_path = os.path.join("dist", "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    
    return {"message": "Backend is running. Frontend build (dist/) not found. Build the frontend to see the UI."}

if __name__ == "__main__":
    import uvicorn
    # Use PORT env var for Render compat
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, reload=False)

