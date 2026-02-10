"""
Payment Gateway API Routes

Endpoints for:
1. Managing payment gateway settings
2. Initiating payments
3. Receiving payment callbacks
4. Processing refunds
"""
from fastapi import APIRouter, Request, Response, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, Dict, Any
from datetime import datetime
import logging
import json

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import get_db
from backend.db_models import BookingDB, NotificationDB
from backend.payment_gateway.models import (
    PaymentResult,
    PaymentStatus,
    PaymentRequest,
    PaymentCallback,
    RefundRequest,
    PaymentGatewayCredentials,
    PaymentGatewayType
)
from backend.payment_gateway.manager import PaymentManager, get_payment_manager
from backend.payment_gateway.easebuzz import EasebuzzGateway
from backend.payment_gateway.razorpay import RazorpayGateway
from backend.encryption import encrypt_field, decrypt_field, mask_secret

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/payments", tags=["Payment Gateway"])


# ============================================================================
# PAYMENT GATEWAY SETTINGS
# ============================================================================

@router.get("/settings")
async def get_payment_settings(db: Session = Depends(get_db)):
    """Get current payment gateway settings (secrets masked)"""
    try:
        result = db.execute(text("""
            SELECT gateway_type, merchant_id, api_key, environment, is_active
            FROM payment_settings
            ORDER BY id DESC LIMIT 1
        """))
        row = result.fetchone()
        
        if row:
            return {
                "gateway_type": row[0],
                "merchant_id": row[1],
                "api_key": row[2][:8] + "..." if row[2] else None,
                "environment": row[3],
                "is_active": row[4],
                "configured": True
            }
        else:
            return {
                "gateway_type": "none",
                "configured": False
            }
    except Exception as e:
        # Table might not exist yet
        return {
            "gateway_type": "none",
            "configured": False,
            "error": str(e)
        }


@router.post("/settings")
async def save_payment_settings(request: Request, db: Session = Depends(get_db)):
    """
    Save payment gateway settings.
    
    Body:
    {
        "gateway_type": "easebuzz" | "razorpay",
        "merchant_id": "MERCHANT123",  // Easebuzz only
        "api_key": "your_key_id",
        "api_secret": "your_secret_key",
        "webhook_secret": "optional_webhook_secret",  // Razorpay only
        "environment": "sandbox" | "production"
    }
    """
    body = await request.json()
    
    gateway_type = body.get("gateway_type", "none")
    merchant_id = body.get("merchant_id", "")
    api_key = body.get("api_key", "")
    api_secret = body.get("api_secret", "")
    webhook_secret = body.get("webhook_secret", "")
    environment = body.get("environment", "sandbox")
    
    if gateway_type not in ["easebuzz", "razorpay", "none"]:
        raise HTTPException(status_code=400, detail="Invalid gateway_type")
    
    # Encrypt sensitive fields before storing
    encrypted_api_secret = encrypt_field(api_secret) if api_secret else ""
    encrypted_webhook_secret = encrypt_field(webhook_secret) if webhook_secret else ""
    
    now = datetime.utcnow().isoformat()
    
    try:
        # Check if settings exist
        result = db.execute(text("SELECT id FROM payment_settings LIMIT 1"))
        existing = result.fetchone()
        
        if existing:
            db.execute(text("""
                UPDATE payment_settings 
                SET gateway_type = :gateway_type,
                    merchant_id = :merchant_id,
                    api_key = :api_key,
                    api_secret = :api_secret,
                    webhook_secret = :webhook_secret,
                    environment = :environment,
                    is_active = :is_active,
                    updated_at = :updated_at
                WHERE id = :id
            """), {
                "id": existing[0],
                "gateway_type": gateway_type,
                "merchant_id": merchant_id,
                "api_key": api_key,
                "api_secret": encrypted_api_secret,  # Encrypted
                "webhook_secret": encrypted_webhook_secret,  # Encrypted
                "environment": environment,
                "is_active": gateway_type != "none",
                "updated_at": now
            })
        else:
            db.execute(text("""
                INSERT INTO payment_settings 
                (gateway_type, merchant_id, api_key, api_secret, webhook_secret, environment, is_active, created_at, updated_at)
                VALUES (:gateway_type, :merchant_id, :api_key, :api_secret, :webhook_secret, :environment, :is_active, :created_at, :updated_at)
            """), {
                "gateway_type": gateway_type,
                "merchant_id": merchant_id,
                "api_key": api_key,
                "api_secret": encrypted_api_secret,  # Encrypted
                "webhook_secret": encrypted_webhook_secret,  # Encrypted
                "environment": environment,
                "is_active": gateway_type != "none",
                "created_at": now,
                "updated_at": now
            })
        
        db.commit()
        
        # Configure the payment manager
        if gateway_type != "none":
            manager = get_payment_manager()
            manager.configure(PaymentGatewayCredentials(
                gateway_type=PaymentGatewayType(gateway_type),
                merchant_id=merchant_id,
                api_key=api_key,
                api_secret=api_secret,
                webhook_secret=webhook_secret,
                environment=environment
            ))
        
        return {"success": True, "message": f"Payment gateway configured: {gateway_type}"}
        
    except Exception as e:
        logger.error(f"Error saving payment settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/config")
async def get_frontend_config(db: Session = Depends(get_db)):
    """Get payment configuration for frontend checkout"""
    manager = await _get_configured_manager(db)
    return manager.get_config_for_frontend()


# ============================================================================
# PAYMENT OPERATIONS
# ============================================================================

@router.post("/initiate")
async def initiate_payment(request: Request, db: Session = Depends(get_db)):
    """
    Initiate a payment for a booking.
    
    Body:
    {
        "booking_id": "BK12345",
        "amount": 4500.00,
        "customer_name": "Guest Name",
        "customer_email": "guest@email.com",
        "customer_phone": "9876543210",
        "description": "Room booking payment",
        "return_url": "https://yoursite.com/booking/confirm"
    }
    """
    body = await request.json()
    
    booking_id = body.get("booking_id")
    amount = body.get("amount")
    
    if not booking_id or not amount:
        raise HTTPException(status_code=400, detail="booking_id and amount are required")
    
    manager = await _get_configured_manager(db)
    
    if not manager.is_configured:
        raise HTTPException(status_code=503, detail="No payment gateway configured")
    
    payment_request = PaymentRequest(
        booking_id=booking_id,
        amount=float(amount),
        customer_name=body.get("customer_name", "Guest"),
        customer_email=body.get("customer_email", ""),
        customer_phone=body.get("customer_phone", ""),
        description=body.get("description"),
        return_url=body.get("return_url")
    )
    
    result = await manager.initiate_payment(payment_request)
    
    # Log the payment initiation
    _log_payment_event(db, booking_id, "initiated", result)
    
    return {
        "success": result.success,
        "status": result.status.value,
        "transaction_id": result.transaction_id,
        "order_id": result.gateway_order_id,
        "payment_link": result.payment_link,
        "message": result.message,
        "gateway_config": result.raw_response if result.success else None
    }


@router.post("/verify")
async def verify_payment(request: Request, db: Session = Depends(get_db)):
    """
    Verify a payment after checkout completion.
    
    For Razorpay, send:
    {
        "razorpay_order_id": "order_xxx",
        "razorpay_payment_id": "pay_xxx",
        "razorpay_signature": "signature"
    }
    
    For Easebuzz, the callback data is sent directly.
    """
    body = await request.json()
    
    manager = await _get_configured_manager(db)
    
    if not manager.is_configured:
        raise HTTPException(status_code=503, detail="No payment gateway configured")
    
    try:
        callback = manager.verify_callback(body)
        
        # Update booking payment status
        if callback.status == PaymentStatus.SUCCESS:
            _update_booking_payment(db, callback)
        
        # Log the verification
        booking_id = body.get("booking_id") or callback.raw_data.get("udf1", "")
        _log_payment_event(db, booking_id, "verified", PaymentResult(
            success=callback.status == PaymentStatus.SUCCESS,
            status=callback.status,
            transaction_id=callback.transaction_id,
            gateway_order_id=callback.order_id
        ))
        
        return {
            "success": callback.status == PaymentStatus.SUCCESS,
            "status": callback.status.value,
            "transaction_id": callback.transaction_id,
            "order_id": callback.order_id,
            "amount": callback.amount
        }
        
    except Exception as e:
        logger.error(f"Payment verification error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/status/{transaction_id}")
async def check_payment_status(transaction_id: str, db: Session = Depends(get_db)):
    """Check the status of a payment"""
    manager = await _get_configured_manager(db)
    
    if not manager.is_configured:
        raise HTTPException(status_code=503, detail="No payment gateway configured")
    
    result = await manager.check_status(transaction_id)
    
    return {
        "success": result.success,
        "status": result.status.value,
        "transaction_id": result.transaction_id,
        "message": result.message
    }


@router.post("/refund")
async def process_refund(request: Request, db: Session = Depends(get_db)):
    """
    Process a refund for a payment.
    
    Body:
    {
        "transaction_id": "pay_xxx or TXN123",
        "amount": 1000.00,  // Optional, full refund if not specified
        "reason": "Cancellation refund"
    }
    """
    body = await request.json()
    
    transaction_id = body.get("transaction_id")
    if not transaction_id:
        raise HTTPException(status_code=400, detail="transaction_id is required")
    
    manager = await _get_configured_manager(db)
    
    if not manager.is_configured:
        raise HTTPException(status_code=503, detail="No payment gateway configured")
    
    refund_request = RefundRequest(
        transaction_id=transaction_id,
        amount=body.get("amount"),
        reason=body.get("reason")
    )
    
    result = await manager.refund(refund_request)
    
    # Log the refund
    _log_payment_event(db, "", "refunded", result)
    
    return {
        "success": result.success,
        "status": result.status.value,
        "transaction_id": result.transaction_id,
        "message": result.message
    }


# ============================================================================
# WEBHOOKS
# ============================================================================

@router.post("/webhooks/easebuzz")
async def easebuzz_webhook(request: Request, db: Session = Depends(get_db)):
    """Webhook endpoint for Easebuzz payment notifications"""
    form_data = await request.form()
    payload = dict(form_data)
    
    logger.info("[Easebuzz Webhook] Received notification")
    
    try:
        manager = await _get_configured_manager(db)
        
        if manager.gateway_type != PaymentGatewayType.EASEBUZZ:
            return {"status": "ignored", "message": "Easebuzz not configured"}
        
        callback = manager.verify_callback(payload)
        
        # Update booking
        if callback.status == PaymentStatus.SUCCESS:
            _update_booking_payment(db, callback)
        
        return {"status": "ok"}
        
    except Exception as e:
        logger.error(f"[Easebuzz Webhook] Error: {e}")
        return {"status": "error", "message": str(e)}


@router.post("/webhooks/razorpay")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    """Webhook endpoint for Razorpay payment notifications"""
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    
    logger.info("[Razorpay Webhook] Received notification")
    
    try:
        payload = json.loads(body)
        event_type = payload.get("event", "")
        
        # Handle payment captured event
        if event_type == "payment.captured":
            payment_data = payload.get("payload", {}).get("payment", {}).get("entity", {})
            
            # Create a callback-like structure
            callback = PaymentCallback(
                gateway_type=PaymentGatewayType.RAZORPAY,
                transaction_id=payment_data.get("id", ""),
                order_id=payment_data.get("order_id", ""),
                status=PaymentStatus.SUCCESS,
                amount=float(payment_data.get("amount", 0)) / 100,
                raw_data=payload
            )
            
            _update_booking_payment(db, callback)
        
        return {"status": "ok"}
        
    except Exception as e:
        logger.error(f"[Razorpay Webhook] Error: {e}")
        return {"status": "error", "message": str(e)}


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def _get_configured_manager(db: Session) -> PaymentManager:
    """Get payment manager with credentials loaded from database"""
    manager = get_payment_manager()
    
    # Check if already configured
    if manager.is_configured:
        return manager
    
    # Load from database
    try:
        result = db.execute(text("""
            SELECT gateway_type, merchant_id, api_key, api_secret, webhook_secret, environment
            FROM payment_settings
            WHERE is_active = true
            ORDER BY id DESC LIMIT 1
        """))
        row = result.fetchone()
        
        if row and row[0] != "none":
            # Decrypt secrets when loading
            decrypted_api_secret = decrypt_field(row[3]) if row[3] else ""
            decrypted_webhook_secret = decrypt_field(row[4]) if row[4] else ""
            
            manager.configure(PaymentGatewayCredentials(
                gateway_type=PaymentGatewayType(row[0]),
                merchant_id=row[1],
                api_key=row[2],
                api_secret=decrypted_api_secret,
                webhook_secret=decrypted_webhook_secret,
                environment=row[5]
            ))
    except Exception as e:
        logger.warning(f"Could not load payment settings: {e}")
    
    return manager


def _update_booking_payment(db: Session, callback: PaymentCallback):
    """Update booking with payment information"""
    try:
        # Extract booking_id from callback data
        booking_id = callback.raw_data.get("udf1") or callback.raw_data.get("notes", {}).get("booking_id")
        
        if booking_id:
            db.execute(text("""
                UPDATE bookings 
                SET payment_status = :status,
                    payment_transaction_id = :txn_id,
                    payment_gateway = :gateway,
                    payment_amount = :amount
                WHERE id = :booking_id
            """), {
                "status": "paid" if callback.status == PaymentStatus.SUCCESS else "pending",
                "txn_id": callback.transaction_id,
                "gateway": callback.gateway_type.value if hasattr(callback.gateway_type, 'value') else callback.gateway_type,
                "amount": callback.amount,
                "booking_id": booking_id
            })
            db.commit()
            
            # Create notification
            if callback.status == PaymentStatus.SUCCESS:
                notification = NotificationDB(
                    type="payment",
                    category="payment_received",
                    title="Payment Received",
                    message=f"Payment of ₹{callback.amount:.2f} received for booking {booking_id}",
                    priority="medium",
                    is_read=False,
                    is_dismissed=False,
                    timestamp=int(datetime.now().timestamp() * 1000),
                    created_at=datetime.utcnow().isoformat()
                )
                db.add(notification)
                db.commit()
                
    except Exception as e:
        logger.error(f"Error updating booking payment: {e}")


def _log_payment_event(db: Session, booking_id: str, event_type: str, result: PaymentResult):
    """Log payment events for audit trail"""
    try:
        db.execute(text("""
            INSERT INTO payment_logs 
            (booking_id, event_type, transaction_id, status, message, created_at)
            VALUES (:booking_id, :event_type, :txn_id, :status, :message, :created_at)
        """), {
            "booking_id": booking_id,
            "event_type": event_type,
            "txn_id": result.transaction_id,
            "status": result.status.value,
            "message": result.message,
            "created_at": datetime.utcnow().isoformat()
        })
        db.commit()
    except Exception as e:
        # Log table might not exist, that's okay
        logger.debug(f"Could not log payment event: {e}")
