"""
Pydantic models for Payment Gateway operations
"""
from typing import Optional, Dict, Any, Literal
from pydantic import BaseModel
from datetime import datetime
from enum import Enum


class PaymentStatus(str, Enum):
    PENDING = "pending"
    INITIATED = "initiated"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class PaymentMethod(str, Enum):
    CARD = "card"
    UPI = "upi"
    NETBANKING = "netbanking"
    WALLET = "wallet"
    EMI = "emi"


class PaymentGatewayType(str, Enum):
    EASEBUZZ = "easebuzz"
    RAZORPAY = "razorpay"
    NONE = "none"


class PaymentGatewayCredentials(BaseModel):
    """Credentials for a payment gateway"""
    gateway_type: PaymentGatewayType
    merchant_id: Optional[str] = None  # Easebuzz
    api_key: str
    api_secret: str  # Called "salt" in Easebuzz
    environment: Literal["sandbox", "production"] = "sandbox"
    webhook_secret: Optional[str] = None  # For Razorpay webhook verification


class PaymentRequest(BaseModel):
    """Request to initiate a payment"""
    booking_id: str
    amount: float
    currency: str = "INR"
    customer_name: str
    customer_email: str
    customer_phone: str
    description: Optional[str] = None
    return_url: Optional[str] = None  # Where to redirect after payment


class PaymentResult(BaseModel):
    """Result of a payment operation"""
    success: bool
    status: PaymentStatus
    transaction_id: Optional[str] = None
    gateway_order_id: Optional[str] = None  # Order ID from gateway
    payment_link: Optional[str] = None  # URL to redirect for payment
    message: Optional[str] = None
    raw_response: Optional[Dict[str, Any]] = None
    timestamp: datetime = None
    
    def __init__(self, **data):
        if data.get('timestamp') is None:
            data['timestamp'] = datetime.utcnow()
        super().__init__(**data)


class PaymentCallback(BaseModel):
    """Callback/webhook data from payment gateway"""
    gateway_type: PaymentGatewayType
    transaction_id: str
    order_id: str
    status: PaymentStatus
    amount: float
    payment_method: Optional[PaymentMethod] = None
    raw_data: Dict[str, Any]


class RefundRequest(BaseModel):
    """Request to refund a payment"""
    transaction_id: str
    amount: Optional[float] = None  # Partial refund amount, None for full
    reason: Optional[str] = None
