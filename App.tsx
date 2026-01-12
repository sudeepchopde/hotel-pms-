
import React, { useState, useEffect } from 'react';
import BlueprintView from './components/BlueprintView';
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
import {
  LayoutDashboard, FileText, Database, Settings, ShieldCheck,
  BrainCircuit, Building2, ChevronDown, Presentation, TrendingUp,
  BarChart2, FileSpreadsheet, Home, ConciergeBell, Users, FileBadge,
  PanelLeftClose, PanelLeftOpen, ShieldAlert, AlertCircle
} from 'lucide-react';
import { Hotel, OTAConnection, RateRulesConfig, RoomType, SyncEvent, Booking, FolioItem, VerificationAttempt, RoomSecurityStatus } from './types';

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
  const [activeTab, setActiveTab] = useState<'blueprint' | 'dashboard' | 'settings' | 'intelligence' | 'flow' | 'rules' | 'analysis' | 'reports' | 'setup' | 'frontdesk' | 'guests' | 'compliance' | 'security'>('flow');
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [isHotelMenuOpen, setIsHotelMenuOpen] = useState(false);
  const [connections, setConnections] = useState<OTAConnection[]>([]);
  const [rules, setRules] = useState<RateRulesConfig | null>(null);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [syncEvents, setSyncEvents] = useState<SyncEvent[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch Data on Load
  useEffect(() => {
    const loadData = async () => {
      try {
        const [hotelsData, connectionsData, rulesData, roomTypesData, bookingsData] = await Promise.all([
          import('./api').then(m => m.fetchHotels()),
          import('./api').then(m => m.fetchConnections()),
          import('./api').then(m => m.fetchRules()),
          import('./api').then(m => m.fetchRoomTypes()),
          import('./api').then(m => m.fetchBookings())
        ]);

        setHotels(hotelsData);
        if (hotelsData.length > 0) setSelectedHotel(hotelsData[0]);
        setConnections(connectionsData);
        setRules(rulesData);
        setRoomTypes(roomTypesData);
        // Convert bookings to SyncEvents (assuming 'booking' type differentiation happens later or cast)
        const bookingEvents = bookingsData.map(b => ({ ...b, type: 'booking' } as SyncEvent));
        setSyncEvents(bookingEvents);
      } catch (error) {
        console.error("Failed to load initial data", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Security State
  const [verificationAttempts, setVerificationAttempts] = useState<VerificationAttempt[]>([]);
  const [roomSecurity, setRoomSecurity] = useState<RoomSecurityStatus[]>([]);
  const [securityToast, setSecurityToast] = useState<string | null>(null);

  // Guest Mode State
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [guestRoomNumber, setGuestRoomNumber] = useState<string>('');

  useEffect(() => {
    const handleUrlCheck = () => {
      const params = new URLSearchParams(window.location.search);
      let room = params.get('room');

      // If not in URL, check persisted guest session
      if (!room) {
        room = localStorage.getItem('guest_room_identity');
      }

      if (room) {
        localStorage.setItem('guest_room_identity', room);
        setIsGuestMode(true);
        setGuestRoomNumber(room);

        // Ensure a dummy booking exists for the room to make verification possible in demo
        setSyncEvents(prev => {
          const exists = prev.some(e => e.type === 'booking' && e.roomNumber === room && e.status === 'CheckedIn');
          if (exists) return prev;

          const dummyBooking: Booking = {
            id: `mock-bk-${room}`,
            roomTypeId: 'rt-1',
            roomNumber: room!,
            guestName: 'Vikram Malhotra',
            source: 'Direct',
            status: 'CheckedIn',
            timestamp: Date.now(),
            checkIn: new Date().toISOString().split('T')[0],
            checkOut: new Date(Date.now() + 86400000).toISOString().split('T')[0],
            amount: 4500,
            folio: []
          };
          return [...prev, { ...dummyBooking, type: 'booking' } as SyncEvent];
        });
      }
    };

    handleUrlCheck();
    window.addEventListener('popstate', handleUrlCheck);
    return () => window.removeEventListener('popstate', handleUrlCheck);
  }, []);

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

  const handlePlaceOrder = (roomNumber: string, items: { name: string, price: number }[]) => {
    const totalAmount = items.reduce((sum, i) => sum + i.price, 0);
    const description = `In-Room Dining - Order #${Math.floor(Math.random() * 1000)}`;

    setSyncEvents(prev => prev.map(e => {
      if (e.type === 'booking' && e.roomNumber === roomNumber && e.status === 'CheckedIn') {
        const newFolioItem: FolioItem = {
          id: `fi-${Date.now()}`,
          description,
          amount: totalAmount,
          category: 'F&B',
          timestamp: new Date().toISOString()
        };
        return {
          ...e,
          folio: [...(e.folio || []), newFolioItem]
        };
      }
      return e;
    }));
  };

  const handleUpdateExtraBeds = (bookingId: string, count: number) => {
    setSyncEvents(prev => prev.map(e => {
      if (e.type === 'booking' && e.id === bookingId) {
        const roomType = roomTypes.find(rt => rt.id === e.roomTypeId);
        const extraBedCharge = roomType?.extraBedCharge || 0;
        const totalExtraCharge = count * extraBedCharge;

        let newFolio = [...(e.folio || [])];
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

        return {
          ...e,
          extraBeds: count,
          folio: newFolio,
          timestamp: Date.now()
        };
      }
      return e;
    }));
  };

  if (isGuestMode) {
    return (
      <GuestMenu
        roomNumber={guestRoomNumber}
        onValidateGuest={handleValidateGuest}
        onPlaceOrder={handlePlaceOrder}
        onSecurityAlert={handleSecurityAlert}
      />
    );
  }

  if (isLoading || !selectedHotel) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fbfcfd] text-slate-500">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p>Loading SyncGuard PMS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#fbfcfd] font-inter antialiased">
      <nav className={`flex flex-col gap-6 shrink-0 shadow-xl z-20 border-r border-slate-700/30 bg-slate-800 text-white transition-all duration-300 ${isSidebarCollapsed ? 'w-20 p-4 items-center' : 'w-full md:w-64 p-6'}`}>
        <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center flex-col gap-4' : 'justify-between gap-3'}`}>
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500 p-2 rounded-lg shadow-lg shadow-indigo-500/20 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            {!isSidebarCollapsed && <h1 className="text-xl font-bold tracking-tight whitespace-nowrap">SyncGuard <span className="text-indigo-300">PMS</span></h1>}
          </div>
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            {isSidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
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

        <div className="flex flex-col gap-2 mt-2 w-full">
          {[
            { id: 'flow', icon: Presentation, label: 'Flow', color: 'text-amber-300' },
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
            { id: 'blueprint', icon: FileText, label: 'Tech Blueprint', color: 'text-slate-400' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-700/50 text-slate-400'
                } ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title={isSidebarCollapsed ? item.label : undefined}
            >
              <item.icon className={`w-5 h-5 shrink-0 ${activeTab === item.id ? item.color : ''}`} />
              {!isSidebarCollapsed && <span className="font-medium whitespace-nowrap">{item.label}</span>}
            </button>
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-8 border-t border-slate-700/50 w-full">
          <div className={`flex items-center gap-3 p-3 text-slate-500 text-sm ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            <Database className="w-4 h-4 shrink-0" />
            {!isSidebarCollapsed && <span>Engine v2.6.0-pro</span>}
          </div>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto bg-[#fbfcfd] relative">
        {securityToast && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="bg-red-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border-2 border-red-400">
              <AlertCircle className="w-6 h-6 animate-pulse" />
              <p className="font-black text-sm uppercase tracking-tight">{securityToast}</p>
            </div>
          </div>
        )}

        {activeTab === 'flow' && <PitchView />}
        {activeTab === 'blueprint' && <BlueprintView />}
        {activeTab === 'dashboard' && <InventoryDashboard hotelId={selectedHotel.id} connections={connections} rules={rules} roomTypes={roomTypes} syncEvents={syncEvents} setSyncEvents={setSyncEvents} />}
        {activeTab === 'rules' && <RateRulesPage rules={rules} setRules={setRules} />}
        {activeTab === 'analysis' && <AnalysisView />}
        {activeTab === 'reports' && <ReportsView />}
        {activeTab === 'settings' && <SettingsPage connections={connections} setConnections={setConnections} />}
        {activeTab === 'intelligence' && <IntelligenceView hotel={selectedHotel} />}
        {activeTab === 'setup' && <PropertySetupPage roomTypes={roomTypes} setRoomTypes={setRoomTypes} syncEvents={syncEvents} />}
        {activeTab === 'frontdesk' && (
          <FrontDeskView
            roomTypes={roomTypes}
            syncEvents={syncEvents}
            setSyncEvents={setSyncEvents}
            onUpdateExtraBeds={handleUpdateExtraBeds}
            roomSecurity={roomSecurity}
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
    </div>
  );
};

export default App;
