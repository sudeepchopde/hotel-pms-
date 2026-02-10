# Channel Manager Module
# Provides real OTA integrations for rate/availability sync

from .base import BaseChannelManager
from .models import SyncResult, SyncStatus, SyncType, ChannelCredentials, RoomTypeMapping
from .mmt import MMTChannelManager
from .booking_com import BookingComChannelManager
from .manager import ChannelSyncManager, get_sync_manager

__all__ = [
    "BaseChannelManager",
    "SyncResult", 
    "SyncStatus",
    "SyncType",
    "ChannelCredentials",
    "RoomTypeMapping",
    "MMTChannelManager",
    "BookingComChannelManager",
    "ChannelSyncManager",
    "get_sync_manager"
]

