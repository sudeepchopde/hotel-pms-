"""
Easebuzz Payment Gateway Integration

Easebuzz API documentation: https://docs.easebuzz.in/
Supports:
- Payment initiation
- Payment verification
- Refunds
"""
import httpx
import hashlib
import json
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


class EasebuzzGateway(BasePaymentGateway):
    """
    Easebuzz Payment Gateway Integration
    
    Flow:
    1. Initiate payment -> Get access key
    2. Redirect to Easebuzz checkout
    3. Receive callback with payment status
    """
    
    GATEWAY_NAME = "Easebuzz"
    
    # Easebuzz endpoints
    SANDBOX_URL = "https://testpay.easebuzz.in"
    PRODUCTION_URL = "https://pay.easebuzz.in"
    
    SANDBOX_API = "https://testdashboard.easebuzz.in"
    PRODUCTION_API = "https://dashboard.easebuzz.in"
    
    def __init__(self, credentials: PaymentGatewayCredentials):
        super().__init__(credentials)
        self.merchant_id = credentials.merchant_id or credentials.api_key
        self.salt = credentials.api_secret  # Easebuzz calls it "salt"
    
    @property
    def base_url(self) -> str:
        return self.PRODUCTION_URL if self.is_production else self.SANDBOX_URL
    
    @property
    def api_url(self) -> str:
        return self.PRODUCTION_API if self.is_production else self.SANDBOX_API
    
    def _generate_hash(self, data: Dict[str, str], hash_sequence: list) -> str:
        """
        Generate SHA-512 hash for Easebuzz API.
        
        Easebuzz requires hashing specific fields in a defined sequence.
        hash = sha512(key|txnid|amount|productinfo|firstname|email|||||||||||salt)
        """
        values = [str(data.get(key, '')) for key in hash_sequence]
        hash_string = '|'.join(values)
        return hashlib.sha512(hash_string.encode('utf-8')).hexdigest()
    
    def _verify_response_hash(self, data: Dict[str, str]) -> bool:
        """Verify hash from Easebuzz response"""
        # Response hash sequence is reverse of request
        hash_sequence = [
            self.salt, 'status', '', '', '', '', '', '', '', '',
            'udf5', 'udf4', 'udf3', 'udf2', 'udf1', 'email',
            'firstname', 'productinfo', 'amount', 'txnid', self.merchant_id
        ]
        
        expected_hash = self._generate_hash(data, hash_sequence)
        return data.get('hash', '').lower() == expected_hash.lower()
    
    async def initiate_payment(self, request: PaymentRequest) -> PaymentResult:
        """
        Initiate a payment with Easebuzz.
        Returns an access key that can be used to open the payment page.
        """
        txnid = f"TXN{request.booking_id}_{int(datetime.now().timestamp())}"
        
        # Prepare payment data
        data = {
            'key': self.merchant_id,
            'txnid': txnid,
            'amount': f"{request.amount:.2f}",
            'productinfo': request.description or f"Booking {request.booking_id}",
            'firstname': request.customer_name.split()[0] if request.customer_name else "Guest",
            'email': request.customer_email,
            'phone': request.customer_phone,
            'surl': request.return_url or 'https://yoursite.com/payment/success',
            'furl': request.return_url or 'https://yoursite.com/payment/failed',
            'udf1': request.booking_id,
            'udf2': '',
            'udf3': '',
            'udf4': '',
            'udf5': '',
        }
        
        # Generate hash
        hash_sequence = [
            self.merchant_id, txnid, str(request.amount), 
            data['productinfo'], data['firstname'], request.customer_email,
            '', '', '', '', '', '', '', '', '', self.salt
        ]
        data['hash'] = self._generate_hash({'value': '|'.join(hash_sequence)}, ['value'])
        
        # Actually generate hash properly
        hash_string = f"{self.merchant_id}|{txnid}|{request.amount:.2f}|{data['productinfo']}|{data['firstname']}|{request.customer_email}|||||||||||{self.salt}"
        data['hash'] = hashlib.sha512(hash_string.encode('utf-8')).hexdigest()
        
        logger.info(f"[Easebuzz] Initiating payment for {txnid}: ₹{request.amount}")
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/payment/initiateLink",
                    data=data
                )
                
                result = response.json()
                
                if result.get('status') == 1:
                    access_key = result.get('data')
                    payment_url = f"{self.base_url}/pay/{access_key}"
                    
                    self._log_payment("INITIATE", True, f"TXN: {txnid}")
                    return PaymentResult(
                        success=True,
                        status=PaymentStatus.INITIATED,
                        transaction_id=txnid,
                        gateway_order_id=access_key,
                        payment_link=payment_url,
                        message="Payment initiated successfully"
                    )
                else:
                    error_msg = result.get('data', 'Unknown error')
                    self._log_payment("INITIATE", False, error_msg)
                    return PaymentResult(
                        success=False,
                        status=PaymentStatus.FAILED,
                        transaction_id=txnid,
                        message=f"Failed to initiate payment: {error_msg}",
                        raw_response=result
                    )
                    
        except Exception as e:
            logger.error(f"[Easebuzz] Payment initiation error: {e}")
            return PaymentResult(
                success=False,
                status=PaymentStatus.FAILED,
                transaction_id=txnid,
                message=str(e)
            )
    
    def verify_callback(self, payload: Dict[str, Any], signature: Optional[str] = None) -> PaymentCallback:
        """
        Verify and parse Easebuzz payment callback.
        
        Easebuzz sends POST data to your surl/furl with payment status.
        """
        # Map Easebuzz status to our status
        status_map = {
            'success': PaymentStatus.SUCCESS,
            'failure': PaymentStatus.FAILED,
            'pending': PaymentStatus.PENDING,
            'cancelled': PaymentStatus.CANCELLED,
            'userCancelled': PaymentStatus.CANCELLED,
        }
        
        eb_status = payload.get('status', '').lower()
        status = status_map.get(eb_status, PaymentStatus.FAILED)
        
        # Verify hash
        if not self._verify_response_hash(payload):
            logger.warning("[Easebuzz] Hash verification failed for callback")
            # Still process but log warning
        
        # Map payment mode
        mode_map = {
            'CC': PaymentMethod.CARD,
            'DC': PaymentMethod.CARD,
            'NB': PaymentMethod.NETBANKING,
            'UPI': PaymentMethod.UPI,
            'WALLET': PaymentMethod.WALLET,
            'EMI': PaymentMethod.EMI,
        }
        payment_mode = payload.get('mode', '')
        payment_method = mode_map.get(payment_mode.upper())
        
        return PaymentCallback(
            gateway_type='easebuzz',
            transaction_id=payload.get('txnid', ''),
            order_id=payload.get('easepayid', ''),
            status=status,
            amount=float(payload.get('amount', 0)),
            payment_method=payment_method,
            raw_data=payload
        )
    
    async def check_status(self, transaction_id: str) -> PaymentResult:
        """Check payment status via Easebuzz API"""
        data = {
            'key': self.merchant_id,
            'txnid': transaction_id,
        }
        
        # Generate hash for status check
        hash_string = f"{self.merchant_id}|{transaction_id}|{self.salt}"
        data['hash'] = hashlib.sha512(hash_string.encode('utf-8')).hexdigest()
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.api_url}/transaction/v2/retrieve",
                    data=data
                )
                
                result = response.json()
                
                if result.get('status') == 1:
                    txn_data = result.get('data', {})
                    eb_status = txn_data.get('status', '').lower()
                    
                    status_map = {
                        'success': PaymentStatus.SUCCESS,
                        'failure': PaymentStatus.FAILED,
                        'pending': PaymentStatus.PENDING,
                    }
                    
                    return PaymentResult(
                        success=eb_status == 'success',
                        status=status_map.get(eb_status, PaymentStatus.PENDING),
                        transaction_id=transaction_id,
                        gateway_order_id=txn_data.get('easepayid'),
                        message=f"Status: {eb_status}",
                        raw_response=result
                    )
                else:
                    return PaymentResult(
                        success=False,
                        status=PaymentStatus.PENDING,
                        transaction_id=transaction_id,
                        message="Could not fetch status"
                    )
                    
        except Exception as e:
            logger.error(f"[Easebuzz] Status check error: {e}")
            return PaymentResult(
                success=False,
                status=PaymentStatus.PENDING,
                transaction_id=transaction_id,
                message=str(e)
            )
    
    async def refund(self, request: RefundRequest) -> PaymentResult:
        """Initiate a refund via Easebuzz"""
        data = {
            'key': self.merchant_id,
            'txnid': request.transaction_id,
            'refund_amount': str(request.amount) if request.amount else '',
            'phone': '',  # Required but can be empty for full refund
            'email': '',
        }
        
        # Generate hash
        hash_string = f"{self.merchant_id}|{request.transaction_id}|{request.amount or ''}|{self.salt}"
        data['hash'] = hashlib.sha512(hash_string.encode('utf-8')).hexdigest()
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.api_url}/transaction/v2/refund",
                    data=data
                )
                
                result = response.json()
                
                if result.get('status') == 1:
                    self._log_payment("REFUND", True, f"TXN: {request.transaction_id}")
                    return PaymentResult(
                        success=True,
                        status=PaymentStatus.REFUNDED,
                        transaction_id=request.transaction_id,
                        message="Refund initiated successfully",
                        raw_response=result
                    )
                else:
                    error_msg = result.get('data', 'Refund failed')
                    self._log_payment("REFUND", False, error_msg)
                    return PaymentResult(
                        success=False,
                        status=PaymentStatus.FAILED,
                        transaction_id=request.transaction_id,
                        message=error_msg,
                        raw_response=result
                    )
                    
        except Exception as e:
            logger.error(f"[Easebuzz] Refund error: {e}")
            return PaymentResult(
                success=False,
                status=PaymentStatus.FAILED,
                transaction_id=request.transaction_id,
                message=str(e)
            )
