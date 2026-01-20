from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from sqlalchemy.orm import Session
from backend.models import Hotel, RoomType, Booking, OTAConnection, RateRulesConfig, RoomTransferRequest, PropertySettings

# Database Connection Logic
USE_DATABASE = False

try:
    from backend.database import get_db as get_db_real
    from backend.db_models import HotelDB, RoomTypeDB, BookingDB, OTAConnectionDB, RateRulesDB, GuestProfileDB, PropertySettingsDB
    from backend.models import Hotel, RoomType, Booking, OTAConnection, RateRulesConfig, RoomTransferRequest, GuestProfile, PropertySettings
    
    # Test connection
    from backend.database import engine
    with engine.connect() as conn:
        pass
        
    USE_DATABASE = True
    print("✓ Connected to PostgreSQL database")

    def get_db():
        yield from get_db_real()

except Exception as e:
    USE_DATABASE = False
    print(f"WARNING: Database unavailable, using in-memory data: {e}")
    
    # Dummy dependency when DB is offline
    def get_db():
        yield None

app = FastAPI(title="SyncGuard PMS API")

@app.get("/ping")
def ping():
    return {"status": "ok", "version": "1.1"}


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

# --- Fallback Data ---
FALLBACK_HOTELS = [
    Hotel(
        id='h-1', 
        name='Hotel Satsangi', 
        location='Deoghar', 
        color='indigo', 
        otaConfig={'expedia': 'active', 'booking': 'active', 'mmt': 'active'}
    )
]

FALLBACK_ROOM_TYPES = [
    RoomType(id='rt-1', name='Delux Room (AC)', totalCapacity=10, basePrice=4500, floorPrice=3000, ceilingPrice=8000, baseOccupancy=2, amenities=['WiFi', 'AC', 'TV'], roomNumbers=['101', '102', '103', '104', '105', '106', '107', '108', '109', '110'], extraBedCharge=1200),
    RoomType(id='rt-2', name='Double Bed Room', totalCapacity=10, basePrice=2800, floorPrice=1800, ceilingPrice=5000, baseOccupancy=2, amenities=['WiFi', 'Fan'], roomNumbers=['201', '202', '203', '204', '205', '206', '207', '208', '209', '210'], extraBedCharge=800),
    RoomType(id='rt-3', name='Single Bed Room', totalCapacity=5, basePrice=1800, floorPrice=1200, ceilingPrice=3000, baseOccupancy=1, amenities=['WiFi'], roomNumbers=['301', '302', '303', '304', '305'], extraBedCharge=500),
    RoomType(id='rt-4', name='Dormitory', totalCapacity=3, basePrice=1200, floorPrice=800, ceilingPrice=2500, baseOccupancy=1, amenities=['WiFi', 'Locker'], roomNumbers=['D-1', 'D-2', 'D-3'], extraBedCharge=300),
]

FALLBACK_CONNECTIONS = [
    OTAConnection(id='mmt', name='MakeMyTrip', key='mkmt_live_••••••••7d2f', isVisible=False, status='connected', lastValidated='2 hours ago'),
    OTAConnection(id='booking', name='Booking.com', key='bcom_auth_••••••••a11b', isVisible=False, status='connected', lastValidated='5 mins ago'),
    OTAConnection(id='expedia', name='Expedia', key='', isVisible=False, status='disconnected'),
]

FALLBACK_RULES = RateRulesConfig(
    weeklyRules={'isActive': True, 'activeDays': [5, 6], 'modifierType': 'percentage', 'modifierValue': 1.20},
    specialEvents=[
        {'id': 'ev-1', 'name': 'Diwali Festival', 'startDate': '2025-10-30', 'endDate': '2025-11-05', 'modifierType': 'percentage', 'modifierValue': 1.5},
        {'id': 'ev-2', 'name': 'New Year Eve', 'startDate': '2025-12-30', 'endDate': '2026-01-01', 'modifierType': 'fixed', 'modifierValue': 5000}
    ]
)

FALLBACK_PROPERTY = PropertySettings(
    name='Hotel Satsangi',
    address='Satsang Nagar, Deoghar, Jharkhand 814112',
    phone='+91 98765 43210',
    email='contact@hotelsatsangi.com',
    gstNumber='20ABCDE1234F1Z5',
    gstRate=12.0
)

FALLBACK_BOOKINGS: List[Booking] = []

# --- Converters ---
if USE_DATABASE:
    def db_hotel_to_pydantic(db_hotel) -> Hotel:
        return Hotel(
            id=db_hotel.id,
            name=db_hotel.name,
            location=db_hotel.location,
            color=db_hotel.color,
            otaConfig=db_hotel.ota_config or {}
        )

    def db_room_type_to_pydantic(db_room) -> RoomType:
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

    def db_booking_to_pydantic(db_booking) -> Booking:
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
            folio=safe_json_list(db_booking.folio),
            payments=safe_json_list(db_booking.payments)
        )

    def db_connection_to_pydantic(db_conn) -> OTAConnection:
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

    def db_rules_to_pydantic(db_rules) -> RateRulesConfig:
        return RateRulesConfig(
            weeklyRules=db_rules.weekly_rules or {},
            specialEvents=db_rules.special_events or []
        )

    def db_property_to_pydantic(db_prop) -> PropertySettings:
        return PropertySettings(
            name=db_prop.name,
            address=db_prop.address,
            phone=db_prop.phone,
            email=db_prop.email,
            gstNumber=db_prop.gst_number,
            gstRate=db_prop.gst_rate
        )

@app.get("/")
def read_root():
    return {"message": "SyncGuard PMS API", "database": "connected" if USE_DATABASE else "fallback"}

@app.get("/api/hotels", response_model=List[Hotel])
def get_hotels(db=Depends(get_db)):
    if USE_DATABASE and db:
        hotels = db.query(HotelDB).all()
        return [db_hotel_to_pydantic(h) for h in hotels]
    return FALLBACK_HOTELS

@app.get("/api/room-types", response_model=List[RoomType])
def get_room_types(db=Depends(get_db)):
    if USE_DATABASE and db:
        room_types = db.query(RoomTypeDB).all()
        return [db_room_type_to_pydantic(rt) for rt in room_types]
    return FALLBACK_ROOM_TYPES

@app.post("/api/room-types", response_model=RoomType)
def create_room_type(room_type: RoomType, db=Depends(get_db)):
    if USE_DATABASE and db:
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
    FALLBACK_ROOM_TYPES.append(room_type)
    return room_type

@app.put("/api/room-types/{rt_id}", response_model=RoomType)
def update_room_type(rt_id: str, room_type: RoomType, db=Depends(get_db)):
    if USE_DATABASE and db:
        db_room = db.query(RoomTypeDB).filter(RoomTypeDB.id == rt_id).first()
        if not db_room:
            raise HTTPException(status_code=404, detail="Room Type not found")
        
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
    
    for i, rt in enumerate(FALLBACK_ROOM_TYPES):
        if rt.id == rt_id:
            FALLBACK_ROOM_TYPES[i] = room_type
            return room_type
    raise HTTPException(status_code=404, detail="Room Type not found")

@app.delete("/api/room-types/{rt_id}")
def delete_room_type(rt_id: str, db=Depends(get_db)):
    if USE_DATABASE and db:
        db_room = db.query(RoomTypeDB).filter(RoomTypeDB.id == rt_id).first()
        if not db_room:
            raise HTTPException(status_code=404, detail="Room Type not found")
        
        # Check if there are bookings for this room type
        bookings_count = db.query(BookingDB).filter(BookingDB.room_type_id == rt_id).count()
        if bookings_count > 0:
            raise HTTPException(status_code=400, detail="Cannot delete room type with existing bookings")
            
        db.delete(db_room)
        db.commit()
        return {"status": "success"}
    
    global FALLBACK_ROOM_TYPES
    FALLBACK_ROOM_TYPES = [rt for rt in FALLBACK_ROOM_TYPES if rt.id != rt_id]
    return {"status": "success"}

@app.get("/api/connections", response_model=List[OTAConnection])
def get_connections(db=Depends(get_db)):
    if USE_DATABASE and db:
        connections = db.query(OTAConnectionDB).all()
        return [db_connection_to_pydantic(c) for c in connections]
    return FALLBACK_CONNECTIONS

@app.get("/api/rules", response_model=RateRulesConfig)
def get_rules(db=Depends(get_db)):
    if USE_DATABASE and db:
        rules = db.query(RateRulesDB).filter(RateRulesDB.id == "default").first()
        if not rules:
            return FALLBACK_RULES
        return db_rules_to_pydantic(rules)
    return FALLBACK_RULES

@app.get("/api/property", response_model=PropertySettings)
def get_property_settings(db=Depends(get_db)):
    if USE_DATABASE and db:
        prop = db.query(PropertySettingsDB).filter(PropertySettingsDB.id == "default").first()
        if not prop:
            return FALLBACK_PROPERTY
        return db_property_to_pydantic(prop)
    return FALLBACK_PROPERTY

@app.put("/api/property", response_model=PropertySettings)
def update_property_settings(settings: PropertySettings, db=Depends(get_db)):
    if USE_DATABASE and db:
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
        
        db.commit()
        db.refresh(prop)
        return db_property_to_pydantic(prop)
    
    # Fallback update not persisted globally for simplicity in fallback mode
    return settings

@app.get("/api/guest/lookup")
def lookup_guest(name: Optional[str] = None, phone: Optional[str] = None, db=Depends(get_db)):
    if USE_DATABASE and db:
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
    if USE_DATABASE and db:
        query = db.query(BookingDB).filter(BookingDB.guest_name == name)
        
        # If phone is provided, it's safer to match by it too if we can find it in guest_details
        # But for history, name matching is the standard first step.
        
        if exclude_booking_id:
            query = query.filter(BookingDB.id != exclude_booking_id)
            
        history = query.order_by(BookingDB.check_in.desc()).all()
        return [db_booking_to_pydantic(b) for b in history]
    return []

@app.get("/api/bookings", response_model=List[Booking])
def get_bookings(db=Depends(get_db)):
    if USE_DATABASE and db:
        bookings = db.query(BookingDB).all()
        return [db_booking_to_pydantic(b) for b in bookings]
    return FALLBACK_BOOKINGS

@app.post("/api/bookings", response_model=Booking)
def create_booking(booking: Booking, db=Depends(get_db)):
    if USE_DATABASE and db:
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
            number_of_rooms=booking.numberOfRooms or 1,
            pax=booking.pax or 1,
            folio=[f.dict() for f in booking.folio] if booking.folio else []
        )
        db.add(db_booking)
        db.commit()
        db.refresh(db_booking)
        return db_booking_to_pydantic(db_booking)
    
    # Fallback
    FALLBACK_BOOKINGS.append(booking)
    return booking

@app.post("/api/bookings/bulk", response_model=List[Booking])
def create_bulk_bookings(bookings: List[Booking], db=Depends(get_db)):
    if USE_DATABASE and db:
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
            return [db_booking_to_pydantic(db_b) for db_b in db_bookings]
        except Exception as e:
            db.rollback()
            if isinstance(e, HTTPException): raise e
            raise HTTPException(status_code=500, detail=str(e))
    
    # Fallback
    for b in bookings:
        FALLBACK_BOOKINGS.append(b)
    return bookings

@app.put("/api/bookings/{booking_id}", response_model=Booking)
def update_booking(booking_id: str, booking: Booking, db=Depends(get_db)):
    if USE_DATABASE and db:
        db_booking = db.query(BookingDB).filter(BookingDB.id == booking_id).first()
        if not db_booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        
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
        db_booking.guest_details = booking.guestDetails.dict() if booking.guestDetails else None
        db_booking.number_of_rooms = booking.numberOfRooms
        db_booking.pax = booking.pax
        db_booking.accessory_guests = [g.dict() for g in booking.accessoryGuests] if booking.accessoryGuests else []
        db_booking.extra_beds = booking.extraBeds
        db_booking.special_requests = booking.specialRequests
        db_booking.is_vip = booking.isVIP or False
        db_booking.is_settled = booking.isSettled or False
        db_booking.folio = [f.dict() for f in booking.folio] if booking.folio else []
        db_booking.payments = [p.dict() for p in booking.payments] if booking.payments else []
        
        # Save or update guest profile whenever guest details are present
        if booking.guestDetails and booking.guestDetails.name and booking.guestDetails.phoneNumber:
            gd = booking.guestDetails
            existing_profile = db.query(GuestProfileDB).filter(
                GuestProfileDB.name == gd.name,
                GuestProfileDB.phone_number == gd.phoneNumber
            ).first()
            
            if existing_profile:
                # Update existing profile with latest info
                existing_profile.id_type = gd.idType
                existing_profile.id_number = gd.idNumber
                existing_profile.address = gd.address
                existing_profile.dob = gd.dob
                existing_profile.nationality = gd.nationality
                existing_profile.gender = gd.gender
                existing_profile.email = gd.email
                existing_profile.id_type = gd.idType
                existing_profile.id_number = gd.idNumber
                existing_profile.passport_number = gd.passportNumber
                existing_profile.passport_place_issue = gd.passportPlaceIssue
                existing_profile.passport_issue_date = gd.passportIssueDate
                existing_profile.passport_expiry = gd.passportExpiry
                existing_profile.visa_number = gd.visaNumber
                existing_profile.visa_type = gd.visaType
                existing_profile.visa_place_issue = gd.visaPlaceIssue
                existing_profile.visa_issue_date = gd.visaIssueDate
                existing_profile.visa_expiry = gd.visaExpiry
                existing_profile.arrived_from = gd.arrivedFrom
                existing_profile.arrival_date_india = gd.arrivalDateIndia
                existing_profile.arrival_port = gd.arrivalPort
                existing_profile.next_destination = gd.nextDestination
                existing_profile.purpose_of_visit = gd.purposeOfVisit
                existing_profile.id_image = gd.idImage
                existing_profile.id_image_back = gd.idImageBack
                existing_profile.visa_page = gd.visaPage
                existing_profile.serial_number = gd.serialNumber
                existing_profile.father_or_husband_name = gd.fatherOrHusbandName
                existing_profile.city = gd.city
                existing_profile.state = gd.state
                existing_profile.pin_code = gd.pinCode
                existing_profile.country = gd.country
                existing_profile.arrival_time = gd.arrivalTime
                existing_profile.departure_time = gd.departureTime
                existing_profile.signature = gd.signature
                existing_profile.last_check_in = booking.checkIn
            else:
                # Create new profile
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
                    passport_number = gd.passportNumber,
                    passport_place_issue = gd.passportPlaceIssue,
                    passport_issue_date = gd.passportIssueDate,
                    passport_expiry = gd.passportExpiry,
                    visa_number = gd.visaNumber,
                    visa_type = gd.visaType,
                    visa_place_issue = gd.visaPlaceIssue,
                    visa_issue_date = gd.visaIssueDate,
                    visa_expiry = gd.visaExpiry,
                    arrived_from = gd.arrivedFrom,
                    arrival_date_india = gd.arrivalDateIndia,
                    arrival_port = gd.arrivalPort,
                    next_destination = gd.nextDestination,
                    purpose_of_visit = gd.purposeOfVisit,
                    id_image = gd.idImage,
                    id_image_back = gd.idImageBack,
                    visa_page=gd.visaPage,
                    serial_number=gd.serialNumber,
                    father_or_husband_name=gd.fatherOrHusbandName,
                    city=gd.city,
                    state=gd.state,
                    pin_code=gd.pinCode,
                    country=gd.country,
                    arrival_time=gd.arrivalTime,
                    departure_time=gd.departureTime,
                    signature=gd.signature,
                    last_check_in=booking.checkIn
                )
                db.add(new_profile)

        # Since we are using BigInteger for timestamp, ensure it's an int
        import time
        db_booking.timestamp = int(time.time() * 1000)

        db.commit()
        db.refresh(db_booking)
        return db_booking_to_pydantic(db_booking)
    
    # Fallback
    for i, b in enumerate(FALLBACK_BOOKINGS):
        if b.id == booking_id:
            FALLBACK_BOOKINGS[i] = booking
            return booking
    raise HTTPException(status_code=404, detail="Booking not found")

@app.post("/api/bookings/{booking_id}/transfer", response_model=Booking)
def transfer_booking(booking_id: str, transfer: RoomTransferRequest, db=Depends(get_db)):
    if USE_DATABASE and db:
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
        # 1. Create a new booking for the second segment
        import uuid
        import time
        new_id = f"switch-{str(uuid.uuid4())[:8]}"
        
        # Use existing reservation_id or create one to link them
        res_id = db_booking.reservation_id or f"res-{db_booking.id}"
        db_booking.reservation_id = res_id
        
        # Calculate rates for the new booking if not keeping original rate
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
            status=db_booking.status, # Usually 'CheckedIn'
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
        
        # 2. Update original booking's check_out date
        db_booking.check_out = transfer.effectiveDate
        # If it was CheckedIn, it stays CheckedIn until the effectiveDate (which is usually today)
        # But conceptually the segment in room A is finishing.
        # In many systems, we might set status to 'CheckedOut' for the first segment if it's completely past.
        # For now let's keep it consistent with the transfer request.
        
        db.add(new_booking)
        
        # 3. Update guest profile with latest move if it exists
        if db_booking.guest_details:
            gd = db_booking.guest_details
            # Handle if gd is a dict or a Pydantic model (depending on how it was loaded)
            name = gd.get('name') if isinstance(gd, dict) else getattr(gd, 'name', None)
            phone = gd.get('phoneNumber') if isinstance(gd, dict) else getattr(gd, 'phoneNumber', None)
            
            if name and phone:
                profile = db.query(GuestProfileDB).filter(
                    GuestProfileDB.name == name,
                    GuestProfileDB.phone_number == phone
                ).first()
                if profile:
                    profile.last_check_in = transfer.effectiveDate

        db.commit()
        db.refresh(new_booking)
        
        return db_booking_to_pydantic(new_booking)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
