"""
Base class for all Channel Manager integrations.
Each OTA (MMT, Booking.com, etc.) extends this class.
"""
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
import logging
from datetime import datetime

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


class BaseChannelManager(ABC):
    """
    Abstract base class for OTA channel integrations.
    
    Each OTA (MakeMyTrip, Booking.com, Expedia) will have its own
    implementation that handles their specific API format (XML/JSON),
    authentication, and endpoints.
    """
    
    CHANNEL_NAME: str = "base"
    
    def __init__(self, credentials: ChannelCredentials):
        self.credentials = credentials
        self.hotel_id = credentials.hotel_id
        self.api_key = credentials.api_key
        self.api_secret = credentials.api_secret
        self.environment = credentials.environment
        self._session = None
        
    @property
    def is_production(self) -> bool:
        return self.environment == "production"
    
    @property
    @abstractmethod
    def base_url(self) -> str:
        """Return the base API URL for this channel"""
        pass
    
    @abstractmethod
    def _build_auth_headers(self) -> Dict[str, str]:
        """Build authentication headers for API requests"""
        pass
    
    @abstractmethod
    async def push_rates(self, request: RatePushRequest) -> SyncResult:
        """
        Push rate updates to the OTA.
        
        Args:
            request: RatePushRequest with room type, dates, and prices
            
        Returns:
            SyncResult indicating success/failure
        """
        pass
    
    @abstractmethod
    async def push_availability(self, request: AvailabilityPushRequest) -> SyncResult:
        """
        Push availability/inventory updates to the OTA.
        
        Args:
            request: AvailabilityPushRequest with room type, dates, and counts
            
        Returns:
            SyncResult indicating success/failure
        """
        pass
    
    @abstractmethod
    def parse_booking_webhook(self, raw_payload: bytes) -> InboundBooking:
        """
        Parse an incoming booking notification from the OTA.
        
        Args:
            raw_payload: Raw XML/JSON bytes from the webhook
            
        Returns:
            InboundBooking object with normalized booking data
        """
        pass
    
    @abstractmethod
    def build_booking_response(self, success: bool, error_message: Optional[str] = None) -> str:
        """
        Build the response to send back to the OTA after receiving a booking.
        
        Args:
            success: Whether the booking was processed successfully
            error_message: Error message if processing failed
            
        Returns:
            XML/JSON string to send as response
        """
        pass
    
    def _log_sync(self, sync_type: SyncType, success: bool, details: str = ""):
        """Log sync operations for debugging"""
        status = "SUCCESS" if success else "FAILED"
        logger.info(f"[{self.CHANNEL_NAME}] {sync_type.value} {status}: {details}")
    
    async def test_connection(self) -> SyncResult:
        """
        Test the connection to the OTA API.
        Override in subclass if the OTA provides a specific test endpoint.
        """
        return SyncResult(
            success=True,
            channel=self.CHANNEL_NAME,
            sync_type=SyncType.AVAILABILITY,
            status=SyncStatus.SUCCESS,
            message="Connection test not implemented for this channel"
        )
    
    async def close(self):
        """Clean up any resources (HTTP sessions, etc.)"""
        if self._session:
            await self._session.aclose()
            self._session = None
