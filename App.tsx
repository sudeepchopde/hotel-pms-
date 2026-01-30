
import React, { useState, useEffect } from 'react';

import InventoryDashboard from './components/InventoryDashboard';
import SettingsPage from './components/SettingsPage';
import IntelligenceView from './components/IntelligenceView';
import PitchView from './components/PitchView';
import RateRulesPage from './components/RateRulesPage';
import AnalysisView from './components/AnalysisView';
import ReportsView from './components/ReportsView';
import PropertySetupPage from './components/PropertySetupPage';
import FrontDeskView from './components/FrontDeskView';
import GuestsView from './components/GuestsView';
import ComplianceView from './components/ComplianceView';
import GuestMenu from './components/GuestMenu';
import SecurityView from './components/SecurityView';
import NotificationsPanel from './components/NotificationsPanel';
import {
  LayoutDashboard, FileText, Database, Settings, ShieldCheck,
  BrainCircuit, Building2, ChevronDown, Presentation, TrendingUp,
  BarChart2, FileSpreadsheet, Home, ConciergeBell, Users, FileBadge,
  PanelLeftClose, PanelLeftOpen, ShieldAlert, AlertCircle, GripVertical, Bell
} from 'lucide-react';
import { Hotel, OTAConnection, RateRulesConfig, RoomType, SyncEvent, Booking, FolioItem, VerificationAttempt, RoomSecurityStatus, PropertySettings } from './types';

const HOTELS: Hotel[] = [
  { id: 'h-1', name: 'Hotel Satsangi', location: 'Deoghar', color: 'indigo', otaConfig: { expedia: 'active', booking: 'active', mmt: 'active' } },
];

const INITIAL_CONNECTIONS: OTAConnection[] = [
  { id: 'mmt', name: 'MakeMyTrip', key: 'mkmt_live_••••••••7d2f', isVisible: false, status: 'connected', lastValidated: '2 hours ago' },
  { id: 'booking', name: 'Booking.com', key: 'bcom_auth_••••••••a11b', isVisible: false, status: 'connected', lastValidated: '5 mins ago' },
  { id: 'expedia', name: 'Expedia', key: '', isVisible: false, status: 'disconnected' },
];

const INITIAL_RULES: RateRulesConfig = {
  weeklyRules: {
    isActive: true,
    activeDays: [5, 6], // Friday & Saturday
    modifierType: 'percentage',
    modifierValue: 1.20, // 20% increase
  },
  specialEvents: [
    { id: 'ev-1', name: 'Diwali Festival', startDate: '2025-10-30', endDate: '2025-11-05', modifierType: 'percentage', modifierValue: 1.5 },
    { id: 'ev-2', name: 'New Year Eve', startDate: '2025-12-30', endDate: '2026-01-01', modifierType: 'fixed', modifierValue: 5000 }
  ]
};

// Default navigation items configuration
const DEFAULT_NAV_ITEMS = [
  { id: 'frontdesk', icon: ConciergeBell, label: 'Front Desk', color: 'text-rose-300' },
  { id: 'compliance', icon: FileBadge, label: 'Police Compliance', color: 'text-amber-400' },
  { id: 'guests', icon: Users, label: 'Guests', color: 'text-sky-300' },
  { id: 'security', icon: ShieldAlert, label: 'Security Center', color: 'text-red-400' },
  { id: 'setup', icon: Home, label: 'Property Setup', color: 'text-emerald-300' },
  { id: 'dashboard', icon: LayoutDashboard, label: 'Live Inventory', color: 'text-slate-400' },
  { id: 'analysis', icon: BarChart2, label: 'Analysis', color: 'text-blue-300' },
  { id: 'reports', icon: FileSpreadsheet, label: 'Reports', color: 'text-teal-300' },
  { id: 'rules', icon: TrendingUp, label: 'Revenue Rules', color: 'text-emerald-300' },
  { id: 'intelligence', icon: BrainCircuit, label: 'AI Intelligence', color: 'text-fuchsia-300' },
  { id: 'settings', icon: Settings, label: 'Channel Settings', color: 'text-slate-400' },
  { id: 'flow', icon: Presentation, label: 'Flow', color: 'text-slate-500' },
];

const INITIAL_ROOM_TYPES: RoomType[] = [
  {
    id: 'rt-1',
    name: 'Delux Room (AC)',
    totalCapacity: 10,
    basePrice: 4500,
    floorPrice: 3000,
    ceilingPrice: 8000,
    baseOccupancy: 2,
    amenities: ['WiFi', 'AC', 'TV'],
    roomNumbers: ['101', '102', '103', '104', '105', '106', '107', '108', '109', '110'],
    extraBedCharge: 1200
  },
  {
    id: 'rt-2',
    name: 'Double Bed Room',
    totalCapacity: 10,
    basePrice: 2800,
    floorPrice: 1800,
    ceilingPrice: 5000,
    baseOccupancy: 2,
    amenities: ['WiFi', 'Fan'],
    roomNumbers: ['201', '202', '203', '204', '205', '206', '207', '208', '209', '210'],
    extraBedCharge: 800
  },
  {
    id: 'rt-3',
    name: 'Single Bed Room',
    totalCapacity: 5,
    basePrice: 1800,
    floorPrice: 1200,
    ceilingPrice: 3000,
    baseOccupancy: 1,
    amenities: ['WiFi'],
    roomNumbers: ['301', '302', '303', '304', '305'],
    extraBedCharge: 500
  },
  {
    id: 'rt-4',
    name: 'Dormitory',
    totalCapacity: 3,
    basePrice: 1200,
    floorPrice: 800,
    ceilingPrice: 2500,
    baseOccupancy: 1,
    amenities: ['WiFi', 'Locker'],
    roomNumbers: ['D-1', 'D-2', 'D-3'],
    extraBedCharge: 300
  },
];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings' | 'intelligence' | 'flow' | 'rules' | 'analysis' | 'reports' | 'setup' | 'frontdesk' | 'guests' | 'compliance' | 'security'>('frontdesk');
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [isHotelMenuOpen, setIsHotelMenuOpen] = useState(false);
  const [connections, setConnections] = useState<OTAConnection[]>([]);
  const [rules, setRules] = useState<RateRulesConfig | null>(null);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [syncEvents, setSyncEvents] = useState<SyncEvent[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [propertySettings, setPropertySettings] = useState<PropertySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNotificationsPanelOpen, setIsNotificationsPanelOpen] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // Navigation items order state
  const [navItems, setNavItems] = useState(DEFAULT_NAV_ITEMS);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);

  // Load saved navigation order from localStorage
  useEffect(() => {
    const savedOrder = localStorage.getItem('pms_nav_order');
    if (savedOrder) {
      try {
        const orderIds = JSON.parse(savedOrder) as string[];
        // Reconstruct nav items in saved order, adding any new items at the end
        const orderedItems = orderIds
          .map(id => DEFAULT_NAV_ITEMS.find(item => item.id === id))
          .filter(Boolean) as typeof DEFAULT_NAV_ITEMS;
        // Add any new items that weren't in saved order
        DEFAULT_NAV_ITEMS.forEach(item => {
          if (!orderedItems.find(i => i.id === item.id)) {
            orderedItems.push(item);
          }
        });
        setNavItems(orderedItems);
      } catch (e) {
        console.error('Failed to load nav order:', e);
      }
    }
  }, []);

  // Drag handlers for navigation reordering
  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    // Find the entire row container to use as the drag image
    const dragImage = (e.currentTarget as HTMLElement).closest('.nav-item-row');
    if (dragImage && e.dataTransfer.setDragImage) {
      // Set the whole row as the ghost image so the user sees what they are moving
      // We offset it slightly so the mouse remains near the handle
      const rect = dragImage.getBoundingClientRect();
      const handleRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const offsetX = handleRect.left - rect.left + handleRect.width / 2;
      const offsetY = handleRect.top - rect.top + handleRect.height / 2;
      e.dataTransfer.setDragImage(dragImage, offsetX, offsetY);
    }

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', itemId);

    // Use timeout to delay the state update that fades the placeholder
    // This ensures the browser captures the solid row before we fade it
    setTimeout(() => {
      setDraggedItem(itemId);
      document.body.classList.add('is-dragging');
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = '1';
    setDraggedItem(null);
    setDragOverItem(null);
    document.body.classList.remove('is-dragging');
  };

  const handleDragOver = (e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (itemId !== draggedItem) {
      setDragOverItem(itemId);
    }
  };

  const handleDragLeave = () => {
    setDragOverItem(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetId) return;

    const newItems = [...navItems];
    const draggedIndex = newItems.findIndex(item => item.id === draggedItem);
    const targetIndex = newItems.findIndex(item => item.id === targetId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      // Remove dragged item and insert at target position
      const [removed] = newItems.splice(draggedIndex, 1);
      newItems.splice(targetIndex, 0, removed);
      setNavItems(newItems);
      // Save to localStorage
      localStorage.setItem('pms_nav_order', JSON.stringify(newItems.map(i => i.id)));
    }

    setDraggedItem(null);
    setDragOverItem(null);
  };

  // Fetch Data on Load
  useEffect(() => {
    const loadData = async () => {
      try {
        const [hotelsData, connectionsData, rulesData, roomTypesData, bookingsData, propertyData] = await Promise.all([
          import('./api').then(m => m.fetchHotels()),
          import('./api').then(m => m.fetchConnections()),
          import('./api').then(m => m.fetchRules()),
          import('./api').then(m => m.fetchRoomTypes()),
          import('./api').then(m => m.fetchBookings()),
          import('./api').then(m => m.fetchPropertySettings())
        ]);

        setHotels(hotelsData);
        if (hotelsData.length > 0) setSelectedHotel(hotelsData[0]);
        setConnections(connectionsData);
        setRules(rulesData);
        setRoomTypes(roomTypesData);
        // Convert bookings to SyncEvents (assuming 'booking' type differentiation happens later or cast)
        const bookingEvents = bookingsData.map(b => ({ ...b, type: 'booking' } as SyncEvent));
        setSyncEvents(bookingEvents);
        setPropertySettings(propertyData);
      } catch (error) {
        console.error("Failed to load initial data", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Poll for notification count
  useEffect(() => {
    const loadNotificationCount = async () => {
      try {
        const { fetchUnreadNotificationCount } = await import('./api');
        const count = await fetchUnreadNotificationCount();
        setUnreadNotificationCount(count);
      } catch (e) {
        console.error('Failed to fetch notification count:', e);
      }
    };

    loadNotificationCount();
    const interval = setInterval(loadNotificationCount, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, []);

  // Security State
  const [verificationAttempts, setVerificationAttempts] = useState<VerificationAttempt[]>([]);
  const [roomSecurity, setRoomSecurity] = useState<RoomSecurityStatus[]>([]);
  const [securityToast, setSecurityToast] = useState<string | null>(null);

  // Guest Mode State
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [guestRoomNumber, setGuestRoomNumber] = useState<string>('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');

    // Only enter guest mode if ?room= parameter is present in URL
    // This ensures visiting the main URL shows the admin dashboard
    if (room) {
      localStorage.setItem('guest_room_identity', room);
      setIsGuestMode(true);
      setGuestRoomNumber(room);
    } else {
      // Clear guest mode if no room param - show admin dashboard
      setIsGuestMode(false);
      setGuestRoomNumber('');
    }
  }, []);

  // Note: Removed automatic dummy booking creation - guest mode now requires actual checked-in booking

  // Secure Verification Logic (Simulating POST /verify-guest with Throttling)
  const handleValidateGuest = async (roomNumber: string, lastNameInput: string): Promise<string | null> => {
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Check if room is locked in global state
    const securityStatus = roomSecurity.find(rs => rs.room_id === roomNumber);
    if (securityStatus?.isLocked || securityStatus?.isQRDisabled) {
      logAttempt(roomNumber, lastNameInput, 'LOCKED');
      return "LOCKED";
    }

    const booking = syncEvents.find(e =>
      e.type === 'booking' &&
      e.roomNumber === roomNumber &&
      e.status === 'CheckedIn'
    ) as Booking | undefined;

    const sanitizedInput = lastNameInput.toLowerCase().trim();
    const extractLastName = (fullName: string) => {
      const parts = fullName.trim().split(/\s+/);
      return parts.length > 0 ? parts[parts.length - 1].toLowerCase() : "";
    };

    let verified = false;
    if (booking) {
      if (extractLastName(booking.guestName) === sanitizedInput) {
        verified = true;
      } else {
        const matchedAccessory = booking.accessoryGuests?.find(guest => guest.name && extractLastName(guest.name) === sanitizedInput);
        if (matchedAccessory) verified = true;
      }
    }

    if (verified) {
      logAttempt(roomNumber, lastNameInput, 'SUCCESS');
      // Reset fail count on success
      setRoomSecurity(prev => prev.map(rs => rs.room_id === roomNumber ? { ...rs, failCount: 0 } : rs));
      return `sess_${Math.random().toString(36).substring(7)}`;
    } else {
      logAttempt(roomNumber, lastNameInput, 'FAIL');
      handleSecurityThrottling(roomNumber);
      return null;
    }
  };

  const logAttempt = (room: string, surname: string, status: 'SUCCESS' | 'FAIL' | 'LOCKED') => {
    const newAttempt: VerificationAttempt = {
      id: `at_${Math.random().toString(36).substring(7)}`,
      room_id: room,
      input_surname: surname,
      status,
      ip_address: '192.168.1.' + Math.floor(Math.random() * 255),
      created_at: new Date().toISOString()
    };
    setVerificationAttempts(prev => [newAttempt, ...prev].slice(0, 100));
  };

  const handleSecurityThrottling = (room: string) => {
    setRoomSecurity(prev => {
      const existing = prev.find(rs => rs.room_id === room);
      const newCount = (existing?.failCount || 0) + 1;

      if (newCount >= 3) {
        setSecurityToast(`Security Alert: High failure rate on Room ${room}. Potential fraud detected.`);
        setTimeout(() => setSecurityToast(null), 5000);

        if (existing) {
          return prev.map(rs => rs.room_id === room ? { ...rs, failCount: newCount, isLocked: true } : rs);
        } else {
          return [...prev, { room_id: room, isLocked: true, isQRDisabled: false, failCount: newCount }];
        }
      }

      if (existing) {
        return prev.map(rs => rs.room_id === room ? { ...rs, failCount: newCount } : rs);
      } else {
        return [...prev, { room_id: room, isLocked: false, isQRDisabled: false, failCount: newCount }];
      }
    });
  };

  const handleSecurityAlert = (room: string) => {
    // Background request from GuestMenu to mark room as Amber in PMS
    setRoomSecurity(prev => {
      const existing = prev.find(rs => rs.room_id === room);
      if (existing) {
        return prev.map(rs => rs.room_id === room ? { ...rs, failCount: 3, isLocked: true } : rs);
      }
      return [...prev, { room_id: room, isLocked: true, isQRDisabled: false, failCount: 3 }];
    });
    setSecurityToast(`Warning: Room ${room} identity verification failed 3 times. Locked.`);
    setTimeout(() => setSecurityToast(null), 5000);
  };

  const resetRoomSecurity = (room: string) => {
    setRoomSecurity(prev => prev.map(rs => rs.room_id === room ? { ...rs, isLocked: false, failCount: 0 } : rs));
    // Clear local browser lockout for guest convenience if staff resets
    localStorage.removeItem(`lockout_room_${room}`);
  };

  const toggleQROrdering = (room: string) => {
    setRoomSecurity(prev => {
      const existing = prev.find(rs => rs.room_id === room);
      if (existing) {
        return prev.map(rs => rs.room_id === room ? { ...rs, isQRDisabled: !rs.isQRDisabled } : rs);
      }
      return [...prev, { room_id: room, isLocked: false, isQRDisabled: true, failCount: 0 }];
    });
  };

  const handlePlaceOrder = async (roomNumber: string, items: { name: string, price: number }[]) => {
    const booking = (syncEvents.find(e => e.type === 'booking' && e.roomNumber === roomNumber && e.status === 'CheckedIn') as Booking);
    if (!booking) return;

    const totalAmount = items.reduce((sum, i) => sum + i.price, 0);
    const description = `In-Room Dining - Order #${Math.floor(Math.random() * 1000)}`;

    const newFolioItem: FolioItem = {
      id: `fi-${Date.now()}`,
      description,
      amount: totalAmount,
      category: 'F&B',
      timestamp: new Date().toISOString()
    };

    const updatedBooking: Booking = {
      ...booking,
      folio: [...(booking.folio || []), newFolioItem],
      timestamp: Date.now()
    };

    // Update local state reactively
    setSyncEvents(prev => prev.map(e => (e.id === booking.id && e.type === 'booking') ? { ...updatedBooking, type: 'booking' } as SyncEvent : e));

    // Persist to backend immediately
    try {
      const { updateBooking } = await import('./api');
      await updateBooking(updatedBooking);
    } catch (err) {
      console.error("Failed to persist in-room dining order:", err);
    }
  };

  const handleUpdateExtraBeds = async (bookingId: string, count: number) => {
    const booking = syncEvents.find(e => e.type === 'booking' && e.id === bookingId) as Booking | undefined;
    if (!booking) return;

    const roomType = roomTypes.find(rt => rt.id === booking.roomTypeId);
    const extraBedCharge = roomType?.extraBedCharge || 0;
    const totalExtraCharge = count * extraBedCharge;

    let newFolio = [...(booking.folio || [])];
    const existingIdx = newFolio.findIndex(fi => fi.category === 'Other' && fi.description.includes('Extra Bed'));

    if (count > 0) {
      const newItem: FolioItem = {
        id: existingIdx >= 0 ? newFolio[existingIdx].id : `fi-eb-${Date.now()}`,
        description: `Extra Bed Setup x${count}`,
        amount: totalExtraCharge,
        category: 'Other',
        timestamp: new Date().toISOString()
      };

      if (existingIdx >= 0) {
        newFolio[existingIdx] = newItem;
      } else {
        newFolio.push(newItem);
      }
    } else {
      if (existingIdx >= 0) {
        newFolio.splice(existingIdx, 1);
      }
    }

    const updated = {
      ...booking,
      extraBeds: count,
      folio: newFolio,
      timestamp: Date.now()
    };

    setSyncEvents(prev => prev.map(e => e.id === bookingId && e.type === 'booking' ? { ...updated, type: 'booking' } as SyncEvent : e));

    try {
      const { updateBooking } = await import('./api');
      await updateBooking(updated);
    } catch (err) {
      console.error("Failed to persist extra bed update", err);
    }
  };

  // Check for Guest Mode - verify there's an actual checked-in booking for this room
  if (isGuestMode) {
    // Check if booking data is still loading
    if (isLoading) {
      return (
        <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', width: '100%' }} className="flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="font-bold text-sm text-slate-600">Loading room service...</p>
          </div>
        </div>
      );
    }

    // Check if there's a checked-in booking for this room
    const hasCheckedInGuest = syncEvents.some(
      e => e.type === 'booking' && e.roomNumber === guestRoomNumber && e.status === 'CheckedIn'
    );

    if (hasCheckedInGuest) {
      // Show the guest menu
      return (
        <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', width: '100%' }}>
          <GuestMenu
            roomNumber={guestRoomNumber}
            onValidateGuest={handleValidateGuest}
            onPlaceOrder={(_room, items) => handlePlaceOrder(guestRoomNumber, items)}
            onSecurityAlert={handleSecurityAlert}
          />
        </div>
      );
    } else {
      // No checked-in guest for this room - show error message
      return (
        <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', width: '100%' }} className="flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 text-center">
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">Room Not Active</h1>
              <p className="text-slate-400 text-sm mt-2 font-medium">Room {guestRoomNumber}</p>
            </div>

            {/* Content */}
            <div className="p-8 space-y-6">
              <div className="text-center">
                <p className="text-slate-600 leading-relaxed">
                  There is currently <strong className="text-slate-800">no guest checked in</strong> for this room.
                </p>
                <p className="text-slate-500 text-sm mt-3">
                  Room service is only available for guests with an active check-in.
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-amber-800">
                    <p className="font-bold">Need assistance?</p>
                    <p className="mt-1 text-amber-700">Please contact the front desk to complete your check-in process.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 text-center">
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
                Powered by SyncGuard PMS
              </p>
            </div>
          </div>
        </div>
      );
    }
  }

  if (isLoading || !selectedHotel) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fbfcfd] text-slate-500">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-bold text-sm">Initializing SyncGuard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col md:flex-row bg-[#fbfcfd] font-inter antialiased overflow-hidden">
      <nav className={`flex flex-col gap-6 shrink-0 shadow-xl z-20 border-r border-slate-700/30 bg-slate-800 text-white transition-all duration-300 ${isSidebarCollapsed ? 'w-20 p-4 items-center' : 'w-full md:w-64 px-5 py-6'}`}>
        <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center flex-col gap-4' : 'justify-between'}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="bg-indigo-500 p-2 rounded-lg shadow-lg shadow-indigo-500/20 shrink-0">
              <ShieldCheck className="w-5 h-5 flex-shrink-0" />
            </div>
            {!isSidebarCollapsed && <h1 className="text-lg font-bold tracking-tight whitespace-nowrap truncate">SyncGuard <span className="text-indigo-300">PMS</span></h1>}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsNotificationsPanelOpen(true)}
              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors shrink-0 relative"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                  {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors shrink-0"
            >
              {isSidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="relative pt-2 w-full">
          <button
            onClick={() => !isSidebarCollapsed && setIsHotelMenuOpen(!isHotelMenuOpen)}
            className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} p-3 bg-slate-700/40 hover:bg-slate-700 border border-slate-600/30 rounded-xl transition-all group`}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className={`p-2 rounded-lg bg-${selectedHotel.color}-500/20 text-${selectedHotel.color}-400 shrink-0`}>
                <Building2 className="w-4 h-4" />
              </div>
              {!isSidebarCollapsed && (
                <div className="text-left overflow-hidden">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Active Property</p>
                  <p className="font-bold text-sm truncate">{selectedHotel.name}</p>
                </div>
              )}
            </div>
            {!isSidebarCollapsed && <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isHotelMenuOpen ? 'rotate-180' : ''}`} />}
          </button>

          {isHotelMenuOpen && !isSidebarCollapsed && (
            <div className="absolute top-full left-0 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-30">
              {hotels.map(hotel => (
                <button
                  key={hotel.id}
                  onClick={() => {
                    setSelectedHotel(hotel);
                    setIsHotelMenuOpen(false);
                  }}
                  className={`w-full text-left p-4 hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-0 ${selectedHotel.id === hotel.id ? 'bg-slate-700/50' : ''
                    }`}
                >
                  <p className="font-bold text-sm">{hotel.name}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">{hotel.location}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col gap-1 mt-2 w-full overflow-y-auto min-h-0 custom-scrollbar">
          {navItems.map(item => (
            <div
              key={item.id}
              onDragOver={(e) => handleDragOver(e, item.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, item.id)}
              className={`relative transition-all duration-300 ${dragOverItem === item.id ? 'translate-x-1' : ''
                } ${draggedItem === item.id ? 'opacity-60 scale-95 ring-1 ring-white/10 rounded-xl bg-slate-700/50 shadow-inner' : ''}`}
            >
              {/* Drop indicator line */}
              {dragOverItem === item.id && draggedItem !== item.id && (
                <div className="absolute -top-1 left-2 right-2 h-0.5 bg-indigo-400 rounded-full shadow-lg shadow-indigo-400/50 z-10" />
              )}
              <div
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all group relative nav-item-row ${activeTab === item.id
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'hover:bg-slate-700/50 text-slate-400'
                  } ${isSidebarCollapsed ? 'justify-center' : ''}`}
              >
                <button
                  onClick={() => item.id !== 'flow' && setActiveTab(item.id as any)}
                  className={`flex flex-1 items-center gap-3 min-w-0 ${item.id === 'flow' ? 'cursor-not-allowed opacity-50' : ''}`}
                  title={isSidebarCollapsed ? item.label : (item.id === 'flow' ? 'Temporarily Deactivated' : undefined)}
                  disabled={item.id === 'flow'}
                >
                  <item.icon className={`w-5 h-5 shrink-0 ${activeTab === item.id ? item.color : (item.id === 'flow' ? 'text-slate-500' : '')}`} />
                  {!isSidebarCollapsed && <span className="font-semibold text-sm whitespace-nowrap truncate flex-1 text-left">{item.label}</span>}
                </button>

                {/* Drag handle - visible on hover, restricted to this element */}
                {!isSidebarCollapsed && (
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, item.id)}
                    onDragEnd={handleDragEnd}
                    className="cursor-grab active:cursor-grabbing p-1 -mr-1 hover:bg-white/10 rounded-md transition-all opacity-0 group-hover:opacity-100"
                  >
                    <GripVertical className={`w-4 h-4 shrink-0 ${activeTab === item.id ? 'text-white/60' : 'text-slate-500'}`} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-8 border-t border-slate-700/50 w-full">
          <div className={`flex items-center gap-3 p-3 text-slate-500 text-sm ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            <Database className="w-4 h-4 shrink-0" />
            {!isSidebarCollapsed && <span>Engine v2.6.0-pro</span>}
          </div>
        </div>
      </nav>

      <main className={`flex-1 flex flex-col min-h-0 bg-[#fbfcfd] relative ${activeTab === 'frontdesk' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {securityToast && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="bg-red-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border-2 border-red-400">
              <AlertCircle className="w-6 h-6 animate-pulse" />
              <p className="font-black text-sm uppercase tracking-tight">{securityToast}</p>
            </div>
          </div>
        )}

        {activeTab === 'flow' && <PitchView />}

        {activeTab === 'dashboard' && <InventoryDashboard hotelId={selectedHotel.id} connections={connections} rules={rules} roomTypes={roomTypes} syncEvents={syncEvents} setSyncEvents={setSyncEvents} />}
        {activeTab === 'rules' && (
          <RateRulesPage
            rules={rules}
            setRules={setRules}
            onStrategySync={(label) => {
              const eventId = `rule-${Date.now()}`;
              const activeChannels = connections.filter(c => c.status === 'connected');

              setSyncEvents(prev => [...prev, {
                id: eventId,
                type: 'rate_update',
                roomTypeId: roomTypes[0]?.id || 'global',
                newPrice: 0,
                timestamp: Date.now(),
                channelSync: {},
                ruleApplied: label
              }]);

              activeChannels.forEach(async (channel) => {
                if (channel.isStopped) {
                  setSyncEvents(prev => prev.map(e => e.id === eventId ? { ...e, channelSync: { ...(e.channelSync || {}), [channel.name]: 'stopped' } } : e));
                  return;
                }
                setSyncEvents(prev => prev.map(e => e.id === eventId ? { ...e, channelSync: { ...(e.channelSync || {}), [channel.name]: 'pending' } } : e));
                await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
                setSyncEvents(prev => prev.map(e => e.id === eventId ? { ...e, channelSync: { ...(e.channelSync || {}), [channel.name]: 'success' } } : e));
              });
            }}
          />
        )}
        {activeTab === 'analysis' && <AnalysisView />}
        {activeTab === 'reports' && <ReportsView />}
        {activeTab === 'settings' && <SettingsPage connections={connections} setConnections={setConnections} />}
        {activeTab === 'intelligence' && <IntelligenceView hotel={selectedHotel} />}
        {activeTab === 'setup' && <PropertySetupPage roomTypes={roomTypes} setRoomTypes={setRoomTypes} syncEvents={syncEvents} propertySettings={propertySettings} setPropertySettings={setPropertySettings} />}
        {activeTab === 'frontdesk' && (
          <FrontDeskView
            roomTypes={roomTypes}
            connections={connections}
            syncEvents={syncEvents}
            setSyncEvents={setSyncEvents}
            onUpdateExtraBeds={handleUpdateExtraBeds}
            roomSecurity={roomSecurity}
            propertySettings={propertySettings}
          />
        )}
        {activeTab === 'guests' && <GuestsView syncEvents={syncEvents} setSyncEvents={setSyncEvents} roomTypes={roomTypes} onUpdateExtraBeds={handleUpdateExtraBeds} />}
        {activeTab === 'compliance' && <ComplianceView syncEvents={syncEvents} setSyncEvents={setSyncEvents} />}
        {activeTab === 'security' && (
          <SecurityView
            attempts={verificationAttempts}
            roomSecurity={roomSecurity}
            onResetLock={resetRoomSecurity}
            onToggleQR={toggleQROrdering}
          />
        )}
      </main>

      {/* Notifications Panel */}
      <NotificationsPanel
        isOpen={isNotificationsPanelOpen}
        onClose={() => {
          setIsNotificationsPanelOpen(false);
          // Refresh count after closing
          import('./api').then(m => m.fetchUnreadNotificationCount()).then(count => setUnreadNotificationCount(count)).catch(() => { });
        }}
      />
    </div>
  );
};

export default App;
