"""
Razorpay Payment Gateway Integration

Razorpay API documentation: https://razorpay.com/docs/api/
Supports:
- Order creation
- Payment verification
- Refunds
"""
import httpx
import hmac
import hashlib
import json
import base64
from typing import Dict, Any, Optional
from datetime import datetime
import logging

from .base import BasePaymentGateway
from .models import (
    PaymentResult,
    PaymentStatus,
    PaymentRequest,
    PaymentCallback,
    RefundRequest,
    PaymentGatewayCredentials,
    PaymentMethod
)

logger = logging.getLogger(__name__)


class RazorpayGateway(BasePaymentGateway):
    """
    Razorpay Payment Gateway Integration
    
    Flow:
    1. Create order -> Get order_id
    2. Use Razorpay Checkout.js with order_id
    3. Verify payment signature
    4. Capture payment (if not auto-captured)
    """
    
    GATEWAY_NAME = "Razorpay"
    
    # Razorpay API endpoint
    API_URL = "https://api.razorpay.com/v1"
    
    def __init__(self, credentials: PaymentGatewayCredentials):
        super().__init__(credentials)
        self.key_id = credentials.api_key
        self.key_secret = credentials.api_secret
        self.webhook_secret = credentials.webhook_secret
    
    @property
    def base_url(self) -> str:
        return self.API_URL
    
    def _get_auth_header(self) -> Dict[str, str]:
        """Generate Basic Auth header for Razorpay API"""
        credentials = f"{self.key_id}:{self.key_secret}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return {
            "Authorization": f"Basic {encoded}",
            "Content-Type": "application/json"
        }
    
    def _verify_signature(self, order_id: str, payment_id: str, signature: str) -> bool:
        """
        Verify Razorpay payment signature.
        
        signature = hmac_sha256(order_id + "|" + payment_id, key_secret)
        """
        message = f"{order_id}|{payment_id}"
        expected_signature = hmac.new(
            self.key_secret.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(signature, expected_signature)
    
    def _verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        """Verify Razorpay webhook signature"""
        if not self.webhook_secret:
            return True  # Skip if no webhook secret configured
        
        expected = hmac.new(
            self.webhook_secret.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(signature, expected)
    
    async def initiate_payment(self, request: PaymentRequest) -> PaymentResult:
        """
        Create a Razorpay order.
        
        The order_id should be used with Razorpay Checkout.js on the frontend.
        """
        # Razorpay amount is in paise (smallest currency unit)
        amount_paise = int(request.amount * 100)
        
        order_data = {
            "amount": amount_paise,
            "currency": request.currency,
            "receipt": request.booking_id,
            "notes": {
                "booking_id": request.booking_id,
                "customer_name": request.customer_name,
                "customer_email": request.customer_email,
                "customer_phone": request.customer_phone,
                "description": request.description or f"Booking {request.booking_id}"
            }
        }
        
        logger.info(f"[Razorpay] Creating order for booking {request.booking_id}: ₹{request.amount}")
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/orders",
                    json=order_data,
                    headers=self._get_auth_header()
                )
                
                if response.status_code == 200:
                    result = response.json()
                    order_id = result.get('id')
                    
                    self._log_payment("ORDER_CREATE", True, f"Order: {order_id}")
                    
                    # Return order details for frontend to use with Checkout.js
                    return PaymentResult(
                        success=True,
                        status=PaymentStatus.INITIATED,
                        transaction_id=request.booking_id,
                        gateway_order_id=order_id,
                        message="Order created successfully",
                        raw_response={
                            "order_id": order_id,
                            "amount": amount_paise,
                            "currency": request.currency,
                            "key_id": self.key_id,  # Safe to expose
                            "name": "Hotel Booking",
                            "description": request.description or f"Booking {request.booking_id}",
                            "prefill": {
                                "name": request.customer_name,
                                "email": request.customer_email,
                                "contact": request.customer_phone
                            }
                        }
                    )
                else:
                    error = response.json()
                    error_msg = error.get('error', {}).get('description', 'Unknown error')
                    
                    self._log_payment("ORDER_CREATE", False, error_msg)
                    return PaymentResult(
                        success=False,
                        status=PaymentStatus.FAILED,
                        transaction_id=request.booking_id,
                        message=error_msg,
                        raw_response=error
                    )
                    
        except Exception as e:
            logger.error(f"[Razorpay] Order creation error: {e}")
            return PaymentResult(
                success=False,
                status=PaymentStatus.FAILED,
                transaction_id=request.booking_id,
                message=str(e)
            )
    
    def verify_callback(self, payload: Dict[str, Any], signature: Optional[str] = None) -> PaymentCallback:
        """
        Verify and parse Razorpay payment callback.
        
        After Checkout.js completes, it returns:
        - razorpay_order_id
        - razorpay_payment_id
        - razorpay_signature
        """
        order_id = payload.get('razorpay_order_id', '')
        payment_id = payload.get('razorpay_payment_id', '')
        razorpay_signature = payload.get('razorpay_signature', '')
        
        # Verify signature
        is_valid = self._verify_signature(order_id, payment_id, razorpay_signature)
        
        if is_valid:
            status = PaymentStatus.SUCCESS
            self._log_payment("VERIFY", True, f"Payment: {payment_id}")
        else:
            status = PaymentStatus.FAILED
            self._log_payment("VERIFY", False, "Signature mismatch")
        
        return PaymentCallback(
            gateway_type='razorpay',
            transaction_id=payment_id,
            order_id=order_id,
            status=status,
            amount=float(payload.get('amount', 0)) / 100,  # Convert from paise
            payment_method=None,  # Will be fetched from payment details if needed
            raw_data=payload
        )
    
    async def check_status(self, transaction_id: str) -> PaymentResult:
        """
        Fetch payment details from Razorpay.
        
        transaction_id here is the razorpay_payment_id
        """
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/payments/{transaction_id}",
                    headers=self._get_auth_header()
                )
                
                if response.status_code == 200:
                    result = response.json()
                    rp_status = result.get('status', '')
                    
                    status_map = {
                        'captured': PaymentStatus.SUCCESS,
                        'authorized': PaymentStatus.PENDING,
                        'created': PaymentStatus.PENDING,
                        'failed': PaymentStatus.FAILED,
                        'refunded': PaymentStatus.REFUNDED,
                    }
                    
                    status = status_map.get(rp_status, PaymentStatus.PENDING)
                    
                    return PaymentResult(
                        success=status == PaymentStatus.SUCCESS,
                        status=status,
                        transaction_id=transaction_id,
                        gateway_order_id=result.get('order_id'),
                        message=f"Status: {rp_status}",
                        raw_response=result
                    )
                else:
                    return PaymentResult(
                        success=False,
                        status=PaymentStatus.PENDING,
                        transaction_id=transaction_id,
                        message=f"Error fetching payment: {response.status_code}"
                    )
                    
        except Exception as e:
            logger.error(f"[Razorpay] Status check error: {e}")
            return PaymentResult(
                success=False,
                status=PaymentStatus.PENDING,
                transaction_id=transaction_id,
                message=str(e)
            )
    
    async def refund(self, request: RefundRequest) -> PaymentResult:
        """Initiate a refund via Razorpay"""
        refund_data = {
            "speed": "normal",
        }
        
        if request.amount:
            refund_data["amount"] = int(request.amount * 100)  # Convert to paise
        
        if request.reason:
            refund_data["notes"] = {"reason": request.reason}
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/payments/{request.transaction_id}/refund",
                    json=refund_data,
                    headers=self._get_auth_header()
                )
                
                if response.status_code == 200:
                    result = response.json()
                    refund_id = result.get('id')
                    
                    self._log_payment("REFUND", True, f"Refund: {refund_id}")
                    return PaymentResult(
                        success=True,
                        status=PaymentStatus.REFUNDED,
                        transaction_id=request.transaction_id,
                        gateway_order_id=refund_id,
                        message="Refund initiated successfully",
                        raw_response=result
                    )
                else:
                    error = response.json()
                    error_msg = error.get('error', {}).get('description', 'Refund failed')
                    
                    self._log_payment("REFUND", False, error_msg)
                    return PaymentResult(
                        success=False,
                        status=PaymentStatus.FAILED,
                        transaction_id=request.transaction_id,
                        message=error_msg,
                        raw_response=error
                    )
                    
        except Exception as e:
            logger.error(f"[Razorpay] Refund error: {e}")
            return PaymentResult(
                success=False,
                status=PaymentStatus.FAILED,
                transaction_id=request.transaction_id,
                message=str(e)
            )
    
    async def capture_payment(self, payment_id: str, amount: float) -> PaymentResult:
        """
        Capture an authorized payment.
        
        This is only needed if auto-capture is disabled.
        """
        capture_data = {
            "amount": int(amount * 100),
            "currency": "INR"
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/payments/{payment_id}/capture",
                    json=capture_data,
                    headers=self._get_auth_header()
                )
                
                if response.status_code == 200:
                    result = response.json()
                    self._log_payment("CAPTURE", True, f"Payment: {payment_id}")
                    return PaymentResult(
                        success=True,
                        status=PaymentStatus.SUCCESS,
                        transaction_id=payment_id,
                        message="Payment captured successfully",
                        raw_response=result
                    )
                else:
                    error = response.json()
                    error_msg = error.get('error', {}).get('description', 'Capture failed')
                    
                    self._log_payment("CAPTURE", False, error_msg)
                    return PaymentResult(
                        success=False,
                        status=PaymentStatus.FAILED,
                        transaction_id=payment_id,
                        message=error_msg,
                        raw_response=error
                    )
                    
        except Exception as e:
            logger.error(f"[Razorpay] Capture error: {e}")
            return PaymentResult(
                success=False,
                status=PaymentStatus.FAILED,
                transaction_id=payment_id,
                message=str(e)
            )
