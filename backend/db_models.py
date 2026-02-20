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
    last_invoice_number = Column(Integer, default=0)
    public_base_url = Column(String, nullable=True)
    check_in_time = Column(String, default="12:00")
    check_out_time = Column(String, default="11:00")
    gemini_api_key = Column(String, nullable=True)
    loyalty_tiers = Column(JSON, default=[])

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
    extra_adult_rate = Column(Float, nullable=True, default=0)
    extra_child_rate = Column(Float, nullable=True, default=0)

class BookingDB(Base):
    __tablename__ = "bookings"
    
    id = Column(String, primary_key=True, index=True)
    room_type_id = Column(String, ForeignKey("room_types.id", ondelete="SET NULL"), nullable=True)
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
    extra_adults = Column(Integer, default=0)
    extra_children = Column(Integer, default=0)
    special_requests = Column(String, nullable=True)
    is_vip = Column(Boolean, default=False)
    is_settled = Column(Boolean, default=False)
    rejection_reason = Column(String, nullable=True)
    payments = Column(JSON, default=[])
    invoice_number = Column(String, nullable=True)
    invoice_path = Column(String, nullable=True)
    receipt_path = Column(String, nullable=True)
    is_auto_generated = Column(Boolean, default=False)
    external_reference_id = Column(String, nullable=True, index=True)
    discount = Column(JSON, nullable=True)

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
    additional_docs = Column(JSON, default=[])
    form_pages = Column(JSON, default=[])
    signature = Column(String)
    preferences = Column(String)
    last_check_in = Column(String)

class NotificationDB(Base):
    __tablename__ = "notifications"
    
    id = Column(String, primary_key=True, index=True)
    type = Column(String, nullable=False)  # 'reservation', 'checkin', 'checkout', 'payment', 'housekeeping', 'guest_request', 'system'
    category = Column(String, nullable=False)  # Subcategory like 'new_booking', 'cancellation', etc.
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    priority = Column(String, default="normal")  # 'low', 'normal', 'high', 'urgent'
    is_read = Column(Boolean, default=False)
    is_dismissed = Column(Boolean, default=False)
    created_at = Column(String, nullable=False)  # ISO timestamp
    read_at = Column(String, nullable=True)
    booking_id = Column(String, ForeignKey("bookings.id"), nullable=True)
    room_number = Column(String, nullable=True)
    extra_data = Column("metadata", JSON, default={})  # 'metadata' is reserved in SQLAlchemy, so we map it

class RoomStatusDB(Base):
    __tablename__ = "room_status"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    room_number = Column(String, unique=True, index=True)
    status = Column(String, default="Clean") # Clean, Dirty, Inspecting, OutOfOrder
    priority = Column(String, default="Medium") # Low, Medium, High
    notes = Column(String, nullable=True)
    last_cleaned = Column(String, nullable=True)
    housekeeper = Column(String, nullable=True)

class UserDB(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    full_name = Column(String)
    role = Column(String, default="staff")
    allowed_sections = Column(JSON, default=list)


class SyncHistoryDB(Base):
    """
    Tracks all sync operations to OTA channels.
    Used for debugging, analytics, and retry management.
    """
    __tablename__ = "sync_history"
    
    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(String, nullable=False, index=True)  # 'mmt', 'booking', etc.
    sync_type = Column(String, nullable=False)  # 'rate', 'availability', 'booking'
    room_type_id = Column(String, nullable=True)
    date_range_start = Column(String, nullable=True)
    date_range_end = Column(String, nullable=True)
    status = Column(String, nullable=False)  # 'pending', 'success', 'failed', 'retrying'
    message = Column(String, nullable=True)
    error_code = Column(String, nullable=True)
    retry_count = Column(Integer, default=0)
    request_payload = Column(JSON, nullable=True)  # Store the request for debugging
    response_payload = Column(String, nullable=True)  # Raw response from OTA
    created_at = Column(String, nullable=False)
    completed_at = Column(String, nullable=True)
    

class ChannelCredentialsDB(Base):
    """
    Stores encrypted API credentials for each OTA channel.
    IMPORTANT: In production, encrypt the api_secret field!
    """
    __tablename__ = "channel_credentials"
    
    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(String, unique=True, index=True)  # 'mmt', 'booking', etc.
    hotel_id = Column(String, nullable=False)  # Your property's ID on the OTA
    api_key = Column(String, nullable=False)
    api_secret = Column(String, nullable=True)  # Should be encrypted in production
    username = Column(String, nullable=True)
    password = Column(String, nullable=True)  # Should be encrypted in production
    environment = Column(String, default="sandbox")  # 'sandbox' or 'production'
    endpoint_url = Column(String, nullable=True)  # Custom endpoint if needed
    is_active = Column(Boolean, default=True)
    created_at = Column(String, nullable=True)
    updated_at = Column(String, nullable=True)


class RoomTypeMappingDB(Base):
    """
    Maps internal room type IDs to OTA-specific room codes.
    Each OTA has its own room type codes assigned during onboarding.
    """
    __tablename__ = "room_type_mappings"
    
    id = Column(Integer, primary_key=True, index=True)
    internal_room_type_id = Column(String, nullable=False, index=True)
    internal_name = Column(String, nullable=False)
    mmt_code = Column(String, nullable=True)
    booking_com_code = Column(String, nullable=True)
    expedia_code = Column(String, nullable=True)
    goibibo_code = Column(String, nullable=True)
    agoda_code = Column(String, nullable=True)
    created_at = Column(String, nullable=True)
    updated_at = Column(String, nullable=True)


