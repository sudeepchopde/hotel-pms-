from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from collections import defaultdict
import json

# ========== LAZY IMPORTS FOR VERCEL COMPATIBILITY ==========
# These will be populated on first use
_db_imports_loaded = False
_USE_DATABASE = None

# Declare these at module level for DB models (still lazy)
HotelDB = None
RoomTypeDB = None
BookingDB = None
OTAConnectionDB = None
RateRulesDB = None
GuestProfileDB = None
PropertySettingsDB = None
NotificationDB = None

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
    NotificationCreate
)

get_db_real = None
engine = None

def _load_db_imports():
    """Lazy load database imports to avoid import-time failures on Vercel."""
    global _db_imports_loaded, _USE_DATABASE
    global HotelDB, RoomTypeDB, BookingDB, OTAConnectionDB, RateRulesDB, GuestProfileDB, PropertySettingsDB, NotificationDB
    global Hotel, RoomType, Booking, OTAConnection, RateRulesConfig, RoomTransferRequest, GuestProfile, PropertySettings
    global get_db_real, engine
    
    if _db_imports_loaded:
        return _USE_DATABASE
    
    try:
        from backend.database import get_db as _get_db_real
        from backend.database import engine as _engine
        from backend.db_models import (
            HotelDB as _HotelDB, 
            RoomTypeDB as _RoomTypeDB, 
            BookingDB as _BookingDB, 
            OTAConnectionDB as _OTAConnectionDB, 
            RateRulesDB as _RateRulesDB, 
            GuestProfileDB as _GuestProfileDB, 
            PropertySettingsDB as _PropertySettingsDB,
            NotificationDB as _NotificationDB
        )
        
        # Assign to globals
        get_db_real = _get_db_real
        engine = _engine
        HotelDB = _HotelDB
        RoomTypeDB = _RoomTypeDB
        BookingDB = _BookingDB
        OTAConnectionDB = _OTAConnectionDB
        RateRulesDB = _RateRulesDB
        GuestProfileDB = _GuestProfileDB
        PropertySettingsDB = _PropertySettingsDB
        NotificationDB = _NotificationDB
        
        # Test connection and create tables if they don't exist
        from backend.database import Base
        with engine.connect() as conn:
            pass
        Base.metadata.create_all(bind=engine)
        
        _USE_DATABASE = True
        print("✓ Connected to PostgreSQL database")
        
    except Exception as e:
        _USE_DATABASE = False
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

app = FastAPI(title="SyncGuard PMS API")

# Mount Billing folder for PDF access (only if directory can be created)
try:
    os.makedirs("Billing", exist_ok=True)
    app.mount("/billing", StaticFiles(directory="Billing"), name="billing")
except Exception:
    pass  # Skip on Vercel where filesystem is read-only

@app.get("/ping")
def ping():
    return {"status": "ok", "version": "1.1", "database": "lazy"}

@app.get("/api/init-db")
def init_db():
    """Manual trigger to ensure all tables exist - with debug info"""
    import os
    
    # Check which database variables are available
    db_vars = {
        "POSTGRES_URL": "YES" if os.getenv("POSTGRES_URL") else "NO",
        "POSTGRES_PRISMA_URL": "YES" if os.getenv("POSTGRES_PRISMA_URL") else "NO",
        "POSTGRES_URL_NON_POOLING": "YES" if os.getenv("POSTGRES_URL_NON_POOLING") else "NO",
        "DATABASE_URL": "YES" if os.getenv("DATABASE_URL") else "NO",
        "POSTGRES_HOST": "YES" if os.getenv("POSTGRES_HOST") else "NO",
    }
    
    # Try to get any database URL
    db_url = (
        os.getenv("POSTGRES_URL") or 
        os.getenv("POSTGRES_PRISMA_URL") or 
        os.getenv("POSTGRES_URL_NON_POOLING") or
        os.getenv("DATABASE_URL")
    )
    
    if not db_url:
        return {
            "status": "error", 
            "message": "No database URL found",
            "env_vars": db_vars,
            "hint": "Add DATABASE_URL to Vercel Environment Variables"
        }
    
    try:
        from sqlalchemy import create_engine, text
        
        # Fix postgres:// -> postgresql://
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
        
        engine = create_engine(db_url, pool_pre_ping=True)
        
        # Create notifications table directly with raw SQL
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS notifications (
            id VARCHAR(255) PRIMARY KEY,
            type VARCHAR(100) NOT NULL,
            category VARCHAR(100) NOT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            priority VARCHAR(20) DEFAULT 'normal',
            is_read BOOLEAN DEFAULT FALSE,
            is_dismissed BOOLEAN DEFAULT FALSE,
            created_at VARCHAR(50) NOT NULL,
            read_at VARCHAR(50),
            booking_id VARCHAR(255),
            room_number VARCHAR(50),
            metadata JSON DEFAULT '{}'
        );
        """
        
        with engine.connect() as conn:
            conn.execute(text(create_table_sql))
            conn.commit()
        
        return {
            "status": "success", 
            "message": "Notifications table created successfully",
            "env_vars": db_vars
        }
    except Exception as e:
        return {
            "status": "error", 
            "message": str(e),
            "env_vars": db_vars
        }


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
            prompt = "Extract all guest information from this registration form. Return as clean JSON. Only return the JSON."

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
    
    # 1. Deduplication check using MessageID or Subject+From hash
    # We use a stable hash for cases where MessageID isn't provided or changes
    import hashlib
    content_hash = hashlib.md5(f"{email.Subject}{email.From}{email.TextBody[:100] if email.TextBody else ''}".encode()).hexdigest()
    external_ref = email.MessageID or f"hash-{content_hash}"
    
    if USE_DATABASE() and db:
        existing = db.query(BookingDB).filter(BookingDB.external_reference_id == external_ref).first()
        if existing:
            return {"status": "skipped", "message": "Duplicate email detected", "booking_id": existing.id}

    # 2. Get GEMINI API Key
    api_key = None
    if USE_DATABASE() and db:
        prop = db.query(PropertySettingsDB).filter(PropertySettingsDB.id == "default").first()
        if prop and prop.gemini_api_key:
            api_key = prop.gemini_api_key
    if not api_key:
        api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise HTTPException(status_code=400, detail="Gemini API Key for email parsing not configured. Please set it in Property Setup.")

    # 3. Call Gemini to parse
    try:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=api_key)
        
        # We prefer TextBody but can use HTML as fallback
        content_to_parse = email.TextBody or email.HtmlBody or ""
        if not content_to_parse:
             raise HTTPException(status_code=400, detail="Email body is empty")
             
        prompt = """
        Extract reservation details from this hotel booking confirmation email. 
        Return as a clean JSON with these keys:
        - guestName: string
        - checkIn: string (YYYY-MM-DD)
        - checkOut: string (YYYY-MM-DD)
        - amount: number (total price)
        - source: string ('Booking.com', 'MMT', 'Expedia', or 'Direct')
        - roomTypeRaw: string (e.g., 'Deluxe AC Room')
        - numberOfRooms: number
        - pax: number
        
        Only return the JSON.
        """

        # List of models to try
        models_to_try = [
            'gemini-1.5-flash',
            'gemini-flash-latest',
            'gemini-1.5-flash-8b',
            'gemini-2.0-flash'
        ]
        
        response = None
        last_err = None
        
        for model_name in models_to_try:
            try:
                print(f"Attempting Email Parsing with model: {model_name}")
                response = client.models.generate_content(
                    model=model_name,
                    contents=[prompt, content_to_parse]
                )
                if response and response.text:
                    break
            except Exception as e:
                print(f"Model {model_name} failed for email parsing: {e}")
                last_err = e
        
        if not response or not response.text:
             raise last_err or HTTPException(status_code=500, detail="All AI models failed to parse email content")
                   
        # Clean JSON from markdown wrap
        json_text = response.text
        if "```json" in json_text:
            json_text = json_text.split("```json")[1].split("```")[0]
        elif "```" in json_text:
            json_text = json_text.split("```")[1].split("```")[0]
        
        parsed_data = json.loads(json_text.strip())
        
        # 4. Map Room Type
        room_type_id = None
        if USE_DATABASE() and db:
            all_rts = db.query(RoomTypeDB).all()
            raw_room = parsed_data.get('roomTypeRaw', '').lower()
            
            # 1st pass: Exact or containing match
            for rt in all_rts:
                if rt.name.lower() in raw_room or raw_room in rt.name.lower():
                    room_type_id = rt.id
                    break
            
            # 2nd pass: Default to first one if none found
            if not room_type_id and all_rts:
                room_type_id = all_rts[0].id

        # 5. Create Booking
        new_id = f"RES-{str(uuid.uuid4())[:8].upper()}"
        
        new_booking = BookingDB(
            id=new_id,
            room_type_id=room_type_id or "rt-1", 
            room_number="Unassigned", # Needs manual assignment on Front Desk
            guest_name=parsed_data.get('guestName', 'Parsed Guest'),
            source=parsed_data.get('source', 'Direct'),
            status="Confirmed",
            timestamp=int(time.time() * 1000),
            check_in=parsed_data.get('checkIn'),
            check_out=parsed_data.get('checkOut'),
            amount=parsed_data.get('amount'),
            number_of_rooms=parsed_data.get('numberOfRooms', 1),
            pax=parsed_data.get('pax', 2),
            is_auto_generated=True,
            external_reference_id=external_ref
        )
        
        if USE_DATABASE() and db:
            db.add(new_booking)
            db.commit()
            db.refresh(new_booking)
            return {"status": "success", "booking": db_booking_to_pydantic(new_booking)}
        
        return {"status": "success", "parsed": parsed_data}

    except Exception as e:
        print(f"Email parsing failed: {e}")
        import traceback
        traceback.print_exc()
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
    return []

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
        extraBedCharge=db_room.extra_bed_charge
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
    
    return Booking(
        id=db_booking.id,
        roomTypeId=db_booking.room_type_id,
        roomNumber=db_booking.room_number,
        guestName=db_booking.guest_name,
        source=db_booking.source,
        status=db_booking.status,
        timestamp=db_booking.timestamp,
        checkIn=db_booking.check_in,
        checkOut=db_booking.check_out,
        reservationId=db_booking.reservation_id,
        channelSync=db_booking.channel_sync or {},
        amount=db_booking.amount,
        rejectionReason=db_booking.rejection_reason,
        guestDetails=db_booking.guest_details,
        numberOfRooms=db_booking.number_of_rooms,
        pax=db_booking.pax,
        accessoryGuests=safe_json_list(db_booking.accessory_guests),
        extraBeds=db_booking.extra_beds,
        specialRequests=db_booking.special_requests,
        isVIP=db_booking.is_vip,
        isSettled=db_booking.is_settled,
        invoiceNumber=db_booking.invoice_number,
        invoicePath=db_booking.invoice_path,
        receiptPath=db_booking.receipt_path,
        isAutoGenerated=getattr(db_booking, 'is_auto_generated', False),
        externalReferenceId=getattr(db_booking, 'external_reference_id', None),
        folio=safe_json_list(db_booking.folio),
        payments=safe_json_list(db_booking.payments)
    )

def db_connection_to_pydantic(db_conn):
    _load_db_imports()
    return OTAConnection(
        id=db_conn.id,
        name=db_conn.name,
        key=db_conn.key,
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
        razorpayKeySecret=db_prop.razorpay_key_secret if hasattr(db_prop, 'razorpay_key_secret') else None,
        publicBaseUrl=db_prop.public_base_url if hasattr(db_prop, 'public_base_url') else None,
        geminiApiKey=db_prop.gemini_api_key if hasattr(db_prop, 'gemini_api_key') else None,
        lastInvoiceNumber=db_prop.last_invoice_number if hasattr(db_prop, 'last_invoice_number') else 0,
        checkInTime=db_prop.check_in_time if hasattr(db_prop, 'check_in_time') else "12:00",
        checkOutTime=db_prop.check_out_time if hasattr(db_prop, 'check_out_time') else "11:00",
        loyaltyTiers=db_prop.loyalty_tiers if hasattr(db_prop, 'loyalty_tiers') else []
    )

def _sync_guest_profile(gd, check_in_date, db):
    """Helper to sync GuestDetails with GuestProfileDB"""
    if not gd or not gd.name or not gd.phoneNumber:
        return None
        
    existing_profile = None
    if gd.profileId:
        existing_profile = db.query(GuestProfileDB).filter(GuestProfileDB.id == gd.profileId).first()
    
    if not existing_profile:
        # Try exact name + phone match first
        existing_profile = db.query(GuestProfileDB).filter(
            GuestProfileDB.name == gd.name,
            GuestProfileDB.phone_number == gd.phoneNumber
        ).first()
        
    if not existing_profile:
        # Fallback to phone number only (useful for slight name variations)
        existing_profile = db.query(GuestProfileDB).filter(
            GuestProfileDB.phone_number == gd.phoneNumber
        ).order_by(GuestProfileDB.last_check_in.desc()).first()
        
    if existing_profile:
        # Update...
        if gd.idType: existing_profile.id_type = gd.idType
        if gd.idNumber: existing_profile.id_number = gd.idNumber
        if gd.address: existing_profile.address = gd.address
        if gd.dob: existing_profile.dob = gd.dob
        if gd.nationality: existing_profile.nationality = gd.nationality
        if gd.gender: existing_profile.gender = gd.gender
        if gd.email: existing_profile.email = gd.email
        if gd.passportNumber: existing_profile.passport_number = gd.passportNumber
        if gd.passportPlaceIssue: existing_profile.passport_place_issue = gd.passportPlaceIssue
        if gd.passportIssueDate: existing_profile.passport_issue_date = gd.passportIssueDate
        if gd.passportExpiry: existing_profile.passport_expiry = gd.passportExpiry
        if gd.visaNumber: existing_profile.visa_number = gd.visaNumber
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
        # Create...
        new_profile = GuestProfileDB(
            name=gd.name,
            phone_number=gd.phoneNumber or "",
            id_type=gd.idType,
            id_number=gd.idNumber,
            address=gd.address,
            dob=gd.dob,
            nationality=gd.nationality,
            gender=gd.gender,
            email=gd.email,
            passport_number=gd.passportNumber,
            passport_place_issue=gd.passportPlaceIssue,
            passport_issue_date=gd.passportIssueDate,
            passport_expiry=gd.passportExpiry,
            visa_number=gd.visaNumber,
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

@app.get("/")
def read_root():
    return {"message": "SyncGuard PMS API", "database": "connected" if USE_DATABASE() else "fallback"}

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
            extra_bed_charge=room_type.extraBedCharge
        )
        db.add(db_room)
        db.commit()
        db.refresh(db_room)
        return db_room_type_to_pydantic(db_room)
    get_fallback_room_types().append(room_type)
    return room_type

@app.put("/api/room-types/{rt_id}")
def update_room_type(rt_id: str, room_type: RoomType, db=Depends(get_db)):
    if USE_DATABASE() and db:
        db_room = db.query(RoomTypeDB).filter(RoomTypeDB.id == rt_id).first()
        if not db_room:
            raise HTTPException(status_code=404, detail="Room Type not found")
        
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
                raise HTTPException(status_code=400, detail=f"Cannot remove room(s) {conflict_rooms} as they have active or future bookings. Please relocate them first.")

        db_room.name = room_type.name
        db_room.total_capacity = room_type.totalCapacity
        db_room.base_price = room_type.basePrice
        db_room.floor_price = room_type.floorPrice
        db_room.ceiling_price = room_type.ceilingPrice
        db_room.base_occupancy = room_type.baseOccupancy
        db_room.amenities = room_type.amenities or []
        db_room.room_numbers = room_type.roomNumbers or []
        db_room.extra_bed_charge = room_type.extraBedCharge
        
        db.commit()
        db.refresh(db_room)
        return db_room_type_to_pydantic(db_room)
    
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
            
        db.delete(db_room)
        db.commit()
        return {"status": "success"}
    
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
        prop.razorpay_key_id = settings.razorpayKeyId
        prop.razorpay_key_secret = settings.razorpayKeySecret
        prop.last_invoice_number = settings.lastInvoiceNumber or 0
        prop.public_base_url = settings.publicBaseUrl
        prop.gemini_api_key = settings.geminiApiKey
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
            query = query.filter(GuestProfileDB.phone_number == phone)
        
        profiles = query.order_by(GuestProfileDB.last_check_in.desc()).all()
        
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
                    "idNumber": profile.id_number,
                    "address": profile.address,
                    "dob": profile.dob,
                    "nationality": profile.nationality,
                    "preferences": profile.preferences,
                    "gender": profile.gender,
                    "passportNumber": profile.passport_number,
                    "passportPlaceIssue": profile.passport_place_issue,
                    "passportIssueDate": profile.passport_issue_date,
                    "passportExpiry": profile.passport_expiry,
                    "visaNumber": profile.visa_number,
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
    if USE_DATABASE() and db:
        bookings = db.query(BookingDB).all()
        return [db_booking_to_pydantic(b) for b in bookings]
    return get_fallback_bookings()

@app.get("/api/statistics")
def get_statistics(db=Depends(get_db)):
    """Fetch aggregated statistics for reports and dashboard"""
    bookings_data = []
    if USE_DATABASE() and db:
        raw_bookings = db.query(BookingDB).filter(BookingDB.status != 'Cancelled').all()
        bookings_data = [db_booking_to_pydantic(b) for b in raw_bookings]
    else:
        bookings_data = [b for b in get_fallback_bookings() if b.status != 'Cancelled']

    # Get Room Types for popularity mapping
    room_types = {}
    if USE_DATABASE() and db:
        raw_rt = db.query(RoomTypeDB).all()
        room_types = {rt.id: rt.name for rt in raw_rt}
    else:
        room_types = {rt.id: rt.name for rt in get_fallback_room_types()}

    now = datetime.now()
    year_start = datetime(now.year, 1, 1)

    total_revenue_ytd = 0
    total_bookings_ytd = 0
    total_nights_ytd = 0
    
    # Aggregations
    revenue_by_source = defaultdict(float)
    bookings_by_source = defaultdict(int)
    room_type_popularity = defaultdict(int)
    
    # Trends
    daily_revenue = defaultdict(lambda: defaultdict(float))
    weekly_revenue = defaultdict(lambda: defaultdict(float))
    monthly_revenue = defaultdict(lambda: defaultdict(float))
    
    monthly_counts = defaultdict(lambda: defaultdict(int))

    for b in bookings_data:
        try:
            check_in = datetime.strptime(b.checkIn, "%Y-%m-%d")
            check_out = datetime.strptime(b.checkOut, "%Y-%m-%d")
            nights = max((check_out - check_in).days, 1)
            amount = b.amount or 0
            
            raw_source = b.source or 'Direct'
            source_key = raw_source.lower().replace('.', '').replace('bookingcom', 'bcom').replace('makemytrip', 'mmt').replace('expedia', 'exp').replace('direct', 'dir')
            if source_key not in ['mmt', 'bcom', 'exp', 'dir']: source_key = 'dir'

            # YTD Logic
            if check_in >= year_start:
                total_revenue_ytd += amount
                total_bookings_ytd += 1
                total_nights_ytd += nights
                revenue_by_source[source_key] += amount
                bookings_by_source[source_key] += 1
                
                # Room Type Logic
                rt_name = room_types.get(b.roomTypeId, 'Unknown')
                room_type_popularity[rt_name] += 1

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
        "revenueShare": [
            {"name": "Booking.com", "value": round((revenue_by_source['bcom'] / total_revenue_ytd * 100), 1) if total_revenue_ytd > 0 else 25.0, "color": "bg-blue-500", "hex": "#3b82f6"},
            {"name": "MakeMyTrip", "value": round((revenue_by_source['mmt'] / total_revenue_ytd * 100), 1) if total_revenue_ytd > 0 else 25.0, "color": "bg-red-500", "hex": "#ef4444"},
            {"name": "Expedia", "value": round((revenue_by_source['exp'] / total_revenue_ytd * 100), 1) if total_revenue_ytd > 0 else 25.0, "color": "bg-yellow-500", "hex": "#eab308"},
            {"name": "Direct", "value": round((revenue_by_source['dir'] / total_revenue_ytd * 100), 1) if total_revenue_ytd > 0 else 25.0, "color": "bg-emerald-500", "hex": "#10b981"},
        ],
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

@app.post("/api/bookings")
def create_booking(booking: Booking, db=Depends(get_db)):
    if USE_DATABASE() and db:
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
            amount=booking.amount,
            reservation_id=booking.reservationId,
            channel_sync=booking.channelSync or {},
            guest_details=booking.guestDetails.dict() if booking.guestDetails else None,
            number_of_rooms=booking.numberOfRooms or 1,
            pax=booking.pax or 1,
            folio=[f.dict() for f in booking.folio] if booking.folio else []
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
        
        return db_booking_to_pydantic(db_booking)
    
    # Fallback
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
                    folio=[f.dict() for f in booking.folio] if booking.folio else []
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
    if USE_DATABASE() and db:
        db_booking = db.query(BookingDB).filter(BookingDB.id == booking_id).first()
        if not db_booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        
        # Track old status for notification triggers
        old_status = db_booking.status
        new_status = booking.status
        
        # Save or update guest profile whenever guest details are present
        if booking.guestDetails and booking.guestDetails.name and booking.guestDetails.phoneNumber:
            profile_id = _sync_guest_profile(booking.guestDetails, booking.checkIn, db)
            if profile_id:
                # Update the guest_details dictionary in the DB model
                updated_gd = booking.guestDetails.dict() if booking.guestDetails else {}
                updated_gd['profileId'] = profile_id
                db_booking.guest_details = updated_gd
        else:
            db_booking.guest_details = None # Clear if no guest details provided

        # Track folio count for service order notifications
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
        # guest_details already handled above
        db_booking.number_of_rooms = booking.numberOfRooms
        db_booking.pax = booking.pax
        db_booking.accessory_guests = [g.dict() for g in booking.accessoryGuests] if booking.accessoryGuests else []
        db_booking.extra_beds = booking.extraBeds
        db_booking.special_requests = booking.specialRequests
        db_booking.is_vip = booking.isVIP or False
        db_booking.is_settled = booking.isSettled or False
        db_booking.invoice_number = booking.invoiceNumber
        db_booking.folio = [f.dict() for f in booking.folio] if booking.folio else []
        db_booking.payments = [p.dict() for p in booking.payments] if booking.payments else []
        
        # Since we are using BigInteger for timestamp, ensure it's an int
        import time
        db_booking.timestamp = int(time.time() * 1000)

        db.commit()
        db.refresh(db_booking)

        # Notification for new folio items (Service Orders)
        if new_folio_count > old_folio_count:
            try:
                last_item = booking.folio[-1]
                create_notification_internal(
                    db,
                    notif_type="housekeeping" if last_item.category == 'Laundry' else "guest_request",
                    category="service_order",
                    title=f"New {last_item.category} Order",
                    message=f"Order for {last_item.description} (₹{last_item.amount}) received from Room {booking.roomNumber}",
                    priority="normal",
                    booking_id=booking_id,
                    room_number=booking.roomNumber
                )
                db.commit()
            except Exception as e:
                print(f"Error creating folio notification: {e}")
                db.rollback()
        
        # Create notifications for status changes
        if old_status != new_status:
            try:
                guest_name = booking.guestName or 'Guest'
                room_info = f"Room {booking.roomNumber}" if booking.roomNumber else ""
                
                if new_status == 'CheckedIn':
                    create_notification_internal(
                        db,
                        notif_type="checkin",
                        category="guest_arrival",
                        title="Guest Checked In",
                        message=f"{guest_name} has checked in to {room_info}",
                        priority="high",
                        booking_id=booking_id,
                        room_number=booking.roomNumber
                    )
                elif new_status == 'CheckedOut':
                    create_notification_internal(
                        db,
                        notif_type="checkout",
                        category="guest_departure",
                        title="Guest Checked Out",
                        message=f"{guest_name} has checked out from {room_info}",
                        priority="normal",
                        booking_id=booking_id,
                        room_number=booking.roomNumber
                    )
                elif new_status == 'Cancelled':
                    create_notification_internal(
                        db,
                        notif_type="reservation",
                        category="cancellation",
                        title="Booking Cancelled",
                        message=f"Reservation for {guest_name} ({booking.checkIn}) has been cancelled",
                        priority="high",
                        booking_id=booking_id,
                        room_number=booking.roomNumber
                    )
                db.commit()
            except Exception as e:
                print(f"Error creating status notification: {e}")
                db.rollback() # Rollback the notification part but booking update was already committed
        
        return db_booking_to_pydantic(db_booking)

@app.get("/api/init-db")
def init_db():
    """Manual trigger to ensure all tables exist - with debug info"""
    import os
    
    # Check which database variables are available
    db_vars = {
        "POSTGRES_URL": "FOUND" if os.getenv("POSTGRES_URL") else "NOT_FOUND",
        "POSTGRES_PRISMA_URL": "FOUND" if os.getenv("POSTGRES_PRISMA_URL") else "NOT_FOUND",
        "POSTGRES_URL_NON_POOLING": "FOUND" if os.getenv("POSTGRES_URL_NON_POOLING") else "NOT_FOUND",
        "DATABASE_URL": "FOUND" if os.getenv("DATABASE_URL") else "NOT_FOUND",
        "POSTGRES_HOST": "FOUND" if os.getenv("POSTGRES_HOST") else "NOT_FOUND",
        "NEON_DATABASE_URL": "FOUND" if os.getenv("NEON_DATABASE_URL") else "NOT_FOUND",
    }
    
    # Try to get any database URL
    db_url = (
        os.getenv("POSTGRES_URL") or 
        os.getenv("POSTGRES_PRISMA_URL") or 
        os.getenv("POSTGRES_URL_NON_POOLING") or
        os.getenv("DATABASE_URL") or
        os.getenv("NEON_DATABASE_URL")
    )
    
    if not db_url:
        return {
            "status": "error", 
            "message": "No database URL found in environment",
            "env_vars": db_vars,
            "hint": "Please add DATABASE_URL to Vercel Environment Variables"
        }
    
    try:
        from sqlalchemy import create_engine
        from sqlalchemy.ext.declarative import declarative_base
        
        # Fix the URL format if needed (postgres:// -> postgresql://)
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
        
        engine = create_engine(db_url, pool_pre_ping=True)
        Base = declarative_base()
        
        # Import models to register them
        import backend.db_models
        from backend.db_models import NotificationDB
        
        # Create tables
        Base.metadata.create_all(bind=engine)
        
        # Also try with our existing Base
        from backend.database import Base as ExistingBase
        ExistingBase.metadata.create_all(bind=engine)
        
        return {
            "status": "success", 
            "message": "Database tables initialized",
            "env_vars": db_vars
        }
    except Exception as e:
        return {
            "status": "error", 
            "message": str(e),
            "env_vars": db_vars
        }
    
    # Fallback
    for i, b in enumerate(get_fallback_bookings()):
        if b.id == booking_id:
            get_fallback_bookings()[i] = booking
            return booking
    raise HTTPException(status_code=404, detail="Booking not found")

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
            new_folio = db_booking.folio
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
            special_requests=db_booking.special_requests,
            is_vip=db_booking.is_vip
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
    
    # Prepare data for PDF
    booking_pydantic = db_booking_to_pydantic(booking)
    prop_pydantic = db_property_to_pydantic(prop)
    
    booking_dict = booking_pydantic.dict()
    # Add room type name for PDF
    rt = db.query(RoomTypeDB).filter(RoomTypeDB.id == booking.room_type_id).first()
    booking_dict['roomTypeName'] = rt.name if rt else "Standard"
    
    prop_dict = prop_pydantic.dict()
    
    # PDF paths
    os.makedirs("Billing", exist_ok=True)
    invoice_path = f"Billing/Invoice_{invoice_num}.pdf"
    receipt_path = f"Billing/Receipt_{invoice_num}.pdf"
    
    try:
        generate_invoice_pdf(booking_dict, prop_dict, invoice_num, invoice_path)
        
        # Check if paid to generate receipt
        total_paid = sum(p['amount'] for p in (booking.payments or []) if p.get('status') == 'Completed')
        # We also count paid folio items
        total_paid += sum(f.get('amount', 0) for f in (booking.folio or []) if f.get('isPaid'))
        
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

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
        metadata=db_notif.metadata or {}
    )

def create_notification_internal(db, notif_type: str, category: str, title: str, message: str, 
                                 priority: str = "normal", booking_id: str = None, 
                                 room_number: str = None, metadata: dict = None):
    """Helper function to create a notification from within other endpoints"""
    if not USE_DATABASE() or not db:
        return None
    
    notif_id = f"notif-{str(uuid.uuid4())[:8]}"
    new_notif = NotificationDB(
        id=notif_id,
        type=notif_type,
        category=category,
        title=title,
        message=message,
        priority=priority,
        is_read=False,
        is_dismissed=False,
        created_at=datetime.now().isoformat(),
        booking_id=booking_id,
        room_number=room_number,
        metadata=metadata or {}
    )
    db.add(new_notif)
    db.flush()
    return notif_id

@app.get("/api/notifications")
def get_notifications(unread_only: bool = False, type_filter: str = None, limit: int = 50, db=Depends(get_db)):
    """Get notifications with optional filters"""
    if not USE_DATABASE() or not db:
        return []
    
    query = db.query(NotificationDB).filter(NotificationDB.is_dismissed == False)
    
    if unread_only:
        query = query.filter(NotificationDB.is_read == False)
    
    if type_filter:
        query = query.filter(NotificationDB.type == type_filter)
    
    notifications = query.order_by(NotificationDB.created_at.desc()).limit(limit).all()
    return [db_notification_to_pydantic(n) for n in notifications]

@app.get("/api/notifications/unread-count")
def get_unread_notification_count(db=Depends(get_db)):
    """Get count of unread notifications"""
    if not USE_DATABASE() or not db:
        return {"count": 0}
    
    count = db.query(NotificationDB).filter(
        NotificationDB.is_read == False,
        NotificationDB.is_dismissed == False
    ).count()
    
    return {"count": count}

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
        created_at=datetime.now().isoformat(),
        booking_id=notification.bookingId,
        room_number=notification.roomNumber,
        metadata=notification.metadata or {}
    )
    
    db.add(new_notif)
    db.commit()
    db.refresh(new_notif)
    
    return db_notification_to_pydantic(new_notif)

@app.put("/api/notifications/{notification_id}/read")
def mark_notification_read(notification_id: str, db=Depends(get_db)):
    """Mark a single notification as read"""
    if not USE_DATABASE() or not db:
        raise HTTPException(status_code=503, detail="Database not available")
    
    notif = db.query(NotificationDB).filter(NotificationDB.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notif.is_read = True
    notif.read_at = datetime.now().isoformat()
    db.commit()
    
    return {"status": "success"}

@app.put("/api/notifications/read-all")
def mark_all_notifications_read(db=Depends(get_db)):
    """Mark all notifications as read"""
    if not USE_DATABASE() or not db:
        raise HTTPException(status_code=503, detail="Database not available")
    
    db.query(NotificationDB).filter(
        NotificationDB.is_read == False
    ).update({
        "is_read": True,
        "read_at": datetime.now().isoformat()
    })
    db.commit()
    
    return {"status": "success"}

@app.delete("/api/notifications/{notification_id}")
def dismiss_notification(notification_id: str, db=Depends(get_db)):
    """Dismiss/delete a notification"""
    if not USE_DATABASE() or not db:
        raise HTTPException(status_code=503, detail="Database not available")
    
    notif = db.query(NotificationDB).filter(NotificationDB.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notif.is_dismissed = True
    db.commit()
    
    return {"status": "success"}
