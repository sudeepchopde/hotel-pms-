"""
Channel Sync API Routes

Endpoints for:
1. Pushing rates/availability to OTAs
2. Receiving booking webhooks from OTAs
3. Managing channel credentials
4. Viewing sync history
"""
from fastapi import APIRouter, Request, Response, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import logging
import json

# Import from parent
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import get_db, SessionLocal
from backend.db_models import (
    SyncHistoryDB, 
    ChannelCredentialsDB, 
    RoomTypeMappingDB,
    BookingDB,
    NotificationDB,
    RoomTypeDB,
    RateRulesDB
)

# Import directly from modules to avoid circular imports
from backend.channel_manager.models import (
    SyncResult,
    SyncStatus,
    SyncType,
    ChannelCredentials,
    RoomTypeMapping
)
from backend.channel_manager.manager import ChannelSyncManager, get_sync_manager
from backend.channel_manager.mmt import MMTChannelManager
from backend.channel_manager.booking_com import BookingComChannelManager
from backend.encryption import encrypt_field, decrypt_field, mask_secret



logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/channels", tags=["Channel Manager"])


# ============================================================================
# RATE & AVAILABILITY SYNC ENDPOINTS
# ============================================================================

@router.post("/sync/rates")
async def sync_rates_to_channels(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Push rate updates to all connected OTA channels.
    
    Body:
    {
        "room_type_id": "rt-1",
        "start_date": "2026-02-10",
        "end_date": "2026-02-15",
        "single_rate": 3800,
        "double_rate": 4500,
        "extra_bed_rate": 1200,
        "channels": ["mmt", "booking"]  // Optional, defaults to all
    }
    """
    body = await request.json()
    
    room_type_id = body.get("room_type_id")
    start_date = body.get("start_date")
    end_date = body.get("end_date")
    single_rate = body.get("single_rate", body.get("double_rate", 0) * 0.85)
    double_rate = body.get("double_rate", 0)
    extra_adult_rate = body.get("extra_adult_rate", body.get("extra_bed_rate", 0))
    extra_child_rate = body.get("extra_child_rate", 0)
    target_channels = body.get("channels")
    
    if not all([room_type_id, start_date, end_date, double_rate]):
        raise HTTPException(status_code=400, detail="Missing required fields")
    
    # Initialize sync manager with credentials from DB
    sync_manager = await _initialize_sync_manager(db)
    
    # Log the sync request
    sync_record = SyncHistoryDB(
        channel_id="all" if not target_channels else ",".join(target_channels),
        sync_type="rate",
        room_type_id=room_type_id,
        date_range_start=start_date,
        date_range_end=end_date,
        status="pending",
        request_payload=body,
        created_at=datetime.utcnow().isoformat()
    )
    db.add(sync_record)
    db.commit()
    
    # Execute sync
    try:
        results = await sync_manager.sync_rates(
            room_type_id=room_type_id,
            start_date=start_date,
            end_date=end_date,
            single_rate=single_rate,
            double_rate=double_rate,
            extra_adult_rate=extra_adult_rate,
            extra_child_rate=extra_child_rate,
            target_channels=target_channels
        )
        
        # Update sync record
        all_success = all(r.success for r in results.values())
        sync_record.status = "success" if all_success else "partial_failure"
        sync_record.completed_at = datetime.utcnow().isoformat()
        sync_record.response_payload = json.dumps({
            ch: {"success": r.success, "message": r.message}
            for ch, r in results.items()
        })
        db.commit()
        
        return {
            "success": all_success,
            "results": {
                ch: {
                    "success": r.success,
                    "status": r.status.value,
                    "message": r.message,
                    "retry_count": r.retry_count
                }
                for ch, r in results.items()
            }
        }
        
    except Exception as e:
        sync_record.status = "failed"
        sync_record.message = str(e)
        db.commit()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync/availability")
async def sync_availability_to_channels(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Push availability updates to all connected OTA channels.
    
    Body:
    {
        "room_type_id": "rt-1",
        "start_date": "2026-02-10",
        "end_date": "2026-02-15",
        "available_count": 5,
        "stop_sell": false,
        "min_stay": 1,
        "channels": ["mmt"]  // Optional
    }
    """
    body = await request.json()
    
    room_type_id = body.get("room_type_id")
    start_date = body.get("start_date")
    end_date = body.get("end_date")
    available_count = body.get("available_count", 0)
    stop_sell = body.get("stop_sell", False)
    min_stay = body.get("min_stay", 1)
    target_channels = body.get("channels")
    
    if not all([room_type_id, start_date, end_date]):
        raise HTTPException(status_code=400, detail="Missing required fields")
    
    sync_manager = await _initialize_sync_manager(db)
    
    # Log sync request
    sync_record = SyncHistoryDB(
        channel_id="all" if not target_channels else ",".join(target_channels),
        sync_type="availability",
        room_type_id=room_type_id,
        date_range_start=start_date,
        date_range_end=end_date,
        status="pending",
        request_payload=body,
        created_at=datetime.utcnow().isoformat()
    )
    db.add(sync_record)
    db.commit()
    
    try:
        results = await sync_manager.sync_availability(
            room_type_id=room_type_id,
            start_date=start_date,
            end_date=end_date,
            available_count=available_count,
            stop_sell=stop_sell,
            min_stay=min_stay,
            target_channels=target_channels
        )
        
        all_success = all(r.success for r in results.values())
        sync_record.status = "success" if all_success else "partial_failure"
        sync_record.completed_at = datetime.utcnow().isoformat()
        db.commit()
        
        return {
            "success": all_success,
            "results": {
                ch: {
                    "success": r.success,
                    "status": r.status.value,
                    "message": r.message
                }
                for ch, r in results.items()
            }
        }
        
    except Exception as e:
        sync_record.status = "failed"
        sync_record.message = str(e)
        db.commit()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync/strategy")
async def sync_strategy_to_channels(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Initiates a background task to recalculate rates for all room types 
    over the next 30 days based on active Yield Rules and push them to OTAs.
    """
    rules = db.query(RateRulesDB).filter(RateRulesDB.id == "default").first()
    if not rules:
        raise HTTPException(status_code=404, detail="No active rate rules found")
    
    room_types = db.query(RoomTypeDB).all()
    if not room_types:
        raise HTTPException(status_code=404, detail="No room types configured")

    # Initializing sync manager
    sync_manager = await _initialize_sync_manager(db)
    
    # Prepare data for background task by converting to dicts
    room_types_data = [
        {
            "id": rt.id,
            "base_price": rt.base_price,
            "floor_price": rt.floor_price,
            "ceiling_price": rt.ceiling_price
        }
        for rt in room_types
    ]
    rules_data = {
        "weeklyRules": rules.weekly_rules,
        "specialEvents": rules.special_events
    }

    # We use a 30-day window for strategy enforcement
    start_date_env = datetime.now()
    end_date_env = start_date_env + timedelta(days=30)
    
    background_tasks.add_task(
        run_bulk_strategy_sync,
        room_types_data,
        rules_data,
        start_date_env,
        end_date_env
    )
    
    return {
        "success": True, 
        "message": f"Strategy sync initiated for {len(room_types)} room categories over 30 days."
    }

async def run_bulk_strategy_sync(room_types_data, rules_data, start_date, end_date):
    """
    Worker function to calculate and push rates in batches.
    Uses its own DB session to ensure persistence and logs each batch.
    """
    db = SessionLocal()
    try:
        # Re-initialize sync manager inside the background task if needed,
        # or we could have passed it, but it might have closed connections.
        # Actually, let's just initialize it here.
        sync_manager = await _initialize_sync_manager(db)
        
        for rt in room_types_data:
            current_date = start_date
            range_start = current_date
            last_rate = None
            
            while current_date <= end_date:
                rate = calculate_resolved_rate_from_data(rt, current_date, rules_data)
                
                if last_rate is not None and rate != last_rate:
                    s_date = range_start.strftime('%Y-%m-%d')
                    e_date = (current_date - timedelta(days=1)).strftime('%Y-%m-%d')
                    
                    results = await sync_manager.sync_rates(
                        room_type_id=rt['id'],
                        start_date=s_date,
                        end_date=e_date,
                        double_rate=last_rate,
                        single_rate=round(last_rate * 0.85)
                    )
                    
                    # Log to DB
                    _log_batch_sync(db, rt['id'], s_date, e_date, results)
                    range_start = current_date
                
                last_rate = rate
                current_date += timedelta(days=1)
            
            # Final range
            if last_rate is not None:
                s_date = range_start.strftime('%Y-%m-%d')
                e_date = end_date.strftime('%Y-%m-%d')
                results = await sync_manager.sync_rates(
                    room_type_id=rt['id'],
                    start_date=s_date,
                    end_date=e_date,
                    double_rate=last_rate,
                    single_rate=round(last_rate * 0.85)
                )
                _log_batch_sync(db, rt['id'], s_date, e_date, results)

    except Exception as e:
        logger.error(f"Strategy sync background task failed: {e}")
    finally:
        db.close()

def _log_batch_sync(db, room_type_id, start_date, end_date, results):
    """Helper to log batch results to SyncHistoryDB"""
    try:
        all_success = all(r.success for r in results.values())
        sync_record = SyncHistoryDB(
            channel_id="all" if len(results) > 1 else list(results.keys())[0] if results else "none",
            sync_type="rate",
            room_type_id=room_type_id,
            date_range_start=start_date,
            date_range_end=end_date,
            status="success" if all_success else "partial_failure",
            message=f"Strategy Sync: Batch {start_date} to {end_date}",
            response_payload=json.dumps({
                ch: {"success": r.success, "message": r.message}
                for ch, r in results.items()
            }),
            created_at=datetime.utcnow().isoformat(),
            completed_at=datetime.utcnow().isoformat()
        )
        db.add(sync_record)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to log batch sync: {e}")

def calculate_resolved_rate_from_data(room_type, date, rules):
    """Calculates the rate using raw data dictionaries from room_type and rules."""
    base_price = room_type['base_price']
    floor_price = room_type['floor_price']
    ceiling_price = room_type['ceiling_price']
    
    applied_modifier = None
    
    # 1. Special Events
    special_events = rules.get('specialEvents', [])
    for event in special_events:
        try:
            e_start = datetime.strptime(event['startDate'], '%Y-%m-%d')
            e_end = datetime.strptime(event['endDate'], '%Y-%m-%d')
            target = date.replace(hour=0, minute=0, second=0, microsecond=0)
            if e_start <= target <= e_end:
                applied_modifier = event
                break
        except Exception:
            continue
            
    # 2. Weekly Baseline
    weekly = rules.get('weeklyRules', {})
    if not applied_modifier and weekly.get('isActive'):
        js_weekday = (date.weekday() + 1) % 7
        if js_weekday in weekly.get('activeDays', []):
            applied_modifier = weekly
            
    # 3. Apply Multiplier
    resolved_price = base_price
    if applied_modifier:
        mod_type = applied_modifier.get('modifierType')
        mod_val = applied_modifier.get('modifierValue')
        if mod_type == 'percentage':
            resolved_price = base_price * mod_val
        elif mod_type == 'fixed':
            resolved_price = base_price + mod_val
            
    return round(max(floor_price, min(ceiling_price, resolved_price)))

def calculate_resolved_rate(room_type, date, rules):
    """Calculates the rate for a specific date considering yield rules and safety guardrails."""
    base_price = room_type.base_price
    applied_modifier = None
    
    # 1. Check Special Events (Highest Priority)
    special_events = rules.special_events or []
    for event in special_events:
        try:
            e_start = datetime.strptime(event['startDate'], '%Y-%m-%d')
            e_end = datetime.strptime(event['endDate'], '%Y-%m-%d')
            # Normalize dates for comparison
            target = date.replace(hour=0, minute=0, second=0, microsecond=0)
            if e_start <= target <= e_end:
                applied_modifier = event
                break
        except Exception:
            continue
            
    # 2. Check Weekly Baseline (Lower Priority)
    if not applied_modifier and rules.weekly_rules and rules.weekly_rules.get('isActive'):
        weekly = rules.weekly_rules
        # Convert Python weekday (0-6, Mon-Sun) to JS/Rules weekday (0-6, Sun-Sat)
        js_weekday = (date.weekday() + 1) % 7
        if js_weekday in weekly.get('activeDays', []):
            applied_modifier = weekly
            
    # 3. Apply Multiplier/Fixed Adjustment
    resolved_price = base_price
    if applied_modifier:
        mod_type = applied_modifier.get('modifierType')
        mod_val = applied_modifier.get('modifierValue')
        
        if mod_type == 'percentage':
            # Note: in rules, 1.2 represents +20%
            resolved_price = base_price * mod_val
        elif mod_type == 'fixed':
            resolved_price = base_price + mod_val
            
    # 4. Safety Guardrails (Unbreakable Floor/Ceiling)
    resolved_price = max(room_type.floor_price, min(room_type.ceiling_price, resolved_price))
    
    return round(resolved_price)


# ============================================================================
# OTA BOOKING WEBHOOKS
# ============================================================================

@router.post("/webhooks/mmt/booking")
async def receive_mmt_booking(request: Request, db: Session = Depends(get_db)):
    """
    Webhook endpoint for receiving booking notifications from MakeMyTrip.
    MMT sends OTA XML format (OTA_HotelResNotifRQ).
    """
    body = await request.body()
    content_type = request.headers.get("content-type", "")
    
    logger.info(f"[MMT Webhook] Received booking notification")
    
    try:
        # Get MMT credentials to initialize the channel manager
        creds = db.query(ChannelCredentialsDB).filter(
            ChannelCredentialsDB.channel_id == "mmt"
        ).first()
        
        if not creds:
            # Use dummy credentials for parsing (webhook doesn't need auth)
            mmt = MMTChannelManager(ChannelCredentials(
                channel_id="mmt",
                hotel_id="",
                api_key="",
                environment="production"
            ))
        else:
            mmt = MMTChannelManager(ChannelCredentials(
                channel_id=creds.channel_id,
                hotel_id=creds.hotel_id,
                api_key=creds.api_key,
                api_secret=decrypt_field(creds.api_secret) if creds.api_secret else None,
                username=creds.username,
                password=decrypt_field(creds.password) if creds.password else None,
                environment=creds.environment
            ))
        
        # Parse the booking
        booking = mmt.parse_booking_webhook(body)
        
        # Map OTA room code to internal room type
        room_mapping = db.query(RoomTypeMappingDB).filter(
            RoomTypeMappingDB.mmt_code == booking.room_type_code
        ).first()
        
        internal_room_type_id = room_mapping.internal_room_type_id if room_mapping else booking.room_type_code
        
        # Create or update booking in database
        if booking.status == "cancelled":
            # Find and cancel existing booking
            existing = db.query(BookingDB).filter(
                BookingDB.external_reference_id == booking.reservation_id
            ).first()
            
            if existing:
                existing.status = "Cancelled"
                db.commit()
                
                # Create notification
                _create_notification(
                    db,
                    notif_type="reservation",
                    category="cancellation",
                    title="MMT Booking Cancelled",
                    message=f"Booking {booking.reservation_id} has been cancelled",
                    priority="high"
                )
        else:
            # Create new booking
            new_booking = BookingDB(
                id=f"MMT-{booking.reservation_id}",
                room_type_id=internal_room_type_id,
                guest_name=booking.guest_name,
                guest_email=booking.guest_email,
                guest_phone=booking.guest_phone,
                source="MakeMyTrip",
                status="Confirmed",
                timestamp=int(datetime.now().timestamp() * 1000),
                check_in=booking.check_in,
                check_out=booking.check_out,
                guest_count=booking.num_guests,
                amount=booking.total_amount,
                is_auto_generated=True,
                external_reference_id=booking.reservation_id,
                metadata={"raw_payload": booking.raw_payload}
            )
            
            db.add(new_booking)
            db.commit()
            
            # Create notification
            _create_notification(
                db,
                notif_type="reservation",
                category="new_booking",
                title="New MMT Booking",
                message=f"Booking {booking.reservation_id} received for {booking.guest_name}",
                priority="high"
            )
        
        # Log the webhook
        sync_record = SyncHistoryDB(
            channel_id="mmt",
            sync_type="booking",
            room_type_id=internal_room_type_id,
            date_range_start=booking.check_in,
            date_range_end=booking.check_out,
            status="success",
            message=f"Processed {booking.status} booking",
            request_payload={"reservation_id": booking.reservation_id},
            created_at=datetime.utcnow().isoformat(),
            completed_at=datetime.utcnow().isoformat()
        )
        db.add(sync_record)
        db.commit()
        
        # Return OTA success response
        return Response(
            content=mmt.build_booking_response(True),
            media_type="application/xml"
        )
        
    except Exception as e:
        logger.error(f"[MMT Webhook] Error processing booking: {e}")
        
        # Log failure
        sync_record = SyncHistoryDB(
            channel_id="mmt",
            sync_type="booking",
            status="failed",
            message=str(e),
            request_payload={"raw": body.decode('utf-8', errors='ignore')[:1000]},
            created_at=datetime.utcnow().isoformat()
        )
        db.add(sync_record)
        db.commit()
        
        # Return OTA error response
        mmt = MMTChannelManager(ChannelCredentials(
            channel_id="mmt", hotel_id="", api_key="", environment="production"
        ))
        return Response(
            content=mmt.build_booking_response(False, str(e)),
            media_type="application/xml",
            status_code=500
        )


@router.post("/webhooks/booking/booking")
async def receive_booking_com_booking(request: Request, db: Session = Depends(get_db)):
    """
    Webhook endpoint for receiving booking notifications from Booking.com.
    Booking.com sends JSON payloads.
    """
    body = await request.body()
    
    logger.info(f"[Booking.com Webhook] Received booking notification")
    
    try:
        bcom = BookingComChannelManager(ChannelCredentials(
            channel_id="booking",
            hotel_id="",
            api_key="",
            environment="production"
        ))
        
        booking = bcom.parse_booking_webhook(body)
        
        # Map room code
        room_mapping = db.query(RoomTypeMappingDB).filter(
            RoomTypeMappingDB.booking_com_code == booking.room_type_code
        ).first()
        
        internal_room_type_id = room_mapping.internal_room_type_id if room_mapping else booking.room_type_code
        
        # Process booking (similar to MMT)
        if booking.status == "cancelled":
            existing = db.query(BookingDB).filter(
                BookingDB.external_reference_id == booking.reservation_id
            ).first()
            if existing:
                existing.status = "Cancelled"
                db.commit()
        else:
            new_booking = BookingDB(
                id=f"BCOM-{booking.reservation_id}",
                room_type_id=internal_room_type_id,
                guest_name=booking.guest_name,
                source="Booking.com",
                status="Confirmed",
                timestamp=int(datetime.now().timestamp() * 1000),
                check_in=booking.check_in,
                check_out=booking.check_out,
                guest_count=booking.num_guests,
                amount=booking.total_amount,
                is_auto_generated=True,
                external_reference_id=booking.reservation_id
            )
            db.add(new_booking)
            db.commit()
            
            _create_notification(
                db,
                notif_type="reservation",
                category="new_booking",
                title="New Booking.com Booking",
                message=f"Booking {booking.reservation_id} received",
                priority="high"
            )
        
        return Response(
            content=bcom.build_booking_response(True),
            media_type="application/json"
        )
        
    except Exception as e:
        logger.error(f"[Booking.com Webhook] Error: {e}")
        bcom = BookingComChannelManager(ChannelCredentials(
            channel_id="booking", hotel_id="", api_key="", environment="production"
        ))
        return Response(
            content=bcom.build_booking_response(False, str(e)),
            media_type="application/json",
            status_code=500
        )


# ============================================================================
# CHANNEL CREDENTIALS MANAGEMENT
# ============================================================================

@router.get("/credentials")
async def list_channel_credentials(db: Session = Depends(get_db)):
    """List all configured channel credentials (secrets masked)"""
    creds = db.query(ChannelCredentialsDB).all()
    
    return [
        {
            "channel_id": c.channel_id,
            "hotel_id": c.hotel_id,
            "api_key": mask_secret(c.api_key) if c.api_key else None,
            "has_secret": True if c.api_secret else False,
            "has_password": True if c.password else False,
            "environment": c.environment,
            "is_active": c.is_active
        }
        for c in creds
    ]


@router.post("/credentials")
async def save_channel_credentials(request: Request, db: Session = Depends(get_db)):
    """
    Save or update channel credentials.
    
    Body:
    {
        "channel_id": "mmt",
        "hotel_id": "MMT_HOTEL_12345",
        "api_key": "your_api_key",
        "api_secret": "your_api_secret",
        "environment": "sandbox"
    }
    """
    body = await request.json()
    
    channel_id = body.get("channel_id")
    if not channel_id:
        raise HTTPException(status_code=400, detail="channel_id is required")
    
    existing = db.query(ChannelCredentialsDB).filter(
        ChannelCredentialsDB.channel_id == channel_id
    ).first()
    
    now = datetime.utcnow().isoformat()
    
    if existing:
        existing.hotel_id = body.get("hotel_id", existing.hotel_id)
        existing.api_key = body.get("api_key", existing.api_key)
        
        # Encrypt secrets if provided
        if "api_secret" in body:
            existing.api_secret = encrypt_field(body["api_secret"])
        if "password" in body:
            existing.password = encrypt_field(body["password"])
            
        existing.username = body.get("username", existing.username)
        existing.environment = body.get("environment", existing.environment)
        existing.endpoint_url = body.get("endpoint_url", existing.endpoint_url)
        existing.is_active = body.get("is_active", existing.is_active)
        existing.updated_at = now
    else:
        new_creds = ChannelCredentialsDB(
            channel_id=channel_id,
            hotel_id=body.get("hotel_id", ""),
            api_key=body.get("api_key", ""),
            api_secret=encrypt_field(body.get("api_secret")) if body.get("api_secret") else None,
            username=body.get("username"),
            password=encrypt_field(body.get("password")) if body.get("password") else None,
            environment=body.get("environment", "sandbox"),
            endpoint_url=body.get("endpoint_url"),
            is_active=body.get("is_active", True),
            created_at=now,
            updated_at=now
        )
        db.add(new_creds)
    
    db.commit()
    
    return {"success": True, "message": f"Credentials saved for {channel_id}"}


@router.delete("/credentials/{channel_id}")
async def delete_channel_credentials(channel_id: str, db: Session = Depends(get_db)):
    """Delete channel credentials"""
    existing = db.query(ChannelCredentialsDB).filter(
        ChannelCredentialsDB.channel_id == channel_id
    ).first()
    
    if not existing:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    db.delete(existing)
    db.commit()
    
    return {"success": True, "message": f"Credentials deleted for {channel_id}"}


# ============================================================================
# ROOM TYPE MAPPINGS
# ============================================================================

@router.get("/room-mappings")
async def list_room_mappings(db: Session = Depends(get_db)):
    """List all room type mappings"""
    mappings = db.query(RoomTypeMappingDB).all()
    
    return [
        {
            "internal_room_type_id": m.internal_room_type_id,
            "internal_name": m.internal_name,
            "mmt_code": m.mmt_code,
            "booking_com_code": m.booking_com_code,
            "expedia_code": m.expedia_code,
            "goibibo_code": m.goibibo_code
        }
        for m in mappings
    ]


@router.post("/room-mappings")
async def save_room_mapping(request: Request, db: Session = Depends(get_db)):
    """
    Save or update room type mapping.
    
    Body:
    {
        "internal_room_type_id": "rt-1",
        "internal_name": "Deluxe AC",
        "mmt_code": "DLXAC",
        "booking_com_code": "DELUXE_AC"
    }
    """
    body = await request.json()
    
    internal_id = body.get("internal_room_type_id")
    if not internal_id:
        raise HTTPException(status_code=400, detail="internal_room_type_id is required")
    
    existing = db.query(RoomTypeMappingDB).filter(
        RoomTypeMappingDB.internal_room_type_id == internal_id
    ).first()
    
    now = datetime.utcnow().isoformat()
    
    if existing:
        existing.internal_name = body.get("internal_name", existing.internal_name)
        existing.mmt_code = body.get("mmt_code", existing.mmt_code)
        existing.booking_com_code = body.get("booking_com_code", existing.booking_com_code)
        existing.expedia_code = body.get("expedia_code", existing.expedia_code)
        existing.goibibo_code = body.get("goibibo_code", existing.goibibo_code)
        existing.agoda_code = body.get("agoda_code", existing.agoda_code)
        existing.updated_at = now
    else:
        new_mapping = RoomTypeMappingDB(
            internal_room_type_id=internal_id,
            internal_name=body.get("internal_name", internal_id),
            mmt_code=body.get("mmt_code"),
            booking_com_code=body.get("booking_com_code"),
            expedia_code=body.get("expedia_code"),
            goibibo_code=body.get("goibibo_code"),
            agoda_code=body.get("agoda_code"),
            created_at=now,
            updated_at=now
        )
        db.add(new_mapping)
    
    db.commit()
    
    return {"success": True, "message": f"Mapping saved for {internal_id}"}


# ============================================================================
# SYNC HISTORY
# ============================================================================

@router.get("/sync-history")
async def get_sync_history(
    channel_id: Optional[str] = None,
    sync_type: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Get sync history with optional filters"""
    query = db.query(SyncHistoryDB)
    
    if channel_id:
        query = query.filter(SyncHistoryDB.channel_id == channel_id)
    if sync_type:
        query = query.filter(SyncHistoryDB.sync_type == sync_type)
    if status:
        query = query.filter(SyncHistoryDB.status == status)
    
    records = query.order_by(SyncHistoryDB.id.desc()).limit(limit).all()
    
    return [
        {
            "id": r.id,
            "channel_id": r.channel_id,
            "sync_type": r.sync_type,
            "room_type_id": r.room_type_id,
            "date_range": f"{r.date_range_start} - {r.date_range_end}" if r.date_range_start else None,
            "status": r.status,
            "message": r.message,
            "retry_count": r.retry_count,
            "created_at": r.created_at,
            "completed_at": r.completed_at
        }
        for r in records
    ]


# ============================================================================
# TEST CONNECTION
# ============================================================================

@router.post("/test-connection/{channel_id}")
async def test_channel_connection(channel_id: str, db: Session = Depends(get_db)):
    """Test connection to an OTA channel"""
    creds = db.query(ChannelCredentialsDB).filter(
        ChannelCredentialsDB.channel_id == channel_id
    ).first()
    
    if not creds:
        raise HTTPException(status_code=404, detail=f"No credentials found for {channel_id}")
    
    channel_map = {
        'mmt': MMTChannelManager,
        'makemytrip': MMTChannelManager,
        'booking': BookingComChannelManager,
        'booking.com': BookingComChannelManager,
    }
    
    channel_class = channel_map.get(channel_id.lower())
    if not channel_class:
        raise HTTPException(status_code=400, detail=f"Unknown channel: {channel_id}")
    
    manager = channel_class(ChannelCredentials(
        channel_id=creds.channel_id,
        hotel_id=creds.hotel_id,
        api_key=creds.api_key,
        api_secret=decrypt_field(creds.api_secret) if creds.api_secret else None,
        username=creds.username,
        password=decrypt_field(creds.password) if creds.password else None,
        environment=creds.environment
    ))
    
    result = await manager.test_connection()
    
    return {
        "success": result.success,
        "channel": channel_id,
        "message": result.message
    }


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def _initialize_sync_manager(db: Session) -> ChannelSyncManager:
    """Initialize sync manager with credentials from database"""
    sync_manager = get_sync_manager()
    
    # Load all active credentials
    creds_list = db.query(ChannelCredentialsDB).filter(
        ChannelCredentialsDB.is_active == True
    ).all()
    
    # Load OTA connection settings for markups
    from backend.db_models import OTAConnectionDB
    connections = db.query(OTAConnectionDB).all()
    connection_markups = {
        c.id: {"type": c.markup_type, "value": c.markup_value}
        for c in connections if c.markup_value
    }
    
    for creds in creds_list:
        markup = connection_markups.get(creds.channel_id, {})
        
        # Decrypt secrets for the sync manager
        decrypted_secret = decrypt_field(creds.api_secret) if creds.api_secret else None
        decrypted_password = decrypt_field(creds.password) if creds.password else None
        
        sync_manager.register_channel(
            channel_id=creds.channel_id,
            credentials=ChannelCredentials(
                channel_id=creds.channel_id,
                hotel_id=creds.hotel_id,
                api_key=creds.api_key,
                api_secret=decrypted_secret,
                username=creds.username,
                password=decrypted_password,
                environment=creds.environment
            ),
            markup_type=markup.get("type"),
            markup_value=markup.get("value")
        )
        
        # Check for stop sell status
        conn = next((c for c in connections if c.id == creds.channel_id), None)
        if conn and conn.is_stopped:
            sync_manager.stop_channel(creds.channel_id)
    
    # Load room mappings
    mappings = db.query(RoomTypeMappingDB).all()
    for m in mappings:
        sync_manager.set_room_mapping(RoomTypeMapping(
            internal_id=m.internal_room_type_id,
            internal_name=m.internal_name,
            mmt_code=m.mmt_code,
            booking_com_code=m.booking_com_code,
            expedia_code=m.expedia_code,
            goibibo_code=m.goibibo_code
        ))
    
    return sync_manager


def _create_notification(
    db: Session,
    notif_type: str,
    category: str,
    title: str,
    message: str,
    priority: str = "medium"
):
    """Create a notification in the database"""
    try:
        notification = NotificationDB(
            type=notif_type,
            category=category,
            title=title,
            message=message,
            priority=priority,
            is_read=False,
            is_dismissed=False,
            timestamp=int(datetime.now().timestamp() * 1000),
            created_at=datetime.utcnow().isoformat()
        )
        db.add(notification)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to create notification: {e}")
