from sqlalchemy import Column, String, Integer, Float, Boolean, JSON, ForeignKey, BigInteger
from sqlalchemy.orm import relationship
from backend.database import Base

class HotelDB(Base):
    __tablename__ = "hotels"
    
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    location = Column(String, nullable=False)
    color = Column(String, nullable=False)
    ota_config = Column(JSON, default={})

class RoomTypeDB(Base):
    __tablename__ = "room_types"
    
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    total_capacity = Column(Integer, nullable=False)
    base_price = Column(Float, nullable=False)
    floor_price = Column(Float, nullable=False)
    ceiling_price = Column(Float, nullable=False)
    base_occupancy = Column(Integer, nullable=False)
    amenities = Column(JSON, default=[])
    room_numbers = Column(JSON, default=[])
    extra_bed_charge = Column(Float, nullable=True)

class BookingDB(Base):
    __tablename__ = "bookings"
    
    id = Column(String, primary_key=True, index=True)
    room_type_id = Column(String, ForeignKey("room_types.id"), nullable=False)
    room_number = Column(String, nullable=True)
    guest_name = Column(String, nullable=False)
    source = Column(String, nullable=False)  # 'MMT', 'Booking.com', 'Expedia', 'Direct'
    status = Column(String, nullable=False)  # 'Confirmed', 'CheckedIn', 'CheckedOut', 'Cancelled', 'Rejected'
    timestamp = Column(BigInteger, nullable=False)
    check_in = Column(String, nullable=False)
    check_out = Column(String, nullable=False)
    amount = Column(Float, nullable=True)
    reservation_id = Column(String, nullable=True)
    folio = Column(JSON, default=[])
    guest_details = Column(JSON, nullable=True)
    number_of_rooms = Column(Integer, nullable=True)
    pax = Column(Integer, nullable=True)
    accessory_guests = Column(JSON, default=[])
    channel_sync = Column(JSON, default={})
    extra_beds = Column(Integer, nullable=True)
    special_requests = Column(String, nullable=True)
    is_vip = Column(Boolean, default=False)
    rejection_reason = Column(String, nullable=True)

class OTAConnectionDB(Base):
    __tablename__ = "ota_connections"
    
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    key = Column(String, default="")
    is_visible = Column(Boolean, default=False)
    status = Column(String, nullable=False)  # 'connected', 'disconnected', 'testing'
    last_validated = Column(String, nullable=True)
    category = Column(String, nullable=True)
    markup_type = Column(String, nullable=True)  # 'percentage' or 'fixed'
    markup_value = Column(Float, nullable=True)
    is_stopped = Column(Boolean, default=False)

class RateRulesDB(Base):
    __tablename__ = "rate_rules"
    
    id = Column(String, primary_key=True, index=True, default="default")
    weekly_rules = Column(JSON, default={})
    special_events = Column(JSON, default=[])
