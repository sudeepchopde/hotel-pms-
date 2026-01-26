
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, RefreshCw, AlertTriangle, CheckCircle2,
  XCircle, Send, Terminal as TerminalIcon, Calendar, Hotel as HotelIcon, Zap, Loader2,
  Share2, RotateCcw, ShieldCheck, Clock, Timer, UserPlus, CreditCard, Laptop, ArrowRight,
  Moon, Tag, TrendingUp, X, BellOff, Hand, ShieldAlert
} from 'lucide-react';
import {
  RoomType, InventoryItem, Booking, SyncEvent, SystemLog,
  ChannelStatus, OTAConnection, RateRulesConfig, RateSyncEvent
} from '../types';
import MasterCalendar from './MasterCalendar';
import { updateBooking, createBooking } from '../api';

interface DashboardProps {
  hotelId: string;
  connections: OTAConnection[];
  rules: RateRulesConfig;
  roomTypes: RoomType[];
  syncEvents: SyncEvent[];
  setSyncEvents: React.Dispatch<React.SetStateAction<SyncEvent[]>>;
}

const SOURCES = ['MMT', 'Booking.com', 'Expedia', 'Direct'] as const;

const AUTO_RETRY_DELAY = 5000;
const MAX_AUTO_RETRIES = 3;

const InventoryDashboard: React.FC<DashboardProps> = ({ hotelId, connections, rules, roomTypes, syncEvents, setSyncEvents }) => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const [guestName, setGuestName] = useState('');
  const [selectedRoomType, setSelectedRoomType] = useState('');
  const [fdCheckIn, setFdCheckIn] = useState('');
  const [fdCheckOut, setFdCheckOut] = useState('');

  const [otaCheckIn, setOtaCheckIn] = useState('');
  const [otaCheckOut, setOtaCheckOut] = useState('');
  const [otaRoomType, setOtaRoomType] = useState('');

  const inventoryRef = useRef<InventoryItem[]>([]);
  const eventsRef = useRef<SyncEvent[]>([]);
  const retryRegistry = useRef<Record<string, number>>({});

  useEffect(() => { inventoryRef.current = inventory; }, [inventory]);
  useEffect(() => { eventsRef.current = syncEvents; }, [syncEvents]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (roomTypes.length > 0) {
      setSelectedRoomType(roomTypes[0].id);
      setOtaRoomType(roomTypes[0].id);
    }
  }, [roomTypes]);

  const activeChannels = connections.filter(c => c.status === 'connected');
  const stoppedChannels = connections.filter(c => c.isStopped);

  // Core Yield Logic: Calculate final rate based on rules
  const calculateFinalRate = (basePrice: number, dateStr: string, roomTypeId: string): { price: number, rule: string | undefined } => {
    const rt = roomTypes.find(t => t.id === roomTypeId);
    if (!rt) return { price: basePrice, rule: undefined };

    let finalPrice = basePrice;
    let appliedRule: string | undefined = undefined;

    const current = new Date(dateStr);
    current.setHours(0, 0, 0, 0);

    const event = rules.specialEvents.find(e => {
      const start = new Date(e.startDate);
      const end = new Date(e.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      return current >= start && current <= end;
    });

    if (event) {
      if (event.modifierType === 'percentage') {
        finalPrice = basePrice * event.modifierValue;
      } else {
        finalPrice = basePrice + event.modifierValue;
      }
      appliedRule = event.name;
    }
    else if (rules.weeklyRules.isActive) {
      const day = current.getDay();
      if (rules.weeklyRules.activeDays.includes(day)) {
        if (rules.weeklyRules.modifierType === 'percentage') {
          finalPrice = basePrice * rules.weeklyRules.modifierValue;
        } else {
          finalPrice = basePrice + rules.weeklyRules.modifierValue;
        }
        appliedRule = 'Weekly Strategy';
      }
    }

    const clampedPrice = Math.max(rt.floorPrice, Math.min(rt.ceilingPrice, finalPrice));
    return { price: Math.round(clampedPrice), rule: appliedRule };
  };

  const initializedHotelId = useRef<string | null>(null);

  // Rehydrate Inventory State from Rules & SyncEvents (Bookings)
  useEffect(() => {
    if (roomTypes.length === 0) return;

    const today = new Date();
    const initialInventory: InventoryItem[] = [];
    const dates: string[] = [];

    // 1. Generate Base Grid
    for (let i = 0; i < 1095; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      dates.push(dateStr);

      roomTypes.forEach(rt => {
        const yieldCalc = calculateFinalRate(rt.basePrice, dateStr, rt.id);
        initialInventory.push({
          date: dateStr,
          roomTypeId: rt.id,
          availableCount: rt.totalCapacity,
          price: yieldCalc.price,
          isLocked: false,
          appliedRule: yieldCalc.rule
        });
      });
    }

    // 2. Apply Daily Rate Overrides
    const rateUpdates = syncEvents.filter(e => e.type === 'rate_update' && e.date);
    rateUpdates.forEach(e => {
      if (e.type === 'rate_update' && e.date) {
        const item = initialInventory.find(i => i.date === e.date && i.roomTypeId === e.roomTypeId);
        if (item) {
          item.price = e.newPrice;
          item.appliedRule = e.ruleApplied || 'Manual Override';
        }
      }
    });

    // 3. Deduct Confirmed & Active Bookings
    const occupiedBookings = syncEvents.filter(e =>
      e.type === 'booking' && (e.status === 'Confirmed' || e.status === 'CheckedIn' || e.status === 'CheckedOut')
    ) as Booking[];
    occupiedBookings.forEach(b => {
      let d = new Date(b.checkIn);
      const end = new Date(b.checkOut);
      while (d < end) {
        const dateStr = d.toISOString().split('T')[0];
        const item = initialInventory.find(i => i.date === dateStr && i.roomTypeId === b.roomTypeId);
        if (item) {
          item.availableCount = Math.max(0, item.availableCount - 1);
        }
        d.setDate(d.getDate() + 1);
      }
    });

    setInventory(initialInventory);

    if (dates.length >= 2 && !fdCheckIn) {
      setFdCheckIn(dates[0]);
      setFdCheckOut(dates[1]);
      setOtaCheckIn(dates[0]);
      setOtaCheckOut(dates[1]);
    }
    initializedHotelId.current = hotelId;
    addLog('INFO', `Atomic Engine: Inventory synchronized with ${rules.specialEvents.length} priority overrides.`);
  }, [hotelId, roomTypes, rules, syncEvents]);

  const addLog = (level: SystemLog['level'], message: string, data?: any) => {
    const newLog: SystemLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
      level,
      message,
      data
    };
    setLogs(prev => [...prev, newLog]);
  };

  const updateEventChannelStatus = (eventId: string, channel: string, status: ChannelStatus) => {
    setSyncEvents(prev => prev.map(e => {
      if (e.id === eventId) {
        return { ...e, channelSync: { ...e.channelSync, [channel]: status } };
      }
      return e;
    }));
  };

  const retryChannelSync = async (eventId: string, channel: string, isAuto = false) => {
    const event = eventsRef.current.find(e => e.id === eventId);
    if (!event) return;

    const registryKey = `${eventId}-${channel}`;
    const currentAttempt = (retryRegistry.current[registryKey] || 0) + 1;
    retryRegistry.current[registryKey] = currentAttempt;

    updateEventChannelStatus(eventId, channel, 'retrying');
    addLog('WARNING', `RETRY [${currentAttempt}/${MAX_AUTO_RETRIES}]: Re-dispatching to ${channel}...`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    if (Math.random() < 0.2) {
      if (currentAttempt < MAX_AUTO_RETRIES) {
        updateEventChannelStatus(eventId, channel, 'waiting_retry');
        setTimeout(() => retryChannelSync(eventId, channel, true), AUTO_RETRY_DELAY);
      } else {
        updateEventChannelStatus(eventId, channel, 'error');
        addLog('ERROR', `FATAL: Maximum retries reached for ${channel}.`);
      }
    } else {
      updateEventChannelStatus(eventId, channel, 'success');
      addLog('SUCCESS', `RECOVERY: ${channel} update confirmed.`);
    }
  };

  const simulateFanOut = async (eventId: string, source: string, label: string, basePrice?: number) => {
    activeChannels.forEach(async (channel) => {
      if (channel.name === source) {
        updateEventChannelStatus(eventId, channel.name, 'success');
        return;
      }

      // Check for STOP SELL Master Switch
      if (channel.isStopped) {
        updateEventChannelStatus(eventId, channel.name, 'stopped');
        addLog('WARNING', `CIRCUIT BREAKER: Sync skipped for ${channel.name} (Stop-Sell Active).`);
        return;
      }

      let finalPriceLabel = label;
      if (basePrice !== undefined && channel.markupValue) {
        const markedPrice = channel.markupType === 'percentage'
          ? Math.round(basePrice * (1 + channel.markupValue / 100))
          : basePrice + channel.markupValue;

        // Store channel-specific price in event metadata for UI
        setSyncEvents(prev => prev.map(e => {
          if (e.id === eventId && e.type === 'rate_update') {
            return { ...e, channelPrices: { ...(e.channelPrices || {}), [channel.name]: markedPrice } };
          }
          return e;
        }));

        finalPriceLabel = `Rate ₹${markedPrice.toLocaleString()} (Markup applied)`;
      }

      updateEventChannelStatus(eventId, channel.name, 'pending');
      addLog('INFO', `PIPELINE: Sending ${finalPriceLabel} to ${channel.name}...`);

      const latency = 500 + Math.random() * 2000;
      await new Promise(resolve => setTimeout(resolve, latency));

      if (Math.random() < 0.1) {
        updateEventChannelStatus(eventId, channel.name, 'waiting_retry');
        addLog('ERROR', `API REJECT: ${channel.name} returned 503.`);
        setTimeout(() => retryChannelSync(eventId, channel.name, true), 1000);
      } else {
        updateEventChannelStatus(eventId, channel.name, 'success');
        addLog('SUCCESS', `ACK: ${channel.name} successfully synchronized.`);
      }
    });
  };

  const simulateRateSync = async (roomTypeId: string, newPrice: number, date?: string, ruleApplied?: string) => {
    const eventId = `r-${Date.now()}`;
    const roomName = roomTypes.find(rt => rt.id === roomTypeId)?.name || roomTypeId;
    const label = `Rate (₹${newPrice.toLocaleString()})${ruleApplied ? ` [via ${ruleApplied}]` : ''}`;

    addLog('INFO', `BROADCAST: Dispatching Yield Rate (Base: ₹${newPrice.toLocaleString()}) for ${roomName}.`);

    setSyncEvents(prev => [...prev, {
      id: eventId,
      type: 'rate_update',
      roomTypeId,
      newPrice,
      date,
      timestamp: Date.now(),
      channelSync: {},
      channelPrices: {},
      ruleApplied
    }]);

    simulateFanOut(eventId, 'Direct', label, newPrice);
  };

  const handleBookingTransaction = async (source: Booking['source'], roomTypeId: string, checkIn: string, checkOut: string, customName?: string) => {
    // Check if the source is currently stopped (OTA simulator only)
    const otaConn = connections.find(c => c.name === source);
    if (otaConn && otaConn.isStopped) {
      addLog('ERROR', `GATEWAY REJECT: Ignoring booking from ${source} (Stop-Sell active).`);
      return false;
    }

    const datesToBook: string[] = [];
    let d = new Date(checkIn);
    const end = new Date(checkOut);
    while (d < end) {
      datesToBook.push(d.toISOString().split('T')[0]);
      d.setDate(d.getDate() + 1);
    }

    if (datesToBook.length === 0) {
      addLog('ERROR', `VALIDATION: Invalid date range.`);
      return false;
    }

    const currentInv = inventoryRef.current;
    const itemsToBook = currentInv.filter(item =>
      item.roomTypeId === roomTypeId && datesToBook.includes(item.date)
    );

    const isAvailable = itemsToBook.length === datesToBook.length && itemsToBook.every(i => i.availableCount > 0);

    if (!isAvailable) {
      addLog('ERROR', `CONFLICT: Inventory collision detected. Overbooking prevented for ${source}.`);
      return false;
    }

    const bookingId = `b-${Date.now()}-${Math.random()}`;
    const shortId = bookingId.split('-')[1].slice(-4);

    // Find and assign available room number
    const rt = roomTypes.find(r => r.id === roomTypeId);
    let assignedRoomNumber: string | undefined;

    if (rt) {
      // Generate possible room numbers if not defined (fallback logic matching FrontDeskView)
      const allRoomNumbers = rt.roomNumbers && rt.roomNumbers.length > 0
        ? rt.roomNumbers
        : Array.from({ length: rt.totalCapacity }, (_, i) => `${rt.name.substring(0, 2).toUpperCase()}-${101 + i}`);

      // Get active bookings that overlap with this new booking
      const overlappingBookings = eventsRef.current.filter(e =>
        e.type === 'booking' &&
        (e.status === 'Confirmed' || e.status === 'CheckedIn' || e.status === 'CheckedOut') &&
        e.roomTypeId === roomTypeId &&
        e.checkIn < checkOut && e.checkOut > checkIn
      ) as Booking[];

      const occupiedRooms = new Set(overlappingBookings.map(b => b.roomNumber));
      // Find first available room
      assignedRoomNumber = allRoomNumbers.find(rn => !occupiedRooms.has(rn));
    }

    if (!assignedRoomNumber) assignedRoomNumber = 'Unassigned';

    // Optimistic Update for UI Feedback (Locking)
    setInventory(prev => prev.map(item => {
      if (item.roomTypeId === roomTypeId && datesToBook.includes(item.date)) {
        return { ...item, availableCount: item.availableCount - 1, isLocked: true };
      }
      return item;
    }));

    addLog('SUCCESS', `ATOMIC LOCK: Secured Room ${assignedRoomNumber} for #TX-${shortId}.`);

    const newBooking: Booking = {
      id: bookingId, roomTypeId,
      roomNumber: assignedRoomNumber,
      guestName: customName || 'OTA Guest',
      source, status: 'Confirmed', timestamp: Date.now(), checkIn, checkOut, channelSync: {}, folio: []
    };

    setSyncEvents(prev => [...prev, { ...newBooking, type: 'booking' } as SyncEvent]);

    createBooking(newBooking).catch(err => {
      addLog('ERROR', `PERSISTENCE FAIL: Could not save new booking to database.`);
    });

    simulateFanOut(bookingId, source, `Booking #TX-${shortId}`);

    setTimeout(() => {
      setInventory(prev => prev.map(i =>
        datesToBook.includes(i.date) && i.roomTypeId === roomTypeId ? { ...i, isLocked: false } : i
      ));
    }, 800);

    return true;
  };

  const handleCancellation = async (bookingId: string) => {
    const booking = syncEvents.find(e => e.id === bookingId && e.type === 'booking') as Booking | undefined;
    if (!booking || booking.status === 'Cancelled') return;

    setIsSyncing(true);
    const shortId = booking.id.split('-')[1]?.slice(-4) || 'UNKNOWN';
    addLog('WARNING', `WEBHOOK: CANCELLATION for Booking #${shortId}. Releasing inventory...`);

    const updated = { ...booking, status: 'Cancelled' as any, timestamp: Date.now() };

    // Updates to syncEvents will trigger the useEffect to restore inventory counts
    setSyncEvents(prev => prev.map(e =>
      e.id === bookingId ? { ...updated, type: 'booking' } as SyncEvent : e
    ));

    updateBooking(updated).then(() => {
      addLog('SUCCESS', `DATABASE: Cancellation persistent.`);
    }).catch(err => {
      addLog('ERROR', `DATABASE FAIL: Cancellation not saved.`);
    });

    await new Promise(resolve => setTimeout(resolve, 800));

    addLog('SUCCESS', `RESTORED: Inventory restored.`);
    const eventId = `c-${Date.now()}`;
    const label = `Inv Update (Cancel #${shortId})`;

    setSyncEvents(prev => [...prev, {
      id: eventId,
      type: 'rate_update', // Using rate_update as a generic sync tracking type here
      roomTypeId: booking.roomTypeId,
      newPrice: booking.amount,
      timestamp: Date.now(),
      channelSync: {},
      ruleApplied: 'Inventory Release'
    }]);

    simulateFanOut(eventId, 'PMS', label);
    setIsSyncing(false);
  };

  const simulateRandomCancellation = () => {
    const confirmedBookings = syncEvents.filter(e => e.type === 'booking' && e.status === 'Confirmed');
    if (confirmedBookings.length === 0) return;
    const target = confirmedBookings[confirmedBookings.length - 1];
    handleCancellation(target.id);
  };

  const handleFrontDeskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName || !selectedRoomType || !fdCheckIn || !fdCheckOut) return;
    setIsSyncing(true);
    const success = await handleBookingTransaction('Direct', selectedRoomType, fdCheckIn, fdCheckOut, guestName);
    if (success) setGuestName('');
    setIsSyncing(false);
  };

  const runParallelLoadTest = async () => {
    setIsSyncing(true);
    addLog('WARNING', "STRESS TEST: 8 concurrent signals initiated...");
    const dates: string[] = Array.from(new Set<string>(inventory.map(i => i.date))).sort();
    if (dates.length < 2 || roomTypes.length === 0) {
      setIsSyncing(false);
      return;
    }
    for (let i = 0; i < 8; i++) {
      const source = SOURCES[i % SOURCES.length];
      const rt = roomTypes[Math.floor(Math.random() * roomTypes.length)];
      const startDay = Math.floor(Math.random() * (dates.length - 1));
      await new Promise(r => setTimeout(r, 150));
      handleBookingTransaction(source, rt.id, dates[startDay], dates[startDay + 1], `LoadTester-${i + 1}`);
    }
    setIsSyncing(false);
  };

  const handleUpdatePrice = useCallback((roomTypeId: string, newPrice: number) => {
    simulateRateSync(roomTypeId, newPrice);
  }, [roomTypes, rules]);

  const handleUpdateDailyPrice = useCallback((roomTypeId: string, date: string, newPrice: number) => {
    // Local optimistic update
    setInventory(prev => prev.map(item => (item.roomTypeId === roomTypeId && item.date === date) ? { ...item, price: newPrice, appliedRule: 'Manual Override' } : item));
    // Dispatch event
    simulateRateSync(roomTypeId, newPrice, date, 'Manual Override');
  }, [roomTypes]);

  const availableDates: string[] = Array.from(new Set<string>(inventory.map(i => i.date))).sort();

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 bg-[#fbfcfd] min-h-full pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
            Inventory Command Center
            <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full ml-2 border border-indigo-100/50 uppercase">
              Yield Engine v2
            </span>
          </h2>
          <p className="text-slate-500 text-sm mt-1">Markups and Stop-Sells are evaluated globally during sync.</p>
        </div>
        <div className="flex gap-2">
          {stoppedChannels.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl animate-in fade-in zoom-in">
              <ShieldAlert className="w-4 h-4" />
              <span className="text-xs font-bold">{stoppedChannels.length} Channels Blocked</span>
            </div>
          )}
          <button
            disabled={isSyncing || availableDates.length < 2 || roomTypes.length === 0}
            onClick={runParallelLoadTest}
            className="flex items-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-all shadow-lg disabled:opacity-50 group"
          >
            <Zap className="w-4 h-4 text-amber-300 group-hover:scale-125 transition-transform" />
            Parallel Load Test
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <MasterCalendar
            inventory={inventory}
            roomTypes={roomTypes}
            isSyncing={isSyncing}
            onUpdatePrice={handleUpdatePrice}
            onUpdateDailyPrice={handleUpdateDailyPrice}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900">
                <div className="flex items-center gap-3">
                  <HotelIcon className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-black text-white text-[11px] uppercase tracking-[0.2em]">Front Desk Terminal</h3>
                </div>
              </div>
              <div className="p-8 space-y-6">
                <form onSubmit={handleFrontDeskSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest block flex items-center gap-2">
                      <UserPlus className="w-3.5 h-3.5 text-indigo-500" /> Guest Name
                    </label>
                    <input
                      type="text"
                      placeholder="John Doe"
                      value={guestName}
                      onChange={e => setGuestName(e.target.value)}
                      className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl text-sm font-bold text-slate-900 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest block">Check-In</label>
                      <select value={fdCheckIn} onChange={e => setFdCheckIn(e.target.value)} className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-indigo-500">
                        {availableDates.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest block">Check-Out</label>
                      <select value={fdCheckOut} onChange={e => setFdCheckOut(e.target.value)} className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-indigo-500">
                        {availableDates.map(d => <option key={d} value={d} disabled={d <= fdCheckIn}>{d}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest block">Room Category</label>
                    <select value={selectedRoomType} onChange={e => setSelectedRoomType(e.target.value)} className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-indigo-500">
                      {roomTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                    </select>
                  </div>
                  <button type="submit" disabled={isSyncing || !guestName} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-xl disabled:opacity-50">
                    {isSyncing ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Confirm Booking'}
                  </button>
                </form>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-widest flex items-center gap-2">
                  <Send className="w-4 h-4 text-indigo-400" /> OTA Simulation
                </h3>
              </div>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase">In</label>
                    <select value={otaCheckIn} onChange={e => setOtaCheckIn(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:border-indigo-400">
                      {availableDates.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase">Out</label>
                    <select value={otaCheckOut} onChange={e => setOtaCheckOut(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:border-indigo-400">
                      {availableDates.map(d => <option key={d} value={d} disabled={d <= otaCheckIn}>{d}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase">Room Category</label>
                  <select value={otaRoomType} onChange={e => setOtaRoomType(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:border-indigo-400">
                    {roomTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {SOURCES.filter(s => s !== 'Direct').map(source => {
                    const isStopped = connections.find(c => c.name === source)?.isStopped;
                    return (
                      <button
                        key={source}
                        disabled={isSyncing || isStopped}
                        onClick={async () => {
                          setIsSyncing(true);
                          await handleBookingTransaction(source, otaRoomType, otaCheckIn, otaCheckOut);
                          setIsSyncing(false);
                        }}
                        className={`px-3 py-4 border-2 font-black text-[10px] rounded-xl flex flex-col items-center gap-2 transition-all active:scale-95 ${isStopped
                          ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-60'
                          : 'bg-white border-slate-100 hover:border-indigo-400 text-slate-900 shadow-sm'
                          }`}
                      >
                        {isStopped ? <Hand className="w-4 h-4" /> : <Share2 className="w-4 h-4 text-indigo-400" />}
                        {source}
                        {isStopped && <span className="text-[7px] text-amber-500">STOP SELL</span>}
                      </button>
                    )
                  })}
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <button
                    onClick={simulateRandomCancellation}
                    disabled={isSyncing || syncEvents.filter(e => e.type === 'booking' && e.status === 'Confirmed').length === 0}
                    className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all border border-red-100 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <BellOff className="w-3.5 h-3.5" /> Simulate Incoming Webhook: Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl flex flex-col h-[350px] overflow-hidden">
            <div className="p-4 bg-slate-800 border-b border-slate-700 font-bold text-indigo-300 text-[10px] uppercase tracking-widest flex items-center gap-2">
              <TerminalIcon className="w-4 h-4" /> Pipeline Monitor
            </div>
            <div ref={logContainerRef} className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-[9px]">
              {logs.map(log => (
                <div key={log.id} className="flex gap-2">
                  <span className="text-slate-600">{log.timestamp}</span>
                  <span className={`font-bold ${log.level === 'SUCCESS' ? 'text-emerald-400' : log.level === 'ERROR' ? 'text-red-400' : log.level === 'WARNING' ? 'text-amber-400' : 'text-indigo-400'}`}>{log.level}:</span>
                  <span className="text-slate-300">{log.message}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm flex flex-col h-[450px] overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-800 text-[10px] uppercase tracking-widest">Global Propagation</div>
            <div className="overflow-y-auto flex-1 divide-y divide-slate-100/50">
              {syncEvents.slice().reverse().map(event => (
                <div key={event.id} className="p-5 space-y-3 hover:bg-slate-50/50 transition-colors group/item">
                  <div className="flex justify-between items-start text-[11px] font-bold">
                    <div className="flex items-center gap-2">
                      {event.type === 'booking' ? (
                        <>
                          <span className={`${event.status === 'Cancelled' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                            #TX-{event.id.split('-')[1]?.slice(-6) || '??'} from <span className="text-indigo-600 uppercase">{event.source}</span>
                          </span>
                          {event.status === 'Cancelled' && <span className="text-[8px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">CANCELLED</span>}
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5 text-fuchsia-600 uppercase">
                          <Tag className="w-3 h-3" />
                          Yield Sync: ₹{event.newPrice.toLocaleString()}
                          {event.ruleApplied && <span className="text-[8px] bg-fuchsia-50 text-fuchsia-500 px-1 rounded ml-1">{event.ruleApplied}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-slate-400">{new Date(event.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {connections.filter(c => c.status === 'connected').map(ch => {
                      const status = event.channelSync?.[ch.name];
                      const specificPrice = event.type === 'rate_update' ? event.channelPrices?.[ch.name] : null;

                      let statusClasses = "bg-slate-100 text-slate-400 border-slate-200";
                      let statusLabel = ch.name;

                      if (status === 'success') statusClasses = "bg-emerald-500 text-white border-emerald-600 shadow-sm";
                      else if (status === 'error') statusClasses = "bg-red-500 text-white border-red-600 shadow-sm";
                      else if (status === 'retrying') statusClasses = "bg-indigo-500 text-white border-indigo-600 animate-pulse shadow-sm";
                      else if (status === 'waiting_retry') statusClasses = "bg-amber-500 text-white border-amber-600 animate-pulse shadow-sm";
                      else if (status === 'pending') statusClasses = "bg-indigo-400 text-white border-indigo-500 animate-pulse shadow-sm";
                      else if (status === 'stopped') {
                        statusClasses = "bg-amber-500 text-white border-amber-600 shadow-sm ring-1 ring-amber-300";
                        statusLabel = "CLOSED";
                      }

                      return (
                        <div key={ch.name} className={`px-2.5 py-1 border rounded-lg text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${statusClasses} flex flex-col items-center`}>
                          <span>{statusLabel === "CLOSED" ? `${ch.name} (CLOSED)` : ch.name}</span>
                          {specificPrice && status !== 'stopped' && <span className="text-[7px] opacity-80">₹{specificPrice.toLocaleString()}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryDashboard;
