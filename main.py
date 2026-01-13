from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from sqlalchemy.orm import Session

from backend.models import Hotel, RoomType, Booking, OTAConnection, RateRulesConfig
from backend.database import get_db
from backend.db_models import HotelDB, RoomTypeDB, BookingDB, OTAConnectionDB, RateRulesDB

app = FastAPI(title="SyncGuard PMS API")

# Configure CORS
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "*",  # Allow all origins for private server deployment
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper functions to convert DB models to Pydantic models
def db_hotel_to_pydantic(db_hotel: HotelDB) -> Hotel:
    return Hotel(
        id=db_hotel.id,
        name=db_hotel.name,
        location=db_hotel.location,
        color=db_hotel.color,
        otaConfig=db_hotel.ota_config or {}
    )

def db_room_type_to_pydantic(db_room: RoomTypeDB) -> RoomType:
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

def db_booking_to_pydantic(db_booking: BookingDB) -> Booking:
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
        amount=db_booking.amount,
        folio=db_booking.folio
    )

def db_connection_to_pydantic(db_conn: OTAConnectionDB) -> OTAConnection:
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

def db_rules_to_pydantic(db_rules: RateRulesDB) -> RateRulesConfig:
    return RateRulesConfig(
        weeklyRules=db_rules.weekly_rules or {},
        specialEvents=db_rules.special_events or []
    )

@app.get("/")
def read_root():
    return {"message": "SyncGuard PMS API"}

@app.get("/api/hotels", response_model=List[Hotel])
def get_hotels(db: Session = Depends(get_db)):
    hotels = db.query(HotelDB).all()
    return [db_hotel_to_pydantic(h) for h in hotels]

@app.get("/api/room-types", response_model=List[RoomType])
def get_room_types(db: Session = Depends(get_db)):
    room_types = db.query(RoomTypeDB).all()
    return [db_room_type_to_pydantic(rt) for rt in room_types]

@app.get("/api/connections", response_model=List[OTAConnection])
def get_connections(db: Session = Depends(get_db)):
    connections = db.query(OTAConnectionDB).all()
    return [db_connection_to_pydantic(c) for c in connections]

@app.get("/api/rules", response_model=RateRulesConfig)
def get_rules(db: Session = Depends(get_db)):
    rules = db.query(RateRulesDB).filter(RateRulesDB.id == "default").first()
    if not rules:
        # Return default empty rules if none exist
        return RateRulesConfig(
            weeklyRules={'isActive': False, 'activeDays': [], 'modifierType': 'percentage', 'modifierValue': 1.0},
            specialEvents=[]
        )
    return db_rules_to_pydantic(rules)

@app.get("/api/bookings", response_model=List[Booking])
def get_bookings(db: Session = Depends(get_db)):
    bookings = db.query(BookingDB).all()
    return [db_booking_to_pydantic(b) for b in bookings]

@app.post("/api/bookings", response_model=Booking)
def create_booking(booking: Booking, db: Session = Depends(get_db)):
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
        folio=booking.folio or []
    )
    db.add(db_booking)
    db.commit()
    db.refresh(db_booking)
    return db_booking_to_pydantic(db_booking)

@app.put("/api/bookings/{booking_id}", response_model=Booking)
def update_booking(booking_id: str, booking: Booking, db: Session = Depends(get_db)):
    db_booking = db.query(BookingDB).filter(BookingDB.id == booking_id).first()
    if not db_booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    db_booking.room_type_id = booking.roomTypeId
    db_booking.room_number = booking.roomNumber
    db_booking.guest_name = booking.guestName
    db_booking.source = booking.source
    db_booking.status = booking.status
    db_booking.timestamp = booking.timestamp
    db_booking.check_in = booking.checkIn
    db_booking.check_out = booking.checkOut
    db_booking.amount = booking.amount
    db_booking.folio = booking.folio or []
    
    db.commit()
    db.refresh(db_booking)
    return db_booking_to_pydantic(db_booking)

@app.delete("/api/bookings/{booking_id}")
def delete_booking(booking_id: str, db: Session = Depends(get_db)):
    db_booking = db.query(BookingDB).filter(BookingDB.id == booking_id).first()
    if not db_booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    db.delete(db_booking)
    db.commit()
    return {"message": "Booking deleted"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
