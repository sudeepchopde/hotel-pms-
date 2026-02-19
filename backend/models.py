from typing import List, Optional, Dict, Union, Literal, Any
from pydantic import BaseModel, Field, root_validator

class LoyaltyTier(BaseModel):
    name: str
    minNights: int

class PropertySettings(BaseModel):
    name: str
    address: str
    phone: Optional[str] = None
    email: Optional[str] = None
    gstNumber: Optional[str] = None
    gstRate: float = 12.0
    foodGstRate: float = 5.0
    otherGstRate: float = 18.0
    razorpayKeyId: Optional[str] = None
    razorpayKeySecret: Optional[str] = None
    lastInvoiceNumber: Optional[int] = 0
    publicBaseUrl: Optional[str] = None
    geminiApiKey: Optional[str] = None
    checkInTime: Optional[str] = "12:00"
    checkOutTime: Optional[str] = "11:00"
    loyaltyTiers: Optional[List[LoyaltyTier]] = []

class WeeklyRule(BaseModel):
    isActive: bool
    activeDays: List[int]
    modifierType: Literal['percentage', 'fixed']
    modifierValue: float


class SpecialEvent(BaseModel):
    id: str
    name: str
    startDate: str
    endDate: str
    modifierType: Literal['percentage', 'fixed']
    modifierValue: float

class RateRulesConfig(BaseModel):
    weeklyRules: WeeklyRule
    specialEvents: List[SpecialEvent]

class OTAConnection(BaseModel):
    id: str
    name: str
    key: str
    isVisible: bool
    status: Literal['connected', 'disconnected', 'testing']
    lastValidated: Optional[str] = None
    category: Optional[str] = None
    markupType: Optional[Literal['percentage', 'fixed']] = None
    markupValue: Optional[float] = None
    isStopped: Optional[bool] = None

class RoomType(BaseModel):
    id: str
    name: str
    totalCapacity: int
    basePrice: float
    floorPrice: float
    ceilingPrice: float
    baseOccupancy: int
    amenities: List[str]
    roomNumbers: Optional[List[str]] = None
    extraBedCharge: Optional[float] = None
    extraAdultRate: Optional[float] = 0
    extraChildRate: Optional[float] = 0

class Hotel(BaseModel):
    id: str
    name: str
    location: str
    color: str
    otaConfig: Dict[str, str]

class GuestDetails(BaseModel):
    profileId: Optional[int] = None
    name: Optional[str] = None
    phoneNumber: Optional[str] = None
    email: Optional[str] = None
    idType: Optional[Literal['Aadhar', 'Passport', 'Driving License', 'Voter ID', 'Other']] = None
    idNumber: Optional[str] = None
    address: Optional[str] = None
    nationality: Optional[str] = 'Indian'
    gender: Optional[Literal['Male', 'Female', 'Other']] = None
    dob: Optional[str] = None
    passportNumber: Optional[str] = None
    passportPlaceIssue: Optional[str] = None
    passportIssueDate: Optional[str] = None
    passportExpiry: Optional[str] = None
    visaNumber: Optional[str] = None
    visaType: Optional[str] = None
    visaPlaceIssue: Optional[str] = None
    visaIssueDate: Optional[str] = None
    visaExpiry: Optional[str] = None
    arrivedFrom: Optional[str] = None
    arrivalDateIndia: Optional[str] = None
    arrivalPort: Optional[str] = None
    nextDestination: Optional[str] = None
    purposeOfVisit: Optional[str] = None
    serialNumber: Optional[int] = None
    fatherOrHusbandName: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pinCode: Optional[str] = None
    country: Optional[str] = None
    arrivalTime: Optional[str] = None
    departureTime: Optional[str] = None
    signature: Optional[str] = None
    isFormCSubmitted: Optional[bool] = None
    idImage: Optional[str] = None
    idImageBack: Optional[str] = None
    visaPage: Optional[str] = None
    additionalDocs: Optional[List[str]] = None
    formPages: Optional[List[str]] = None

class FolioItem(BaseModel):
    id: str
    description: str
    amount: float
    category: Literal['F&B', 'Laundry', 'Room', 'Other']
    timestamp: str
    isPaid: Optional[bool] = False
    paymentMethod: Optional[str] = None
    paymentId: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class Payment(BaseModel):
    id: str
    amount: float
    method: Literal['Cash', 'UPI', 'Card']
    timestamp: str
    category: Literal['Room', 'Folio', 'Extra', 'Partial']
    description: Optional[str] = None
    status: Literal['Completed', 'Refunded', 'Cancelled']

class Booking(BaseModel):
    id: str
    roomTypeId: str
    roomNumber: Optional[str] = None
    guestName: str
    source: Literal['MMT', 'Booking.com', 'Expedia', 'Direct']
    status: Literal['Confirmed', 'CheckedIn', 'CheckedOut', 'Cancelled', 'Rejected']
    timestamp: int
    checkIn: str
    checkOut: str
    reservationId: Optional[str] = None
    channelSync: Optional[Dict[str, str]] = None
    amount: Optional[float] = None
    rejectionReason: Optional[str] = None
    guestDetails: Optional[GuestDetails] = None
    numberOfRooms: Optional[int] = None
    pax: Optional[int] = None
    accessoryGuests: Optional[List[GuestDetails]] = None
    extraBeds: Optional[int] = None
    specialRequests: Optional[str] = None
    isVIP: Optional[bool] = None
    isSettled: Optional[bool] = None
    folio: Optional[List[FolioItem]] = None
    payments: Optional[List[Payment]] = None
    invoiceNumber: Optional[str] = None
    invoicePath: Optional[str] = None
    receiptPath: Optional[str] = None
    isAutoGenerated: Optional[bool] = False
    externalReferenceId: Optional[str] = None
    discount: Optional[Dict[str, Any]] = None
class RoomTransferRequest(BaseModel):
    bookingId: str
    newRoomTypeId: str
    newRoomNumber: str
    effectiveDate: str
    keepRate: bool
    transferFolio: bool

class GuestProfile(BaseModel):
    id: Optional[int] = None
    name: str
    phoneNumber: str
    idType: Optional[str] = None
    idNumber: Optional[str] = None
    address: Optional[str] = None
    dob: Optional[str] = None
    nationality: Optional[str] = None
    preferences: Optional[str] = None
    lastCheckIn: Optional[str] = None
    idImage: Optional[str] = None
    idImageBack: Optional[str] = None
    visaPage: Optional[str] = None
    additionalDocs: Optional[List[str]] = None
    formPages: Optional[List[str]] = None

class OCRRequest(BaseModel):
    image: str # Base64 string
    type: str # 'id' or 'form'

class RazorpayOrderRequest(BaseModel):
    amount: float  # In INR
    bookingId: str
    description: Optional[str] = "Payment for Hotel Stay"

class RazorpayVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    bookingId: str
    amount: float

class InboundEmail(BaseModel):
    # Standard format (Postmark/General)
    From: Optional[str] = Field(None, alias="from")
    To: Optional[str] = Field(None, alias="to")
    Subject: Optional[str] = Field(None, alias="subject")
    TextBody: Optional[str] = Field(None, alias="text_body")
    HtmlBody: Optional[str] = Field(None, alias="html_body")
    Headers: Optional[Any] = None
    MessageID: Optional[str] = Field(None, alias="message_id")
    
    # Cloudmailin specific fields
    plain: Optional[str] = None
    html: Optional[str] = None
    headers: Optional[Dict[str, Any]] = None
    envelope: Optional[Dict[str, Any]] = None

    @root_validator(pre=True)
    def map_cloudmailin_fields(cls, values):
        # Extract from Cloudmailin 'headers' dict if present
        h = values.get('headers')
        if h and isinstance(h, dict):
            if not values.get('Subject'): values['Subject'] = h.get('Subject') or h.get('subject')
            if not values.get('From'): values['From'] = h.get('From') or h.get('from')
            if not values.get('To'): values['To'] = h.get('To') or h.get('to')
            if not values.get('MessageID'): values['MessageID'] = h.get('Message-ID') or h.get('message-id')
        
        # Extract from Cloudmailin 'envelope' if headers didn't have it
        env = values.get('envelope')
        if env and isinstance(env, dict):
            if not values.get('From'): values['From'] = env.get('from')
            if not values.get('To'): values['To'] = env.get('to')

        # Map body fields
        if values.get('plain') and not values.get('TextBody'):
            values['TextBody'] = values.get('plain')
        if values.get('html') and not values.get('HtmlBody'):
            values['HtmlBody'] = values.get('html')
            
        return values
    
    class Config:
        populate_by_name = True
        allow_population_by_field_name = True

class Notification(BaseModel):
    id: str
    type: Literal['reservation', 'checkin', 'checkout', 'payment', 'housekeeping', 'guest_request', 'system']
    category: str
    title: str
    message: str
    priority: Literal['low', 'normal', 'high', 'urgent'] = 'normal'
    isRead: bool = False
    isDismissed: bool = False
    createdAt: str
    readAt: Optional[str] = None
    bookingId: Optional[str] = None
    roomNumber: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class NotificationCreate(BaseModel):
    type: Literal['reservation', 'checkin', 'checkout', 'payment', 'housekeeping', 'guest_request', 'system']
    category: str
    title: str
    message: str
    priority: Literal['low', 'normal', 'high', 'urgent'] = 'normal'
    bookingId: Optional[str] = None
    roomNumber: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class RoomStatus(BaseModel):
    roomNumber: str
    status: Literal['Clean', 'Dirty', 'Inspecting', 'OutOfOrder']
    priority: Literal['Low', 'Medium', 'High'] = 'Medium'
    notes: Optional[str] = None
    lastCleaned: Optional[str] = None
    housekeeper: Optional[str] = None


# Auth Models
class UserLogin(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    role: str = "staff"
    allowed_sections: List[str] = []

class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    allowed_sections: Optional[List[str]] = None

class UserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    allowed_sections: List[str]


