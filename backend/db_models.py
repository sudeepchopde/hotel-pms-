from sqlalchemy import Column, String, Integer, Float, Boolean, JSON, ForeignKey, BigInteger
from sqlalchemy.orm import relationship
from backend.database import Base

class PropertySettingsDB(Base):
    __tablename__ = "property_settings"
    
    id = Column(String, primary_key=True, index=True, default="default")
    name = Column(String, nullable=False)
    address = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    gst_number = Column(String, nullable=True)
    gst_rate = Column(Float, default=12.0)
    food_gst_rate = Column(Float, default=5.0)
    other_gst_rate = Column(Float, default=18.0)
    razorpay_key_id = Column(String, nullable=True)
    razorpay_key_secret = Column(String, nullable=True)

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
    is_settled = Column(Boolean, default=False)
    rejection_reason = Column(String, nullable=True)
    payments = Column(JSON, default=[])

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

class GuestProfileDB(Base):
    __tablename__ = "guest_profiles"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, index=True)
    phone_number = Column(String, index=True)
    id_type = Column(String)
    id_number = Column(String)
    address = Column(String)
    dob = Column(String)
    nationality = Column(String)
    gender = Column(String)
    email = Column(String)
    passport_number = Column(String)
    passport_place_issue = Column(String)
    passport_issue_date = Column(String)
    passport_expiry = Column(String)
    visa_number = Column(String)
    visa_type = Column(String)
    visa_place_issue = Column(String)
    visa_issue_date = Column(String)
    visa_expiry = Column(String)
    arrived_from = Column(String)
    arrival_date_india = Column(String)
    arrival_port = Column(String)
    next_destination = Column(String)
    purpose_of_visit = Column(String)
    serial_number = Column(Integer)
    father_or_husband_name = Column(String)
    city = Column(String)
    state = Column(String)
    pin_code = Column(String)
    country = Column(String)
    arrival_time = Column(String)
    departure_time = Column(String)
    id_image = Column(String) # Path to ID image
    id_image_back = Column(String)
    visa_page = Column(String)
    signature = Column(String)
    preferences = Column(String)
    last_check_in = Column(String)
