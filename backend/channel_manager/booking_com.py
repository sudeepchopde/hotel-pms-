"""
Booking.com Channel Manager Integration

Booking.com uses JSON-based API for their Connectivity Partner program.
This is a stub implementation - real integration requires certification.
"""
import httpx
import json
from typing import Dict, Optional
from datetime import datetime
import logging

from .base import BaseChannelManager
from .models import (
    SyncResult,
    SyncStatus,
    SyncType,
    RatePushRequest,
    AvailabilityPushRequest,
    InboundBooking,
    ChannelCredentials
)

logger = logging.getLogger(__name__)


class BookingComChannelManager(BaseChannelManager):
    """
    Booking.com Channel Manager Integration
    
    Note: Booking.com requires formal partner certification.
    This implementation follows their Connectivity APIs v2 spec.
    """
    
    CHANNEL_NAME = "Booking.com"
    
    # Booking.com API endpoints
    SANDBOX_URL = "https://supply-api.sandbox.booking.com/v2"
    PRODUCTION_URL = "https://supply-api.booking.com/v2"
    
    @property
    def base_url(self) -> str:
        return self.PRODUCTION_URL if self.is_production else self.SANDBOX_URL
    
    def _build_auth_headers(self) -> Dict[str, str]:
        """
        Booking.com uses OAuth2 Bearer token authentication.
        In real implementation, you'd need to implement token refresh.
        """
        return {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "X-Booking-Hotel-ID": self.hotel_id,
        }
    
    async def push_rates(self, request: RatePushRequest) -> SyncResult:
        """Push rate update to Booking.com"""
        endpoint = f"{self.base_url}/properties/{self.hotel_id}/rates"
        
        # Booking.com JSON payload format
        payload = {
            "roomId": request.room_type_code,
            "ratePlanId": request.room_type_code,
            "dateRange": {
                "startDate": request.start_date,
                "endDate": request.end_date
            },
            "rates": [
                {
                    "occupancy": 1,
                    "amount": request.single_rate,
                    "currency": request.currency
                },
                {
                    "occupancy": 2,
                    "amount": request.double_rate,
                    "currency": request.currency
                }
            ],
            "extraCharges": {
                "extraAdult": request.extra_adult_rate,
                "extraChild": request.extra_child_rate
            }
        }
        
        logger.info(f"[Booking.com] Pushing rates for {request.room_type_code}: {request.currency} {request.double_rate}")
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    endpoint,
                    json=payload,
                    headers=self._build_auth_headers()
                )
                
                if response.status_code in [200, 201, 204]:
                    self._log_sync(SyncType.RATE, True, f"{request.room_type_code}")
                    return SyncResult(
                        success=True,
                        channel=self.CHANNEL_NAME,
                        sync_type=SyncType.RATE,
                        status=SyncStatus.SUCCESS,
                        message=f"Rates updated successfully",
                        raw_response=response.text
                    )
                else:
                    error_data = response.json() if response.text else {}
                    error_msg = error_data.get("message", f"HTTP {response.status_code}")
                    
                    self._log_sync(SyncType.RATE, False, error_msg)
                    return SyncResult(
                        success=False,
                        channel=self.CHANNEL_NAME,
                        sync_type=SyncType.RATE,
                        status=SyncStatus.FAILED,
                        message=error_msg,
                        error_code=str(response.status_code),
                        raw_response=response.text
                    )
                    
        except Exception as e:
            logger.error(f"[Booking.com] Rate push error: {e}")
            return SyncResult(
                success=False,
                channel=self.CHANNEL_NAME,
                sync_type=SyncType.RATE,
                status=SyncStatus.FAILED,
                message=str(e)
            )
    
    async def push_availability(self, request: AvailabilityPushRequest) -> SyncResult:
        """Push availability update to Booking.com"""
        endpoint = f"{self.base_url}/properties/{self.hotel_id}/availability"
        
        payload = {
            "roomId": request.room_type_code,
            "dateRange": {
                "startDate": request.start_date,
                "endDate": request.end_date
            },
            "availability": {
                "available": not request.stop_sell,
                "count": request.available_count if not request.stop_sell else 0
            },
            "restrictions": {
                "minStay": request.min_stay,
                "maxStay": request.max_stay,
                "closedToArrival": request.closed_to_arrival,
                "closedToDeparture": request.closed_to_departure
            }
        }
        
        action = "CLOSED" if request.stop_sell else f"{request.available_count} available"
        logger.info(f"[Booking.com] Pushing availability for {request.room_type_code}: {action}")
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    endpoint,
                    json=payload,
                    headers=self._build_auth_headers()
                )
                
                if response.status_code in [200, 201, 204]:
                    self._log_sync(SyncType.AVAILABILITY, True, f"{request.room_type_code}: {action}")
                    return SyncResult(
                        success=True,
                        channel=self.CHANNEL_NAME,
                        sync_type=SyncType.AVAILABILITY,
                        status=SyncStatus.SUCCESS,
                        message=f"Availability updated",
                        raw_response=response.text
                    )
                else:
                    return SyncResult(
                        success=False,
                        channel=self.CHANNEL_NAME,
                        sync_type=SyncType.AVAILABILITY,
                        status=SyncStatus.FAILED,
                        message=f"HTTP {response.status_code}",
                        raw_response=response.text
                    )
                    
        except Exception as e:
            logger.error(f"[Booking.com] Availability push error: {e}")
            return SyncResult(
                success=False,
                channel=self.CHANNEL_NAME,
                sync_type=SyncType.AVAILABILITY,
                status=SyncStatus.FAILED,
                message=str(e)
            )
    
    def parse_booking_webhook(self, raw_payload: bytes) -> InboundBooking:
        """
        Parse booking notification from Booking.com webhook.
        Booking.com sends JSON payloads.
        """
        data = json.loads(raw_payload)
        
        # Booking.com webhook structure
        reservation = data.get("reservation", data)
        
        # Determine status
        status_map = {
            "new": "confirmed",
            "modified": "modified",
            "cancelled": "cancelled"
        }
        status = status_map.get(reservation.get("status", "new"), "confirmed")
        
        # Guest info
        guest = reservation.get("guest", {})
        guest_name = f"{guest.get('firstName', '')} {guest.get('lastName', '')}".strip() or "Booking.com Guest"
        
        # Room details
        room = reservation.get("rooms", [{}])[0]
        
        return InboundBooking(
            channel=self.CHANNEL_NAME,
            reservation_id=reservation.get("reservationId", f"BCOM-{datetime.now().timestamp()}"),
            status=status,
            guest_name=guest_name,
            guest_email=guest.get("email"),
            guest_phone=guest.get("phone"),
            room_type_code=room.get("roomId", "UNKNOWN"),
            check_in=reservation.get("checkIn", ""),
            check_out=reservation.get("checkOut", ""),
            num_guests=reservation.get("numberOfGuests", 2),
            num_rooms=len(reservation.get("rooms", [1])),
            total_amount=float(reservation.get("totalPrice", {}).get("amount", 0)),
            currency=reservation.get("totalPrice", {}).get("currency", "INR"),
            special_requests=reservation.get("specialRequests"),
            raw_payload=data
        )
    
    def build_booking_response(self, success: bool, error_message: Optional[str] = None) -> str:
        """Build JSON response for Booking.com webhook"""
        response = {
            "status": "success" if success else "error",
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
        
        if not success and error_message:
            response["error"] = {
                "code": "PROCESSING_ERROR",
                "message": error_message
            }
        
        return json.dumps(response)
