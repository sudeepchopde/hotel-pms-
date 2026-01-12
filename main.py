from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict
from backend.models import Hotel, RoomType, Booking, OTAConnection, RateRulesConfig

app = FastAPI()

# Configure CORS
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mock Data (Moved from App.tsx)
HOTELS = [
    Hotel(
        id='h-1', 
        name='Hotel Satsangi', 
        location='Deoghar', 
        color='indigo', 
        otaConfig={'expedia': 'active', 'booking': 'active', 'mmt': 'active'}
    )
]

ROOM_TYPES = [
    RoomType(id='rt-1', name='Delux Room (AC)', totalCapacity=10, basePrice=4500, floorPrice=3000, ceilingPrice=8000, baseOccupancy=2, amenities=['WiFi', 'AC', 'TV'], roomNumbers=['101', '102', '103', '104', '105', '106', '107', '108', '109', '110'], extraBedCharge=1200),
    RoomType(id='rt-2', name='Double Bed Room', totalCapacity=10, basePrice=2800, floorPrice=1800, ceilingPrice=5000, baseOccupancy=2, amenities=['WiFi', 'Fan'], roomNumbers=['201', '202', '203', '204', '205', '206', '207', '208', '209', '210'], extraBedCharge=800),
    RoomType(id='rt-3', name='Single Bed Room', totalCapacity=5, basePrice=1800, floorPrice=1200, ceilingPrice=3000, baseOccupancy=1, amenities=['WiFi'], roomNumbers=['301', '302', '303', '304', '305'], extraBedCharge=500),
    RoomType(id='rt-4', name='Dormitory', totalCapacity=3, basePrice=1200, floorPrice=800, ceilingPrice=2500, baseOccupancy=1, amenities=['WiFi', 'Locker'], roomNumbers=['D-1', 'D-2', 'D-3'], extraBedCharge=300),
]

CONNECTIONS = [
    OTAConnection(id='mmt', name='MakeMyTrip', key='mkmt_live_••••••••7d2f', isVisible=False, status='connected', lastValidated='2 hours ago'),
    OTAConnection(id='booking', name='Booking.com', key='bcom_auth_••••••••a11b', isVisible=False, status='connected', lastValidated='5 mins ago'),
    OTAConnection(id='expedia', name='Expedia', key='', isVisible=False, status='disconnected'),
]

RULES = RateRulesConfig(
    weeklyRules={'isActive': True, 'activeDays': [5, 6], 'modifierType': 'percentage', 'modifierValue': 1.20},
    specialEvents=[
        {'id': 'ev-1', 'name': 'Diwali Festival', 'startDate': '2025-10-30', 'endDate': '2025-11-05', 'modifierType': 'percentage', 'modifierValue': 1.5},
        {'id': 'ev-2', 'name': 'New Year Eve', 'startDate': '2025-12-30', 'endDate': '2026-01-01', 'modifierType': 'fixed', 'modifierValue': 5000}
    ]
)

BOOKINGS: List[Booking] = [] # Memory storage for now

@app.get("/")
def read_root():
    return {"message": "SyncGuard PMS API"}

@app.get("/api/hotels", response_model=List[Hotel])
def get_hotels():
    return HOTELS

@app.get("/api/room-types", response_model=List[RoomType])
def get_room_types():
    return ROOM_TYPES

@app.get("/api/connections", response_model=List[OTAConnection])
def get_connections():
    return CONNECTIONS

@app.get("/api/rules", response_model=RateRulesConfig)
def get_rules():
    return RULES

@app.get("/api/bookings", response_model=List[Booking])
def get_bookings():
    return BOOKINGS

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
