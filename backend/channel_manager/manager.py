"""
Channel Sync Manager

Central orchestrator for syncing rates/availability across multiple OTAs.
Handles:
- Multi-channel fan-out (sync to all connected channels)
- Retry logic with exponential backoff
- Sync job queue management
- Channel-specific markup application
"""
import asyncio
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
import uuid

from .base import BaseChannelManager
from .models import (
    SyncResult,
    SyncStatus,
    SyncType,
    SyncJob,
    RatePushRequest,
    AvailabilityPushRequest,
    ChannelCredentials,
    RoomTypeMapping
)
from .mmt import MMTChannelManager
from .booking_com import BookingComChannelManager

logger = logging.getLogger(__name__)


class ChannelSyncManager:
    """
    Orchestrates sync operations across all connected OTA channels.
    
    This replaces the simulated `simulateFanOut` function with real API calls.
    """
    
    # Retry configuration
    MAX_RETRIES = 5
    RETRY_DELAYS = [5, 15, 60, 300, 900]  # Exponential backoff in seconds
    
    def __init__(self):
        self.channels: Dict[str, BaseChannelManager] = {}
        self.room_mappings: Dict[str, RoomTypeMapping] = {}
        self.channel_markups: Dict[str, Dict[str, Any]] = {}  # channel_id -> {type, value}
        self.stopped_channels: set = set()  # Channels on Stop Sell
        self.job_queue: List[SyncJob] = []
        self._is_processing = False
    
    def register_channel(
        self, 
        channel_id: str, 
        credentials: ChannelCredentials,
        markup_type: Optional[str] = None,
        markup_value: Optional[float] = None
    ):
        """
        Register an OTA channel with its credentials.
        
        Args:
            channel_id: Unique identifier (e.g., 'mmt', 'booking')
            credentials: API credentials for the channel
            markup_type: 'percentage' or 'fixed'
            markup_value: Markup amount
        """
        channel_map = {
            'mmt': MMTChannelManager,
            'makemytrip': MMTChannelManager,
            'booking': BookingComChannelManager,
            'booking.com': BookingComChannelManager,
        }
        
        channel_class = channel_map.get(channel_id.lower())
        if channel_class:
            self.channels[channel_id] = channel_class(credentials)
            logger.info(f"Registered channel: {channel_id}")
            
            if markup_type and markup_value:
                self.channel_markups[channel_id] = {
                    'type': markup_type,
                    'value': markup_value
                }
        else:
            logger.warning(f"Unknown channel type: {channel_id}")
    
    def set_room_mapping(self, mapping: RoomTypeMapping):
        """Set room type mapping between internal IDs and OTA codes"""
        self.room_mappings[mapping.internal_id] = mapping
    
    def stop_channel(self, channel_id: str):
        """Mark a channel as stopped (Stop Sell)"""
        self.stopped_channels.add(channel_id)
        logger.info(f"Channel {channel_id} marked as STOPPED")
    
    def resume_channel(self, channel_id: str):
        """Resume a stopped channel"""
        self.stopped_channels.discard(channel_id)
        logger.info(f"Channel {channel_id} RESUMED")
    
    def _apply_markup(self, channel_id: str, base_price: float) -> float:
        """Apply channel-specific markup to base price"""
        if channel_id not in self.channel_markups:
            return base_price
        
        markup = self.channel_markups[channel_id]
        if markup['type'] == 'percentage':
            return round(base_price * (1 + markup['value'] / 100), 2)
        else:  # fixed
            return base_price + markup['value']
    
    def _get_ota_room_code(self, internal_id: str, channel_id: str) -> Optional[str]:
        """Get the OTA-specific room code for an internal room type ID"""
        mapping = self.room_mappings.get(internal_id)
        if not mapping:
            return internal_id  # Fallback to internal ID
        
        code_map = {
            'mmt': mapping.mmt_code,
            'makemytrip': mapping.mmt_code,
            'booking': mapping.booking_com_code,
            'booking.com': mapping.booking_com_code,
            'expedia': mapping.expedia_code,
            'goibibo': mapping.goibibo_code,
        }
        
        return code_map.get(channel_id.lower()) or internal_id
    
    async def sync_rates(
        self,
        room_type_id: str,
        start_date: str,
        end_date: str,
        single_rate: float,
        double_rate: float,
        extra_adult_rate: float = 0,
        extra_child_rate: float = 0,
        target_channels: Optional[List[str]] = None
    ) -> Dict[str, SyncResult]:
        """
        Sync rates to all connected channels (or specific ones).
        
        Args:
            room_type_id: Internal room type ID
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            single_rate: Base price for single occupancy
            double_rate: Base price for double occupancy
            extra_bed_rate: Extra bed charge
            target_channels: Optional list of specific channels to sync
            
        Returns:
            Dict mapping channel_id to SyncResult
        """
        results: Dict[str, SyncResult] = {}
        channels_to_sync = target_channels or list(self.channels.keys())
        
        tasks = []
        for channel_id in channels_to_sync:
            if channel_id not in self.channels:
                continue
            
            # Check if channel is stopped
            if channel_id in self.stopped_channels:
                results[channel_id] = SyncResult(
                    success=False,
                    channel=channel_id,
                    sync_type=SyncType.RATE,
                    status=SyncStatus.STOPPED,
                    message="Channel is on Stop Sell"
                )
                continue
            
            # Apply channel-specific markup
            marked_double = self._apply_markup(channel_id, double_rate)
            marked_single = self._apply_markup(channel_id, single_rate)
            
            # Get OTA-specific room code
            ota_room_code = self._get_ota_room_code(room_type_id, channel_id)
            
            request = RatePushRequest(
                room_type_id=room_type_id,
                room_type_code=ota_room_code,
                start_date=start_date,
                end_date=end_date,
                single_rate=marked_single,
                double_rate=marked_double,
                extra_adult_rate=extra_adult_rate,
                extra_child_rate=extra_child_rate
            )
            
            tasks.append(self._sync_with_retry(channel_id, 'rate', request))
        
        # Execute all syncs in parallel
        if tasks:
            task_results = await asyncio.gather(*tasks, return_exceptions=True)
            for channel_id, result in zip(
                [c for c in channels_to_sync if c in self.channels and c not in self.stopped_channels],
                task_results
            ):
                if isinstance(result, Exception):
                    results[channel_id] = SyncResult(
                        success=False,
                        channel=channel_id,
                        sync_type=SyncType.RATE,
                        status=SyncStatus.FAILED,
                        message=str(result)
                    )
                else:
                    results[channel_id] = result
        
        return results
    
    async def sync_availability(
        self,
        room_type_id: str,
        start_date: str,
        end_date: str,
        available_count: int,
        stop_sell: bool = False,
        min_stay: int = 1,
        target_channels: Optional[List[str]] = None
    ) -> Dict[str, SyncResult]:
        """
        Sync availability to all connected channels.
        """
        results: Dict[str, SyncResult] = {}
        channels_to_sync = target_channels or list(self.channels.keys())
        
        tasks = []
        for channel_id in channels_to_sync:
            if channel_id not in self.channels:
                continue
            
            if channel_id in self.stopped_channels:
                results[channel_id] = SyncResult(
                    success=False,
                    channel=channel_id,
                    sync_type=SyncType.AVAILABILITY,
                    status=SyncStatus.STOPPED,
                    message="Channel is on Stop Sell"
                )
                continue
            
            ota_room_code = self._get_ota_room_code(room_type_id, channel_id)
            
            request = AvailabilityPushRequest(
                room_type_id=room_type_id,
                room_type_code=ota_room_code,
                start_date=start_date,
                end_date=end_date,
                available_count=available_count,
                stop_sell=stop_sell,
                min_stay=min_stay
            )
            
            tasks.append(self._sync_with_retry(channel_id, 'availability', request))
        
        if tasks:
            task_results = await asyncio.gather(*tasks, return_exceptions=True)
            for channel_id, result in zip(
                [c for c in channels_to_sync if c in self.channels and c not in self.stopped_channels],
                task_results
            ):
                if isinstance(result, Exception):
                    results[channel_id] = SyncResult(
                        success=False,
                        channel=channel_id,
                        sync_type=SyncType.AVAILABILITY,
                        status=SyncStatus.FAILED,
                        message=str(result)
                    )
                else:
                    results[channel_id] = result
        
        return results
    
    async def _sync_with_retry(
        self,
        channel_id: str,
        sync_type: str,
        request: Any
    ) -> SyncResult:
        """Execute sync with automatic retry on failure"""
        channel = self.channels[channel_id]
        last_result = None
        
        for attempt in range(self.MAX_RETRIES):
            try:
                if sync_type == 'rate':
                    result = await channel.push_rates(request)
                else:
                    result = await channel.push_availability(request)
                
                result.retry_count = attempt
                
                if result.success:
                    return result
                
                last_result = result
                
                # Wait before retry (exponential backoff)
                if attempt < self.MAX_RETRIES - 1:
                    delay = self.RETRY_DELAYS[min(attempt, len(self.RETRY_DELAYS) - 1)]
                    logger.warning(f"[{channel_id}] Retry {attempt + 1}/{self.MAX_RETRIES} in {delay}s")
                    await asyncio.sleep(delay)
                    
            except Exception as e:
                logger.error(f"[{channel_id}] Sync error on attempt {attempt + 1}: {e}")
                last_result = SyncResult(
                    success=False,
                    channel=channel_id,
                    sync_type=SyncType.RATE if sync_type == 'rate' else SyncType.AVAILABILITY,
                    status=SyncStatus.FAILED,
                    message=str(e),
                    retry_count=attempt
                )
                
                if attempt < self.MAX_RETRIES - 1:
                    delay = self.RETRY_DELAYS[min(attempt, len(self.RETRY_DELAYS) - 1)]
                    await asyncio.sleep(delay)
        
        # All retries exhausted
        if last_result:
            last_result.status = SyncStatus.FAILED
            last_result.message = f"Failed after {self.MAX_RETRIES} attempts: {last_result.message}"
        
        return last_result
    
    def queue_sync_job(
        self,
        channel_id: str,
        sync_type: SyncType,
        payload: Dict[str, Any]
    ) -> str:
        """
        Queue a sync job for background processing.
        Returns job ID.
        """
        job = SyncJob(
            id=str(uuid.uuid4()),
            channel=channel_id,
            sync_type=sync_type,
            payload=payload
        )
        self.job_queue.append(job)
        logger.info(f"Queued sync job {job.id} for {channel_id}")
        return job.id
    
    async def process_queue(self):
        """Process queued sync jobs (run in background)"""
        if self._is_processing:
            return
        
        self._is_processing = True
        
        try:
            while self.job_queue:
                job = self.job_queue.pop(0)
                job.status = SyncStatus.IN_PROGRESS
                job.started_at = datetime.utcnow()
                
                try:
                    if job.sync_type == SyncType.RATE:
                        await self.sync_rates(**job.payload)
                    elif job.sync_type == SyncType.AVAILABILITY:
                        await self.sync_availability(**job.payload)
                    
                    job.status = SyncStatus.SUCCESS
                    job.completed_at = datetime.utcnow()
                    
                except Exception as e:
                    job.status = SyncStatus.FAILED
                    job.error_message = str(e)
                    logger.error(f"Job {job.id} failed: {e}")
                    
        finally:
            self._is_processing = False
    
    async def close_all(self):
        """Close all channel connections"""
        for channel in self.channels.values():
            await channel.close()


# Global singleton instance
_sync_manager: Optional[ChannelSyncManager] = None


def get_sync_manager() -> ChannelSyncManager:
    """Get or create the global sync manager instance"""
    global _sync_manager
    if _sync_manager is None:
        _sync_manager = ChannelSyncManager()
    return _sync_manager
