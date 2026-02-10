"""
Base class for all Payment Gateway integrations.
Each gateway (Easebuzz, Razorpay) extends this class.
"""
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
import logging

from .models import (
    PaymentResult,
    PaymentStatus,
    PaymentRequest,
    PaymentCallback,
    RefundRequest,
    PaymentGatewayCredentials
)

logger = logging.getLogger(__name__)


class BasePaymentGateway(ABC):
    """
    Abstract base class for payment gateway integrations.
    """
    
    GATEWAY_NAME: str = "base"
    
    def __init__(self, credentials: PaymentGatewayCredentials):
        self.credentials = credentials
        self.api_key = credentials.api_key
        self.api_secret = credentials.api_secret
        self.environment = credentials.environment
    
    @property
    def is_production(self) -> bool:
        return self.environment == "production"
    
    @property
    @abstractmethod
    def base_url(self) -> str:
        """Return the base API URL for this gateway"""
        pass
    
    @abstractmethod
    async def initiate_payment(self, request: PaymentRequest) -> PaymentResult:
        """
        Initiate a payment and get a payment link/ID.
        
        Args:
            request: PaymentRequest with amount, customer details
            
        Returns:
            PaymentResult with payment link or error
        """
        pass
    
    @abstractmethod
    def verify_callback(self, payload: Dict[str, Any], signature: Optional[str] = None) -> PaymentCallback:
        """
        Verify and parse a payment callback/webhook.
        
        Args:
            payload: The raw callback data
            signature: Signature for verification (if applicable)
            
        Returns:
            PaymentCallback with parsed payment status
        """
        pass
    
    @abstractmethod
    async def check_status(self, transaction_id: str) -> PaymentResult:
        """
        Check the status of a payment.
        
        Args:
            transaction_id: The transaction ID to check
            
        Returns:
            PaymentResult with current status
        """
        pass
    
    @abstractmethod
    async def refund(self, request: RefundRequest) -> PaymentResult:
        """
        Initiate a refund for a payment.
        
        Args:
            request: RefundRequest with transaction ID and amount
            
        Returns:
            PaymentResult with refund status
        """
        pass
    
    def _log_payment(self, action: str, success: bool, details: str = ""):
        """Log payment operations for debugging"""
        status = "SUCCESS" if success else "FAILED"
        logger.info(f"[{self.GATEWAY_NAME}] {action} {status}: {details}")
