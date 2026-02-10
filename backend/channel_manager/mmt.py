"""
MakeMyTrip / Goibibo Channel Manager Integration

MMT uses OTA (OpenTravel Alliance) XML format for all communications.
This module handles:
- Rate pushes (OTA_HotelRatePlanRQ)
- Availability pushes (OTA_HotelAvailNotifRQ)
- Booking webhooks (OTA_HotelResNotifRQ)
"""
import httpx
import hmac
import hashlib
import base64
import xml.etree.ElementTree as ET
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

# OTA XML Namespace
OTA_NS = "http://www.opentravel.org/OTA/2003/05"


class MMTChannelManager(BaseChannelManager):
    """
    MakeMyTrip Channel Manager Integration
    
    Handles real-time rate and availability sync with MMT's ARI system.
    Also processes incoming booking notifications via webhook.
    """
    
    CHANNEL_NAME = "MakeMyTrip"
    
    # MMT Endpoints (these would be provided by MMT during certification)
    SANDBOX_URL = "https://sandbox-connect.makemytrip.com/ari/v2"
    PRODUCTION_URL = "https://connect.makemytrip.com/ari/v2"
    
    @property
    def base_url(self) -> str:
        return self.PRODUCTION_URL if self.is_production else self.SANDBOX_URL
    
    def _build_auth_headers(self) -> Dict[str, str]:
        """
        Build MMT authentication headers.
        MMT typically uses HMAC-SHA256 signature-based authentication.
        """
        timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        
        # Create signature: HMAC-SHA256(api_secret, api_key + timestamp)
        message = f"{self.api_key}{timestamp}"
        signature = hmac.new(
            (self.api_secret or "").encode('utf-8'),
            message.encode('utf-8'),
            hashlib.sha256
        ).digest()
        
        return {
            "Content-Type": "application/xml",
            "Accept": "application/xml",
            "X-MMT-API-Key": self.api_key,
            "X-MMT-Timestamp": timestamp,
            "X-MMT-Signature": base64.b64encode(signature).decode('utf-8'),
            "X-MMT-Hotel-ID": self.hotel_id,
        }
    
    def _build_rate_xml(self, request: RatePushRequest) -> str:
        """Build OTA_HotelRatePlanRQ XML payload"""
        timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        
        xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<OTA_HotelRatePlanRQ xmlns="{OTA_NS}" 
                      Version="1.0" 
                      TimeStamp="{timestamp}"
                      Target="{'Production' if self.is_production else 'Test'}">
  <RatePlans HotelCode="{self.hotel_id}">
    <RatePlan RatePlanCode="{request.room_type_code}" 
              RatePlanType="11">
      <Rates>
        <Rate Start="{request.start_date}" 
              End="{request.end_date}" 
              CurrencyCode="{request.currency}"
              RateTimeUnit="Day">
          <BaseByGuestAmts>
            <BaseByGuestAmt AmountBeforeTax="{request.double_rate:.2f}" 
                            NumberOfGuests="2"
                            AgeQualifyingCode="10"/>
            <BaseByGuestAmt AmountBeforeTax="{request.single_rate:.2f}" 
                            NumberOfGuests="1"
                            AgeQualifyingCode="10"/>
          </BaseByGuestAmts>
          <AdditionalGuestAmounts>
            <AdditionalGuestAmount Amount="{request.extra_adult_rate:.2f}" 
                                    AgeQualifyingCode="10"/>
            <AdditionalGuestAmount Amount="{request.extra_child_rate:.2f}" 
                                    AgeQualifyingCode="8"/>
          </AdditionalGuestAmounts>
        </Rate>
      </Rates>
    </RatePlan>
  </RatePlans>
</OTA_HotelRatePlanRQ>'''
        return xml
    
    def _build_availability_xml(self, request: AvailabilityPushRequest) -> str:
        """Build OTA_HotelAvailNotifRQ XML payload"""
        timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        
        # Restriction status
        restriction_status = "Close" if request.stop_sell else "Open"
        cta_status = "Close" if request.closed_to_arrival else "Open"
        ctd_status = "Close" if request.closed_to_departure else "Open"
        
        xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<OTA_HotelAvailNotifRQ xmlns="{OTA_NS}"
                        Version="1.0"
                        TimeStamp="{timestamp}"
                        Target="{'Production' if self.is_production else 'Test'}">
  <AvailStatusMessages HotelCode="{self.hotel_id}">
    <AvailStatusMessage BookingLimit="{request.available_count}">
      <StatusApplicationControl Start="{request.start_date}" 
                                  End="{request.end_date}"
                                  InvTypeCode="{request.room_type_code}"
                                  RatePlanCode="{request.room_type_code}"/>
      <LengthsOfStay>
        <LengthOfStay MinMaxMessageType="MinLOS" Time="{request.min_stay}"/>
        {f'<LengthOfStay MinMaxMessageType="MaxLOS" Time="{request.max_stay}"/>' if request.max_stay else ''}
      </LengthsOfStay>
      <RestrictionStatus Status="{restriction_status}" Restriction="Master"/>
      <RestrictionStatus Status="{cta_status}" Restriction="Arrival"/>
      <RestrictionStatus Status="{ctd_status}" Restriction="Departure"/>
    </AvailStatusMessage>
  </AvailStatusMessages>
</OTA_HotelAvailNotifRQ>'''
        return xml
    
    async def push_rates(self, request: RatePushRequest) -> SyncResult:
        """Push rate update to MakeMyTrip"""
        xml_payload = self._build_rate_xml(request)
        endpoint = f"{self.base_url}/rates"
        
        logger.info(f"[MMT] Pushing rates for {request.room_type_code}: ₹{request.double_rate}")
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    endpoint,
                    content=xml_payload,
                    headers=self._build_auth_headers()
                )
                
                # Parse response
                if response.status_code == 200:
                    root = ET.fromstring(response.text)
                    # Check for OTA Success element
                    success_elem = root.find(f".//{{{OTA_NS}}}Success")
                    errors_elem = root.find(f".//{{{OTA_NS}}}Errors")
                    
                    if success_elem is not None:
                        self._log_sync(SyncType.RATE, True, f"{request.room_type_code} @ ₹{request.double_rate}")
                        return SyncResult(
                            success=True,
                            channel=self.CHANNEL_NAME,
                            sync_type=SyncType.RATE,
                            status=SyncStatus.SUCCESS,
                            message=f"Rates updated: {request.start_date} to {request.end_date}",
                            raw_response=response.text
                        )
                    elif errors_elem is not None:
                        error = errors_elem.find(f".//{{{OTA_NS}}}Error")
                        error_msg = error.text if error is not None else "Unknown error"
                        error_code = error.get("Code") if error is not None else None
                        
                        self._log_sync(SyncType.RATE, False, error_msg)
                        return SyncResult(
                            success=False,
                            channel=self.CHANNEL_NAME,
                            sync_type=SyncType.RATE,
                            status=SyncStatus.FAILED,
                            message=error_msg,
                            error_code=error_code,
                            raw_response=response.text
                        )
                
                # Non-200 response
                self._log_sync(SyncType.RATE, False, f"HTTP {response.status_code}")
                return SyncResult(
                    success=False,
                    channel=self.CHANNEL_NAME,
                    sync_type=SyncType.RATE,
                    status=SyncStatus.FAILED,
                    message=f"HTTP Error: {response.status_code}",
                    raw_response=response.text
                )
                
        except httpx.TimeoutException:
            return SyncResult(
                success=False,
                channel=self.CHANNEL_NAME,
                sync_type=SyncType.RATE,
                status=SyncStatus.FAILED,
                message="Request timeout - MMT server did not respond in 30 seconds"
            )
        except Exception as e:
            logger.error(f"[MMT] Rate push error: {e}")
            return SyncResult(
                success=False,
                channel=self.CHANNEL_NAME,
                sync_type=SyncType.RATE,
                status=SyncStatus.FAILED,
                message=str(e)
            )
    
    async def push_availability(self, request: AvailabilityPushRequest) -> SyncResult:
        """Push availability update to MakeMyTrip"""
        xml_payload = self._build_availability_xml(request)
        endpoint = f"{self.base_url}/availability"
        
        action = "STOP SELL" if request.stop_sell else f"{request.available_count} rooms"
        logger.info(f"[MMT] Pushing availability for {request.room_type_code}: {action}")
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    endpoint,
                    content=xml_payload,
                    headers=self._build_auth_headers()
                )
                
                if response.status_code == 200:
                    root = ET.fromstring(response.text)
                    success_elem = root.find(f".//{{{OTA_NS}}}Success")
                    
                    if success_elem is not None:
                        self._log_sync(SyncType.AVAILABILITY, True, f"{request.room_type_code}: {action}")
                        return SyncResult(
                            success=True,
                            channel=self.CHANNEL_NAME,
                            sync_type=SyncType.AVAILABILITY,
                            status=SyncStatus.SUCCESS,
                            message=f"Availability updated: {request.start_date} to {request.end_date}",
                            raw_response=response.text
                        )
                
                return SyncResult(
                    success=False,
                    channel=self.CHANNEL_NAME,
                    sync_type=SyncType.AVAILABILITY,
                    status=SyncStatus.FAILED,
                    message=f"Failed with HTTP {response.status_code}",
                    raw_response=response.text
                )
                
        except Exception as e:
            logger.error(f"[MMT] Availability push error: {e}")
            return SyncResult(
                success=False,
                channel=self.CHANNEL_NAME,
                sync_type=SyncType.AVAILABILITY,
                status=SyncStatus.FAILED,
                message=str(e)
            )
    
    def parse_booking_webhook(self, raw_payload: bytes) -> InboundBooking:
        """
        Parse OTA_HotelResNotifRQ XML from MMT webhook.
        
        Args:
            raw_payload: Raw XML bytes from the webhook POST
            
        Returns:
            InboundBooking with normalized data
        """
        root = ET.fromstring(raw_payload)
        
        # Navigate OTA structure
        hotel_res = root.find(f".//{{{OTA_NS}}}HotelReservation")
        if hotel_res is None:
            raise ValueError("Invalid OTA_HotelResNotifRQ: No HotelReservation element")
        
        # Reservation ID and Status
        res_id_elem = hotel_res.find(f".//{{{OTA_NS}}}UniqueID[@Type='14']")
        res_id = res_id_elem.get("ID") if res_id_elem is not None else f"MMT-{datetime.now().timestamp()}"
        
        res_status = hotel_res.get("ResStatus", "Commit")
        status_map = {
            "Commit": "confirmed",
            "Cancel": "cancelled",
            "Modify": "modified"
        }
        status = status_map.get(res_status, "confirmed")
        
        # Guest Info
        guest_elem = root.find(f".//{{{OTA_NS}}}ResGuest")
        profile = guest_elem.find(f".//{{{OTA_NS}}}Customer") if guest_elem else None
        
        given_name = ""
        surname = ""
        email = None
        phone = None
        
        if profile is not None:
            name_elem = profile.find(f".//{{{OTA_NS}}}PersonName")
            if name_elem is not None:
                gn = name_elem.find(f".//{{{OTA_NS}}}GivenName")
                sn = name_elem.find(f".//{{{OTA_NS}}}Surname")
                given_name = gn.text if gn is not None else ""
                surname = sn.text if sn is not None else ""
            
            email_elem = profile.find(f".//{{{OTA_NS}}}Email")
            email = email_elem.text if email_elem is not None else None
            
            phone_elem = profile.find(f".//{{{OTA_NS}}}Telephone")
            phone = phone_elem.get("PhoneNumber") if phone_elem is not None else None
        
        guest_name = f"{given_name} {surname}".strip() or "MMT Guest"
        
        # Room and Dates
        room_stay = root.find(f".//{{{OTA_NS}}}RoomStay")
        time_span = room_stay.find(f".//{{{OTA_NS}}}TimeSpan") if room_stay else None
        
        check_in = time_span.get("Start") if time_span is not None else ""
        check_out = time_span.get("End") if time_span is not None else ""
        
        room_type_elem = room_stay.find(f".//{{{OTA_NS}}}RoomType") if room_stay else None
        room_type_code = room_type_elem.get("RoomTypeCode") if room_type_elem is not None else "UNKNOWN"
        
        # Guest Count
        guest_counts = room_stay.find(f".//{{{OTA_NS}}}GuestCounts") if room_stay else None
        num_guests = 2  # Default
        if guest_counts is not None:
            adult_count = guest_counts.find(f".//{{{OTA_NS}}}GuestCount[@AgeQualifyingCode='10']")
            if adult_count is not None:
                num_guests = int(adult_count.get("Count", 2))
        
        # Amount
        total_elem = room_stay.find(f".//{{{OTA_NS}}}Total") if room_stay else None
        total_amount = float(total_elem.get("AmountAfterTax", 0)) if total_elem is not None else 0
        currency = total_elem.get("CurrencyCode", "INR") if total_elem is not None else "INR"
        
        # Special Requests
        special_req_elem = root.find(f".//{{{OTA_NS}}}SpecialRequest")
        special_requests = special_req_elem.text if special_req_elem is not None else None
        
        return InboundBooking(
            channel=self.CHANNEL_NAME,
            reservation_id=res_id,
            status=status,
            guest_name=guest_name,
            guest_email=email,
            guest_phone=phone,
            room_type_code=room_type_code,
            check_in=check_in,
            check_out=check_out,
            num_guests=num_guests,
            num_rooms=1,
            total_amount=total_amount,
            currency=currency,
            special_requests=special_requests,
            raw_payload={"xml": raw_payload.decode('utf-8')}
        )
    
    def build_booking_response(self, success: bool, error_message: Optional[str] = None) -> str:
        """Build OTA_HotelResNotifRS XML response"""
        timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        
        if success:
            return f'''<?xml version="1.0" encoding="UTF-8"?>
<OTA_HotelResNotifRS xmlns="{OTA_NS}" 
                      Version="1.0" 
                      TimeStamp="{timestamp}">
  <Success/>
</OTA_HotelResNotifRS>'''
        else:
            return f'''<?xml version="1.0" encoding="UTF-8"?>
<OTA_HotelResNotifRS xmlns="{OTA_NS}" 
                      Version="1.0" 
                      TimeStamp="{timestamp}">
  <Errors>
    <Error Type="3" Code="450">{error_message or "Processing error"}</Error>
  </Errors>
</OTA_HotelResNotifRS>'''
    
    async def test_connection(self) -> SyncResult:
        """Test connection to MMT API"""
        # MMT might have a ping/health endpoint
        endpoint = f"{self.base_url}/ping"
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    endpoint,
                    headers=self._build_auth_headers()
                )
                
                return SyncResult(
                    success=response.status_code in [200, 204],
                    channel=self.CHANNEL_NAME,
                    sync_type=SyncType.AVAILABILITY,
                    status=SyncStatus.SUCCESS if response.status_code in [200, 204] else SyncStatus.FAILED,
                    message=f"Connection {'successful' if response.status_code in [200, 204] else 'failed'}"
                )
        except Exception as e:
            return SyncResult(
                success=False,
                channel=self.CHANNEL_NAME,
                sync_type=SyncType.AVAILABILITY,
                status=SyncStatus.FAILED,
                message=f"Connection test failed: {e}"
            )
