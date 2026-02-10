"""
Payment Manager

Central manager for payment gateway operations.
Handles gateway selection and provides a unified interface.
"""
from typing import Optional, Dict, Any
import logging

from .base import BasePaymentGateway
from .models import (
    PaymentResult,
    PaymentStatus,
    PaymentRequest,
    PaymentCallback,
    RefundRequest,
    PaymentGatewayCredentials,
    PaymentGatewayType
)
from .easebuzz import EasebuzzGateway
from .razorpay import RazorpayGateway

logger = logging.getLogger(__name__)


class PaymentManager:
    """
    Unified payment manager that works with any configured gateway.
    """
    
    def __init__(self):
        self.gateway: Optional[BasePaymentGateway] = None
        self.gateway_type: PaymentGatewayType = PaymentGatewayType.NONE
        self.credentials: Optional[PaymentGatewayCredentials] = None
    
    def configure(self, credentials: PaymentGatewayCredentials):
        """
        Configure the payment gateway.
        
        Args:
            credentials: PaymentGatewayCredentials with gateway type and keys
        """
        self.credentials = credentials
        self.gateway_type = credentials.gateway_type
        
        gateway_map = {
            PaymentGatewayType.EASEBUZZ: EasebuzzGateway,
            PaymentGatewayType.RAZORPAY: RazorpayGateway,
        }
        
        gateway_class = gateway_map.get(credentials.gateway_type)
        if gateway_class:
            self.gateway = gateway_class(credentials)
            logger.info(f"Payment gateway configured: {credentials.gateway_type.value}")
        else:
            self.gateway = None
            logger.info("No payment gateway configured")
    
    @property
    def is_configured(self) -> bool:
        return self.gateway is not None
    
    @property
    def gateway_name(self) -> str:
        if self.gateway:
            return self.gateway.GATEWAY_NAME
        return "None"
    
    async def initiate_payment(self, request: PaymentRequest) -> PaymentResult:
        """Initiate a payment using the configured gateway"""
        if not self.gateway:
            return PaymentResult(
                success=False,
                status=PaymentStatus.FAILED,
                message="No payment gateway configured"
            )
        
        return await self.gateway.initiate_payment(request)
    
    def verify_callback(self, payload: Dict[str, Any], signature: Optional[str] = None) -> PaymentCallback:
        """Verify and parse a payment callback"""
        if not self.gateway:
            raise ValueError("No payment gateway configured")
        
        return self.gateway.verify_callback(payload, signature)
    
    async def check_status(self, transaction_id: str) -> PaymentResult:
        """Check payment status"""
        if not self.gateway:
            return PaymentResult(
                success=False,
                status=PaymentStatus.FAILED,
                message="No payment gateway configured"
            )
        
        return await self.gateway.check_status(transaction_id)
    
    async def refund(self, request: RefundRequest) -> PaymentResult:
        """Process a refund"""
        if not self.gateway:
            return PaymentResult(
                success=False,
                status=PaymentStatus.FAILED,
                message="No payment gateway configured"
            )
        
        return await self.gateway.refund(request)
    
    def get_config_for_frontend(self) -> Dict[str, Any]:
        """Get safe configuration to pass to frontend"""
        if not self.gateway or not self.credentials:
            return {"gateway": "none", "configured": False}
        
        config = {
            "gateway": self.gateway_type.value,
            "configured": True,
            "environment": self.credentials.environment,
        }
        
        # Add gateway-specific frontend config
        if self.gateway_type == PaymentGatewayType.RAZORPAY:
            config["key_id"] = self.credentials.api_key  # Safe to expose
        elif self.gateway_type == PaymentGatewayType.EASEBUZZ:
            config["merchant_id"] = self.credentials.merchant_id or self.credentials.api_key
        
        return config


# Global singleton instance
_payment_manager: Optional[PaymentManager] = None


def get_payment_manager() -> PaymentManager:
    """Get or create the global payment manager instance"""
    global _payment_manager
    if _payment_manager is None:
        _payment_manager = PaymentManager()
    return _payment_manager
