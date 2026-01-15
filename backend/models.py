from typing import List, Optional, Dict, Union, Literal
from pydantic import BaseModel

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

class Hotel(BaseModel):
    id: str
    name: str
    location: str
    color: str
    otaConfig: Dict[str, str]

class GuestDetails(BaseModel):
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
    isFormCSubmitted: Optional[bool] = None

class FolioItem(BaseModel):
    id: str
    description: str
    amount: float
    category: Literal['F&B', 'Laundry', 'Room', 'Other']
    timestamp: str

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
    folio: Optional[List[FolioItem]] = None
class RoomTransferRequest(BaseModel):
    bookingId: str
    newRoomTypeId: str
    newRoomNumber: str
    effectiveDate: str
    keepRate: bool
    transferFolio: bool
