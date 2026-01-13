"""
Database initialization script.
Run this once to create tables and seed initial data.

Usage: python backend/init_db.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import engine, SessionLocal, Base
from backend.db_models import HotelDB, RoomTypeDB, OTAConnectionDB, RateRulesDB, BookingDB

def create_tables():
    """Create all database tables."""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully!")

def seed_data():
    """Seed initial data into the database."""
    db = SessionLocal()
    
    try:
        # Check if data already exists
        if db.query(HotelDB).first():
            print("Data already exists, skipping seed.")
            return
        
        # Seed Hotels
        hotel = HotelDB(
            id='h-1',
            name='Hotel Satsangi',
            location='Deoghar',
            color='indigo',
            ota_config={'expedia': 'active', 'booking': 'active', 'mmt': 'active'}
        )
        db.add(hotel)
        
        # Seed Room Types
        room_types = [
            RoomTypeDB(
                id='rt-1', name='Delux Room (AC)', total_capacity=10,
                base_price=4500, floor_price=3000, ceiling_price=8000,
                base_occupancy=2, amenities=['WiFi', 'AC', 'TV'],
                room_numbers=['101', '102', '103', '104', '105', '106', '107', '108', '109', '110'],
                extra_bed_charge=1200
            ),
            RoomTypeDB(
                id='rt-2', name='Double Bed Room', total_capacity=10,
                base_price=2800, floor_price=1800, ceiling_price=5000,
                base_occupancy=2, amenities=['WiFi', 'Fan'],
                room_numbers=['201', '202', '203', '204', '205', '206', '207', '208', '209', '210'],
                extra_bed_charge=800
            ),
            RoomTypeDB(
                id='rt-3', name='Single Bed Room', total_capacity=5,
                base_price=1800, floor_price=1200, ceiling_price=3000,
                base_occupancy=1, amenities=['WiFi'],
                room_numbers=['301', '302', '303', '304', '305'],
                extra_bed_charge=500
            ),
            RoomTypeDB(
                id='rt-4', name='Dormitory', total_capacity=3,
                base_price=1200, floor_price=800, ceiling_price=2500,
                base_occupancy=1, amenities=['WiFi', 'Locker'],
                room_numbers=['D-1', 'D-2', 'D-3'],
                extra_bed_charge=300
            ),
        ]
        db.add_all(room_types)
        
        # Seed OTA Connections
        connections = [
            OTAConnectionDB(
                id='mmt', name='MakeMyTrip', key='mkmt_live_••••••••7d2f',
                is_visible=False, status='connected', last_validated='2 hours ago'
            ),
            OTAConnectionDB(
                id='booking', name='Booking.com', key='bcom_auth_••••••••a11b',
                is_visible=False, status='connected', last_validated='5 mins ago'
            ),
            OTAConnectionDB(
                id='expedia', name='Expedia', key='',
                is_visible=False, status='disconnected'
            ),
        ]
        db.add_all(connections)
        
        # Seed Rate Rules
        rate_rules = RateRulesDB(
            id='default',
            weekly_rules={'isActive': True, 'activeDays': [5, 6], 'modifierType': 'percentage', 'modifierValue': 1.20},
            special_events=[
                {'id': 'ev-1', 'name': 'Diwali Festival', 'startDate': '2025-10-30', 'endDate': '2025-11-05', 'modifierType': 'percentage', 'modifierValue': 1.5},
                {'id': 'ev-2', 'name': 'New Year Eve', 'startDate': '2025-12-30', 'endDate': '2026-01-01', 'modifierType': 'fixed', 'modifierValue': 5000}
            ]
        )
        db.add(rate_rules)
        
        db.commit()
        print("Initial data seeded successfully!")
        
    except Exception as e:
        print(f"Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_tables()
    seed_data()
