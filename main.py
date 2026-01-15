from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from sqlalchemy.orm import Session
from backend.models import Hotel, RoomType, Booking, OTAConnection, RateRulesConfig, RoomTransferRequest

# Database Connection Logic
USE_DATABASE = False

try:
    from backend.database import get_db as get_db_real
    from backend.db_models import HotelDB, RoomTypeDB, BookingDB, OTAConnectionDB, RateRulesDB
    
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
            accessoryGuests=db_booking.accessory_guests or [],
            extraBeds=db_booking.extra_beds,
            specialRequests=db_booking.special_requests,
            isVIP=db_booking.is_vip,
            folio=db_booking.folio
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
        db_booking.folio = [f.dict() for f in booking.folio] if booking.folio else []
        
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
        
        # 1. Update room assignment
        db_booking.room_type_id = transfer.newRoomTypeId
        db_booking.room_number = transfer.newRoomNumber
        
        # 2. Update rate if keepRate is False
        if not transfer.keepRate:
            rt = db.query(RoomTypeDB).filter(RoomTypeDB.id == transfer.newRoomTypeId).first()
            if rt:
                db_booking.amount = rt.base_price

        import time
        db_booking.timestamp = int(time.time() * 1000)

        db.commit()
        db.refresh(db_booking)
        return db_booking_to_pydantic(db_booking)
    
    raise HTTPException(status_code=501, detail="Transfer not implemented for fallback storage")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
