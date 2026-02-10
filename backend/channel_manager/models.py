"""
Pydantic models for Channel Manager sync operations
"""
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel
from datetime import datetime
from enum import Enum


class SyncStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUCCESS = "success"
    FAILED = "failed"
    RETRYING = "retrying"
    STOPPED = "stopped"  # Channel is on Stop Sell


class SyncType(str, Enum):
    RATE = "rate"
    AVAILABILITY = "availability"
    RESTRICTION = "restriction"
    BOOKING_CONFIRM = "booking_confirm"
    BOOKING_CANCEL = "booking_cancel"


class RatePushRequest(BaseModel):
    """Request to push rates to a channel"""
    room_type_id: str
    room_type_code: str  # The OTA's room type code (mapped)
    start_date: str  # YYYY-MM-DD
    end_date: str  # YYYY-MM-DD
    single_rate: float
    double_rate: float
    extra_adult_rate: Optional[float] = 0
    extra_child_rate: Optional[float] = 0
    currency: str = "INR"


class AvailabilityPushRequest(BaseModel):
    """Request to push availability to a channel"""
    room_type_id: str
    room_type_code: str
    start_date: str
    end_date: str
    available_count: int
    stop_sell: bool = False
    min_stay: int = 1
    max_stay: Optional[int] = None
    closed_to_arrival: bool = False
    closed_to_departure: bool = False


class SyncResult(BaseModel):
    """Result of a sync operation"""
    success: bool
    channel: str
    sync_type: SyncType
    status: SyncStatus
    message: Optional[str] = None
    raw_response: Optional[str] = None
    error_code: Optional[str] = None
    timestamp: datetime = None
    retry_count: int = 0
    
    def __init__(self, **data):
        if data.get('timestamp') is None:
            data['timestamp'] = datetime.utcnow()
        super().__init__(**data)


class InboundBooking(BaseModel):
    """Booking received from an OTA webhook"""
    channel: str
    reservation_id: str
    status: Literal["confirmed", "cancelled", "modified"]
    guest_name: str
    guest_email: Optional[str] = None
    guest_phone: Optional[str] = None
    room_type_code: str
    check_in: str
    check_out: str
    num_guests: int = 2
    num_rooms: int = 1
    total_amount: float
    currency: str = "INR"
    special_requests: Optional[str] = None
    raw_payload: Optional[Dict[str, Any]] = None


class ChannelCredentials(BaseModel):
    """Credentials for connecting to an OTA"""
    channel_id: str
    hotel_id: str  # Your property's ID on the OTA
    api_key: str
    api_secret: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    environment: Literal["sandbox", "production"] = "sandbox"
    endpoint_url: Optional[str] = None


class RoomTypeMapping(BaseModel):
    """Maps your internal room type to OTA room type codes"""
    internal_id: str
    internal_name: str
    mmt_code: Optional[str] = None
    booking_com_code: Optional[str] = None
    expedia_code: Optional[str] = None
    goibibo_code: Optional[str] = None


class SyncJob(BaseModel):
    """A queued sync job"""
    id: str
    channel: str
    sync_type: SyncType
    payload: Dict[str, Any]
    status: SyncStatus = SyncStatus.PENDING
    created_at: datetime = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    retry_count: int = 0
    max_retries: int = 5
    error_message: Optional[str] = None
    
    def __init__(self, **data):
        if data.get('created_at') is None:
            data['created_at'] = datetime.utcnow()
        super().__init__(**data)
