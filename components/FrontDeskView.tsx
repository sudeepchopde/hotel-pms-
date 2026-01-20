
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft, ChevronRight, Calendar, User,
  Bed, Maximize2, Minimize2, GripVertical, CheckCircle2,
  AlertOctagon, XCircle, LogIn, LogOut, ScanLine, CreditCard, ShieldAlert,
  Loader2, Search, Plus, FileText, Lock, Smartphone, Mail, MapPin, FileBadge, Keyboard, X, Clock, Camera, RotateCcw,
  Star, Globe, Plane, Upload, Printer, LayoutGrid, Briefcase, Flag, Zap, ArrowRightCircle, Minus, AlertTriangle, Check
} from 'lucide-react';
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
  pointerWithin,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor
} from '@dnd-kit/core';
import { GoogleGenAI, Type } from "@google/genai";
import { RoomType, SyncEvent, Booking, GuestDetails, RoomSecurityStatus, ChannelStatus, OTAConnection, FolioItem, Payment, PropertySettings } from '../types';
import GuestProfilePage from './GuestProfilePage';
import NewBookingModal from './NewBookingModal';
import { createBulkBookings, updateBooking, transferBooking, lookupGuest, fetchBookings } from '../api';
import { NATIONALITIES } from '../constants';

interface FrontDeskViewProps {
  roomTypes: RoomType[];
  connections: OTAConnection[];
  syncEvents: SyncEvent[];
  setSyncEvents: React.Dispatch<React.SetStateAction<SyncEvent[]>>;
  onUpdateExtraBeds?: (bookingId: string, count: number) => void;
  roomSecurity?: RoomSecurityStatus[];
  propertySettings: PropertySettings | null;
}

const CELL_WIDTH = 140;
const CELL_HEIGHT = 48;
const HEADER_HEIGHT = 48; // Matching room row height
const STICKY_HEADER_TOTAL_HEIGHT = 104; // Monthly row (24) + Date row (48) + padding-y (16*2)

const STATUS_STYLES: Record<string, string> = {
  'Confirmed': 'bg-blue-600 text-white shadow-blue-900/10',
  'CheckedIn': 'bg-emerald-600 text-white shadow-emerald-900/10',
  'Pending': 'bg-amber-500 text-white shadow-amber-900/10',
  'Warning': 'bg-rose-600 text-white shadow-rose-900/10',
  'CheckedOut': 'bg-slate-500 text-white shadow-slate-900/10',
  'VIP': 'bg-violet-600 text-white shadow-violet-900/10'
};

const CATEGORY_GRADIENTS = [
  { background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }, // slate
  { background: 'linear-gradient(135deg, #4f46e5 0%, #1d4ed8 100%)' }, // indigo-blue
  { background: 'linear-gradient(135deg, #7c3aed 0%, #c026d3 100%)' }, // violet-fuchsia
  { background: 'linear-gradient(135deg, #0d9488 0%, #115e59 100%)' }, // teal
  { background: 'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)' }, // rose
];

// SOFTER TINTS FOR ROOM LANES (400-level at 50% opacity)
const ROW_TINTS = [
  { backgroundColor: 'rgba(148, 163, 184, 0.4)' }, // slate
  { backgroundColor: 'rgba(96, 165, 250, 0.4)' }, // blue
  { backgroundColor: 'rgba(192, 132, 252, 0.4)' }, // purple
  { backgroundColor: 'rgba(45, 212, 191, 0.4)' }, // teal
  { backgroundColor: 'rgba(251, 113, 133, 0.4)' }, // rose
];

const LABEL_TINTS = [
  { backgroundColor: '#f1f5f9' }, // slate-100
  { backgroundColor: '#eff6ff' }, // blue-50
  { backgroundColor: '#faf5ff' }, // purple-50
  { backgroundColor: '#f0fdfa' }, // teal-50
  { backgroundColor: '#fff1f2' }, // rose-50
];

interface DraggableBookingProps {
  booking: Booking;
  duration: number;
  isOverlay?: boolean;
  isValid?: boolean;
  onResize?: (newDuration: number) => void;
  onSelect?: (booking: Booking) => void;
  isJustMoved?: boolean;
}

const DraggableBooking = ({ booking, duration, isOverlay = false, isValid = true, onResize, onSelect, isJustMoved }: DraggableBookingProps) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: booking.id,
    data: { ...booking, duration },
    disabled: false
  });

  const [localDuration, setLocalDuration] = useState(duration);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (!isResizing) setLocalDuration(duration);
  }, [duration, isResizing]);

  const style = {
    width: `${localDuration * CELL_WIDTH - 16}px`,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 10,
  };

  const getStatusStyle = () => {
    if (isOverlay) {
      return isValid
        ? 'bg-emerald-600 border-emerald-400 ring-4 ring-emerald-500/20'
        : 'bg-rose-600 border-rose-400 ring-4 ring-rose-500/20';
    }
    if (booking.status === 'Cancelled' || booking.status === 'Rejected') return STATUS_STYLES['Warning'];
    if (booking.status === 'CheckedIn') return STATUS_STYLES['CheckedIn'];
    if (booking.status === 'CheckedOut') return STATUS_STYLES['CheckedOut'];
    if (booking.isVIP) return STATUS_STYLES['VIP'];
    return STATUS_STYLES['Confirmed'];
  };

  const displayColor = getStatusStyle();

  const handleResizeStart = (e: React.PointerEvent) => {
    if (!onResize) return;
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const initialDuration = localDuration;
    const handlePointerMove = (ev: PointerEvent) => {
      const deltaX = ev.clientX - startX;
      const steps = Math.round(deltaX / CELL_WIDTH);
      const nextDuration = Math.max(1, initialDuration + steps);
      setLocalDuration(nextDuration);
    };
    const handlePointerUp = (ev: PointerEvent) => {
      const deltaX = ev.clientX - startX;
      const steps = Math.round(deltaX / CELL_WIDTH);
      const finalDuration = Math.max(1, initialDuration + steps);
      setIsResizing(false);
      onResize(finalDuration);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!isDragging && !isResizing && onSelect) {
      e.stopPropagation();
      onSelect(booking);
    }
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      className={`absolute top-0.5 bottom-0.5 left-1 rounded-lg border border-white/30 shadow-2xl cursor-pointer overflow-hidden ${displayColor} transition-all duration-300 group hover:scale-[1.02] hover:shadow-indigo-900/20 hover:z-20 hover:border-white/60 ${isJustMoved ? 'animate-pulse ring-4 ring-white/50' : ''}`}
      onClick={handleClick}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent pointer-events-none"></div>
      <div className="relative h-full flex flex-col justify-center px-2">
        <div className="flex flex-col gap-0">
          <span className="text-[10px] font-black leading-tight text-white drop-shadow-md truncate uppercase tracking-tighter">{booking.guestName}</span>
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-black text-white/80 uppercase tracking-widest opacity-90">{booking.source}</span>
            {booking.isVIP && <Star className="w-2 h-2 text-amber-200 fill-amber-200" />}
          </div>
        </div>
      </div>
      {!isOverlay && onResize && (
        <div className="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize hover:bg-white/10 flex items-center justify-center transition-colors z-20 opacity-0 group-hover:opacity-100"
          onPointerDown={handleResizeStart}>
          <GripVertical className="w-3 h-3 text-white/50" />
        </div>
      )}
    </div>
  );
};

interface DroppableCellProps {
  date: string;
  roomNumber: string;
  children?: React.ReactNode;
  isWeekend: boolean;
  isToday: boolean;
  onClick?: () => void;
}

const DroppableCell: React.FC<DroppableCellProps> = ({ date, roomNumber, children, isWeekend, isToday, onClick }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `${roomNumber}::${date}`,
    data: { date, roomNumber }
  });
  return (
    <div ref={setNodeRef} onClick={onClick} className={`relative border-r border-black/5 flex-shrink-0 h-[48px] transition-colors ${isWeekend ? 'bg-black/5' : 'bg-transparent'} ${isOver ? 'bg-indigo-400/20 ring-inset ring-2 ring-indigo-400/50 z-0' : ''} ${isToday ? 'bg-indigo-500/10' : ''} ${!children ? 'cursor-cell hover:bg-indigo-50/50' : ''}`} style={{ width: CELL_WIDTH }}>
      {children}
    </div>
  );
};

const FrontDeskView: React.FC<FrontDeskViewProps> = ({ roomTypes, connections, syncEvents, setSyncEvents, onUpdateExtraBeds, roomSecurity = [], propertySettings }) => {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [lastMovedBookingId, setLastMovedBookingId] = useState<string | null>(null);

  // Panning State
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStartX, setPanStartX] = useState(0);
  const [panScrollLeft, setPanScrollLeft] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const [dragState, setDragState] = useState<{
    activeId: string | null,
    isValid: boolean,
    targetRoom: string | null,
    targetDate: string | null,
    versionSnapshot: number | null
  }>({
    activeId: null, isValid: true, targetRoom: null, targetDate: null, versionSnapshot: null
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [activeCheckInBooking, setActiveCheckInBooking] = useState<Booking | null>(null);
  const [isRepeatGuest, setIsRepeatGuest] = useState(false);
  const [isIdMasked, setIsIdMasked] = useState(false);
  const [isAddingAccessory, setIsAddingAccessory] = useState(false);
  const [editingAccessoryIndex, setEditingAccessoryIndex] = useState<number | null>(null);
  const [checkInMode, setCheckInMode] = useState<'scan' | 'manual' | 'form_scan'>('scan');
  const [ocrStep, setOcrStep] = useState<'idle' | 'scan_front' | 'scan_back' | 'scan_visa' | 'scan_additional' | 'scan_form' | 'processing' | 'success'>('idle');
  const [bookingPrefill, setBookingPrefill] = useState<{ checkIn: string; roomTypeId: string } | null>(null);
  const [isScanOnlyMode, setIsScanOnlyMode] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jumpDateRef = useRef<HTMLInputElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [idImages, setIdImages] = useState<{ front: string | null, back: string | null, visa: string | null, additional: string[] }>({ front: null, back: null, visa: null, additional: [] });

  const isCameraActiveRef = useRef<boolean>(false);

  const [guestForm, setGuestForm] = useState<GuestDetails>({
    name: '', phoneNumber: '', email: '', idType: 'Aadhar', idNumber: '', address: '', dob: '', nationality: 'Indian', gender: 'Male', visaType: 'Tourist', purposeOfVisit: 'Tourism', arrivalPort: 'Delhi (DEL)'
  });

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, [startDate]);

  useEffect(() => {
    if (selectedBooking) {
      const liveBooking = syncEvents.find(e => e.id === selectedBooking.id && e.type === 'booking') as Booking | undefined;
      if (liveBooking && (liveBooking.timestamp !== selectedBooking.timestamp || liveBooking.extraBeds !== selectedBooking.extraBeds)) {
        setSelectedBooking(liveBooking);
      }
    }
  }, [syncEvents, selectedBooking?.id]);

  // Safety cleanup for camera streams
  useEffect(() => {
    if (!activeCheckInBooking) {
      stopCamera();
    }
    return () => stopCamera();
  }, [activeCheckInBooking]);

  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);

  const toggleExpand = (id: string) => { setExpandedTypes(prev => ({ ...prev, [id]: !prev[id] })); };

  const timelineDates = useMemo(() => {
    const dates: string[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      // Use local date part to avoid UTC shifts
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
    }
    return dates;
  }, [startDate]);

  const monthSpans = useMemo(() => {
    const spans: { name: string; count: number }[] = [];
    timelineDates.forEach(dateStr => {
      const d = new Date(dateStr);
      const name = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (spans.length === 0 || spans[spans.length - 1].name !== name) {
        spans.push({ name, count: 1 });
      } else {
        spans[spans.length - 1].count++;
      }
    });
    return spans;
  }, [timelineDates]);

  const gridRows = useMemo(() => {
    const rows: { type: 'header' | 'room', id: string, name: string, parentId?: string, capacity?: number, category?: RoomType }[] = [];
    roomTypes.forEach(rt => {
      rows.push({ type: 'header', id: rt.id, name: rt.name, capacity: rt.totalCapacity, category: rt });
      if (expandedTypes[rt.id]) {
        const rooms = rt.roomNumbers || Array.from({ length: rt.totalCapacity }, (_, i) => `${rt.name.substring(0, 2).toUpperCase()}-${101 + i}`);
        rooms.forEach(roomNum => {
          rows.push({ type: 'room', id: roomNum, name: roomNum, parentId: rt.id });
        });
      }
    });
    return rows;
  }, [roomTypes, expandedTypes]);

  const assignedBookings = useMemo(() => {
    const bookings = syncEvents.filter(e => e.type === 'booking' && (e.status === 'Confirmed' || e.status === 'CheckedIn' || e.status === 'CheckedOut' || e.status === 'Rejected')) as Booking[];
    return bookings.map(b => {
      if (b.roomNumber) return b;
      const rt = roomTypes.find(t => t.id === b.roomTypeId);
      if (!rt) return b;

      const availableRooms = rt.roomNumbers && rt.roomNumbers.length > 0 ? rt.roomNumbers : [];
      if (availableRooms.length === 0) return { ...b, roomNumber: 'Unassigned' };

      const hash = b.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const roomIndex = hash % availableRooms.length;
      const assignedNum = availableRooms[roomIndex];
      return { ...b, roomNumber: assignedNum };
    });
  }, [syncEvents, roomTypes]);

  // Get all bookings related to the selected booking by reservationId
  const relatedBookings = useMemo(() => {
    if (!selectedBooking) return [];
    const resId = (selectedBooking as any).reservationId;
    if (!resId) return [selectedBooking];
    return assignedBookings.filter(b => (b as any).reservationId === resId);
  }, [selectedBooking, assignedBookings]);

  const todayStr = new Date().toISOString().split('T')[0];

  // Group arrivals by reservationId to show one entry per multi-room booking
  const todaysArrivals = useMemo(() => {
    const arrivals = assignedBookings.filter(b => b.checkIn === todayStr && b.status === 'Confirmed');
    const grouped: Record<string, Booking[]> = {};
    arrivals.forEach(b => {
      const key = (b as any).reservationId || b.id;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(b);
    });
    return Object.values(grouped).map(group => ({
      ...group[0],
      _roomCount: group.length,
      _allRooms: group
    })).sort((a, b) => a.guestName.localeCompare(b.guestName));
  }, [assignedBookings, todayStr]);

  const todaysDepartures = useMemo(() => assignedBookings.filter(b => b.checkOut === todayStr && b.status === 'CheckedIn').sort((a, b) => a.guestName.localeCompare(b.guestName)), [assignedBookings, todayStr]);

  const handleDragStart = (event: any) => {
    const booking = assignedBookings.find(b => b.id === event.active.id);
    setDragState({ activeId: event.active.id, isValid: true, targetRoom: null, targetDate: null, versionSnapshot: booking ? booking.timestamp : null });
  };

  const handleDragOver = (event: any) => {
    const { active, over } = event;
    if (!over) return;
    const [roomNumber, dateStr] = over.id.split('::');
    const activeBooking = assignedBookings.find(b => b.id === active.id);
    if (activeBooking && roomNumber && dateStr) {
      const checkIn = new Date(dateStr);
      const duration = Math.ceil((new Date(activeBooking.checkOut).getTime() - new Date(activeBooking.checkIn).getTime()) / (1000 * 3600 * 24));
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + duration);
      const hasConflict = assignedBookings.some(b => {
        if (b.id === active.id) return false;
        if (b.roomNumber !== roomNumber) return false;
        const bStart = new Date(b.checkIn);
        const bEnd = new Date(b.checkOut);
        return checkIn < bEnd && checkOut > bStart;
      });
      setDragState(prev => ({ ...prev, isValid: !hasConflict, targetRoom: roomNumber, targetDate: dateStr }));
    }
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    const snapshot = dragState.versionSnapshot;
    setDragState({ activeId: null, isValid: true, targetRoom: null, targetDate: null, versionSnapshot: null });
    if (!over) return;
    const [newRoomNumber, newDateStr] = over.id.split('::');
    const currentBooking = syncEvents.find(e => e.id === active.id && e.type === 'booking') as Booking | undefined;
    if (!currentBooking) { setToastMessage("Error: Booking no longer exists."); setTimeout(() => setToastMessage(null), 3000); return; }
    if (currentBooking.timestamp !== snapshot) { setToastMessage("Optimistic Lock Error: This booking was modified by another user. Please refresh."); setTimeout(() => setToastMessage(null), 3000); return; }
    if (dragState.isValid) {
      const duration = Math.ceil((new Date(currentBooking.checkOut).getTime() - new Date(currentBooking.checkIn).getTime()) / (1000 * 3600 * 24));
      const newCheckIn = new Date(newDateStr);
      const newCheckOut = new Date(newCheckIn);
      newCheckOut.setDate(newCheckIn.getDate() + duration);
      const targetRow = gridRows.find(r => r.id === newRoomNumber && r.type === 'room');
      const newRoomTypeId = targetRow?.parentId || currentBooking.roomTypeId;

      const updatedBooking = { ...currentBooking, roomNumber: newRoomNumber, roomTypeId: newRoomTypeId, checkIn: newDateStr, checkOut: newCheckOut.toISOString().split('T')[0], timestamp: Date.now() };

      setLastMovedBookingId(active.id);
      setTimeout(() => setLastMovedBookingId(null), 1500);

      // Update local state and then persist
      setSyncEvents(prev => prev.map(e => e.id === active.id && e.type === 'booking' ? { ...updatedBooking, type: 'booking' } as SyncEvent : e));

      updateBooking(updatedBooking).catch(err => {
        console.error("Failed to persist drag update", err);
        setToastMessage(`Persistence Error: ${err.message}`);
        setTimeout(() => setToastMessage(null), 3000);
      });
    }
  };

  const handleResizeBooking = async (bookingId: string, newDuration: number) => {
    const booking = syncEvents.find(e => e.id === bookingId && e.type === 'booking') as Booking | undefined;
    if (!booking) return;

    const checkInDate = new Date(booking.checkIn);
    const newCheckOut = new Date(checkInDate);
    newCheckOut.setDate(checkInDate.getDate() + newDuration);
    const updated = { ...booking, checkOut: newCheckOut.toISOString().split('T')[0], timestamp: Date.now() };

    setSyncEvents(prev => prev.map(e => e.id === bookingId && e.type === 'booking' ? { ...updated, type: 'booking' } as SyncEvent : e));

    try {
      await updateBooking(updated);
    } catch (err: any) {
      console.error("Failed to persist resize update", err);
      setToastMessage(`Persistence Error: ${err.message}`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleBookingClick = (booking: Booking) => setSelectedBooking(booking);

  const handleUpdateStatusFromProfile = async (bookingId: string, newStatus: string) => {
    const booking = syncEvents.find(e => e.id === bookingId && e.type === 'booking') as Booking | undefined;
    if (!booking) return;

    const updated = { ...booking, status: newStatus as any, timestamp: Date.now() };

    // Optimistically update local state
    setSyncEvents(prev => prev.map(e => e.id === bookingId && e.type === 'booking' ? { ...updated, type: 'booking' } as SyncEvent : e));
    if (selectedBooking?.id === bookingId) setSelectedBooking(updated);

    try {
      await updateBooking(updated);
    } catch (err: any) {
      console.error("Failed to persist status update", err);
      setToastMessage(`Persistence Error: ${err.message}`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleToggleVIPFromProfile = async (bookingId: string) => {
    const booking = syncEvents.find(e => e.id === bookingId && e.type === 'booking') as Booking | undefined;
    if (!booking) return;

    const updated = { ...booking, isVIP: !booking.isVIP, timestamp: Date.now() };

    setSyncEvents(prev => prev.map(e => e.id === bookingId && e.type === 'booking' ? { ...updated, type: 'booking' } as SyncEvent : e));
    if (selectedBooking?.id === bookingId) setSelectedBooking(updated);

    try {
      await updateBooking(updated);
    } catch (err: any) {
      console.error("Failed to persist VIP toggle", err);
      // We could revert local state here if needed
    }
  };

  const handleToggleSettledFromProfile = async (bookingId: string) => {
    const booking = syncEvents.find(e => e.id === bookingId && e.type === 'booking') as Booking | undefined;
    if (!booking) return;

    const updated = { ...booking, isSettled: !booking.isSettled, timestamp: Date.now() };

    setSyncEvents(prev => prev.map(e => e.id === bookingId && e.type === 'booking' ? { ...updated, type: 'booking' } as SyncEvent : e));
    if (selectedBooking?.id === bookingId) setSelectedBooking(updated);

    try {
      await updateBooking(updated);
      setToastMessage(updated.isSettled ? "Folio marked as Settled" : "Folio marked as Unsettled");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      console.error("Failed to persist settlement update", err);
      setToastMessage(`Persistence Error: ${err.message}`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleUpdateFolioFromProfile = async (bookingId: string, updatedFolio: FolioItem[]) => {
    const booking = syncEvents.find(e => e.id === bookingId && e.type === 'booking') as Booking | undefined;
    if (!booking) return;

    const updated = { ...booking, folio: updatedFolio, timestamp: Date.now() };

    setSyncEvents(prev => prev.map(e => e.id === bookingId && e.type === 'booking' ? { ...updated, type: 'booking' } as SyncEvent : e));
    if (selectedBooking?.id === bookingId) setSelectedBooking(updated);

    try {
      await updateBooking(updated);
      setToastMessage("Folio updated successfully");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      console.error("Failed to update folio", err);
      setToastMessage(`Persistence Error: ${err.message}`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleUpdateSpecialRequestsFromProfile = async (bookingId: string, requests: string) => {
    const booking = syncEvents.find(e => e.id === bookingId && e.type === 'booking') as Booking | undefined;
    if (!booking) return;

    const updated = { ...booking, specialRequests: requests, timestamp: Date.now() };

    setSyncEvents(prev => prev.map(e => e.id === bookingId && e.type === 'booking' ? { ...updated, type: 'booking' } as SyncEvent : e));
    if (selectedBooking?.id === bookingId) setSelectedBooking(updated);

    try {
      await updateBooking(updated);
      setToastMessage("Guest requests updated");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      console.error("Failed to update special requests", err);
      setToastMessage(`Persistence Error: ${err.message}`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleUpdatePaymentsFromProfile = async (bookingId: string, payments: Payment[]) => {
    const booking = syncEvents.find(e => e.id === bookingId && e.type === 'booking') as Booking | undefined;
    if (!booking) return;

    const updated = { ...booking, payments, timestamp: Date.now() };

    setSyncEvents(prev => prev.map(e => e.id === bookingId && e.type === 'booking' ? { ...updated, type: 'booking' } as SyncEvent : e));
    if (selectedBooking?.id === bookingId) setSelectedBooking(updated);

    try {
      await updateBooking(updated);
      setToastMessage("Payment recorded successfully");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      console.error("Failed to update payments", err);
      setToastMessage(`Persistence Error: ${err.message}`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleOpenCheckInWizard = async (booking: Booking, isAccessory: boolean = false, index: number | null = null) => {
    setIsAddingAccessory(isAccessory);
    setEditingAccessoryIndex(index);
    setCheckInMode('scan');
    setOcrStep('idle');
    setIdImages({ front: null, back: null, visa: null, additional: [] });
    setIsCameraActive(false);

    const getGuestData = (source: GuestDetails | undefined): GuestDetails => ({
      name: source?.name || '',
      phoneNumber: source?.phoneNumber || '',
      email: source?.email || '',
      idType: source?.idType || 'Aadhar',
      idNumber: source?.idNumber || '',
      address: source?.address || '',
      dob: source?.dob || '',
      gender: source?.gender || 'Male',
      nationality: source?.nationality || 'Indian',
      passportNumber: source?.passportNumber || '',
      passportPlaceIssue: source?.passportPlaceIssue || '',
      passportIssueDate: source?.passportIssueDate || '',
      passportExpiry: source?.passportExpiry || '',
      visaNumber: source?.visaNumber || '',
      visaType: source?.visaType || 'Tourist',
      visaPlaceIssue: source?.visaPlaceIssue || '',
      visaIssueDate: source?.visaIssueDate || '',
      visaExpiry: source?.visaExpiry || '',
      arrivedFrom: source?.arrivedFrom || '',
      arrivalDateIndia: source?.arrivalDateIndia || '',
      arrivalPort: source?.arrivalPort || 'Delhi (DEL)',
      nextDestination: source?.nextDestination || '',
      purposeOfVisit: source?.purposeOfVisit || 'Tourism',
    });

    setIsRepeatGuest(false);
    setIsIdMasked(false);

    let initialForm: GuestDetails;
    if (isAccessory) {
      if (index !== null && booking.accessoryGuests && booking.accessoryGuests[index]) {
        initialForm = getGuestData(booking.accessoryGuests[index]);
      } else {
        initialForm = getGuestData(undefined);
      }
    } else {
      initialForm = { ...getGuestData(booking.guestDetails), name: booking.guestDetails?.name || booking.guestName };
    }

    // Lookup repeat guest
    if (initialForm.name && initialForm.phoneNumber) {
      try {
        const repeatData = await lookupGuest(initialForm.name, initialForm.phoneNumber);
        // API now returns an array - use first matching guest
        if (Array.isArray(repeatData) && repeatData.length > 0) {
          const firstMatch = repeatData[0];
          setIsRepeatGuest(true);
          setIsIdMasked(true);
          setToastMessage("Repeat Guest Detected! Data auto-filled.");
          setTimeout(() => setToastMessage(null), 3000);
          initialForm = {
            ...initialForm,
            idType: firstMatch.idType || initialForm.idType,
            idNumber: firstMatch.idNumber || initialForm.idNumber,
            address: firstMatch.address || initialForm.address,
            dob: firstMatch.dob || initialForm.dob,
            nationality: firstMatch.nationality || initialForm.nationality,
            gender: firstMatch.gender || initialForm.gender,
            email: firstMatch.email || initialForm.email,
            passportNumber: firstMatch.passportNumber,
            passportPlaceIssue: firstMatch.passportPlaceIssue,
            passportIssueDate: firstMatch.passportIssueDate,
            passportExpiry: firstMatch.passportExpiry,
            visaNumber: firstMatch.visaNumber,
            visaType: firstMatch.visaType,
            visaPlaceIssue: firstMatch.visaPlaceIssue,
            visaIssueDate: firstMatch.visaIssueDate,
            visaExpiry: firstMatch.visaExpiry,
            arrivedFrom: firstMatch.arrivedFrom,
            arrivalDateIndia: firstMatch.arrivalDateIndia,
            arrivalPort: firstMatch.arrivalPort,
            nextDestination: firstMatch.nextDestination,
            purposeOfVisit: firstMatch.purposeOfVisit,
            idImage: firstMatch.idImage,
            idImageBack: firstMatch.idImageBack,
            visaPage: firstMatch.visaPage,
            serialNumber: firstMatch.serialNumber,
            fatherOrHusbandName: firstMatch.fatherOrHusbandName || firstMatch.fatherName, // Handle variation if any
            city: firstMatch.city,
            state: firstMatch.state,
            pinCode: firstMatch.pinCode,
            country: firstMatch.country,
            arrivalTime: firstMatch.arrivalTime,
            departureTime: firstMatch.departureTime,
            signature: firstMatch.signature
          };
        }
      } catch (err) {
        console.error("Guest lookup failed", err);
      }
    }

    setGuestForm(initialForm);
    setActiveCheckInBooking(booking); // Open modal after data is ready
    setSelectedBooking(null);
  };

  // Opens only the scanning module (camera) without the full check-in form
  const handleScanIdOnly = (booking: Booking) => {
    setSelectedBooking(null);
    const existing = (booking.guestDetails || {}) as any;
    setGuestForm({
      name: booking.guestName,
      phoneNumber: existing.phoneNumber || '',
      email: existing.email || '',
      idType: existing.idType || 'Aadhar',
      idNumber: existing.idNumber || '',
      address: existing.address || '',
      dob: existing.dob || '',
      nationality: existing.nationality || 'Indian',
      gender: existing.gender || 'Male',
      visaType: existing.visaType || 'Tourist',
      purposeOfVisit: existing.purposeOfVisit || 'Tourism',
      arrivalPort: existing.arrivalPort || 'Delhi (DEL)'
    });
    setCheckInMode('scan');
    setOcrStep('idle');
    setIdImages({ front: null, back: null, visa: null, additional: [] });
    setActiveCheckInBooking(booking);
    setIsScanOnlyMode(true);
    // Start camera immediately
    setTimeout(() => startCamera(), 100);
  };
  // Print blank registration form for Hotel Satsangi
  const printBlankRegistrationForm = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Guest Registration Form - Hotel Satsangi</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 30px; color: #1e293b; line-height: 1.4; font-size: 11px; }
            .header { text-align: center; border-bottom: 3px double #000; padding-bottom: 15px; margin-bottom: 20px; }
            .hotel-name { font-size: 28px; font-weight: 800; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 3px; }
            .title { font-size: 16px; font-weight: 700; text-transform: uppercase; margin-top: 8px; letter-spacing: 1px; border: 2px solid #000; display: inline-block; padding: 5px 20px; }
            .section { margin-bottom: 18px; padding: 12px; border: 1px solid #ccc; background: #fafafa; }
            .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; padding-bottom: 5px; border-bottom: 1px solid #999; }
            .grid { display: grid; gap: 10px; }
            .grid-2 { grid-template-columns: repeat(2, 1fr); }
            .grid-3 { grid-template-columns: repeat(3, 1fr); }
            .grid-4 { grid-template-columns: repeat(4, 1fr); }
            .field { display: flex; flex-direction: column; }
            .label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #555; margin-bottom: 3px; }
            .input { border: none; border-bottom: 1px solid #333; padding: 4px 2px; min-height: 22px; background: transparent; }
            .input-tall { min-height: 50px; border: 1px solid #333; }
            .checkbox-group { display: flex; flex-wrap: wrap; gap: 12px; padding: 5px 0; }
            .checkbox-item { display: flex; align-items: center; gap: 4px; }
            .checkbox { width: 12px; height: 12px; border: 1px solid #333; display: inline-block; }
            .full-width { grid-column: 1 / -1; }
            .half-width { grid-column: span 2; }
            .signature-section { margin-top: 30px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 50px; }
            .sig-box { text-align: center; }
            .sig-line { border-top: 1px solid #333; padding-top: 8px; margin-top: 60px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
            .room-box { position: absolute; top: 25px; right: 30px; border: 2px solid #000; padding: 8px 15px; text-align: center; }
            .room-label { font-size: 9px; font-weight: 700; text-transform: uppercase; }
            .room-number { font-size: 24px; font-weight: 800; min-width: 60px; border-bottom: 2px solid #000; }
            .date-box { position: absolute; top: 25px; left: 30px; font-size: 10px; }
            .footer-note { margin-top: 20px; font-size: 9px; color: #666; text-align: center; font-style: italic; border-top: 1px solid #ccc; padding-top: 10px; }
            @media print { 
              body { padding: 15px; }
              .section { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="date-box">Date: ____/____/________</div>
          <div class="room-box">
            <div class="room-label">Room No.</div>
            <div class="room-number">&nbsp;</div>
          </div>
          
          <div class="header">
            <div class="hotel-name">Hotel Satsangi</div>
            <div class="title">Guest Registration Form</div>
          </div>

          <div class="section">
            <div class="section-title">Personal Information</div>
            <div class="grid grid-2">
              <div class="field full-width">
                <span class="label">Full Name (as per ID)</span>
                <div class="input"></div>
              </div>
              <div class="field">
                <span class="label">Father's / Spouse's Name</span>
                <div class="input"></div>
              </div>
              <div class="field">
                <span class="label">Date of Birth</span>
                <div class="input"></div>
              </div>
              <div class="field">
                <span class="label">Gender</span>
                <div class="checkbox-group">
                  <span class="checkbox-item"><span class="checkbox"></span> Male</span>
                  <span class="checkbox-item"><span class="checkbox"></span> Female</span>
                  <span class="checkbox-item"><span class="checkbox"></span> Other</span>
                </div>
              </div>
              <div class="field">
                <span class="label">Nationality</span>
                <div class="input"></div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Identity Verification</div>
            <div class="grid grid-3">
              <div class="field">
                <span class="label">ID Type</span>
                <div class="checkbox-group">
                  <span class="checkbox-item"><span class="checkbox"></span> Aadhar</span>
                  <span class="checkbox-item"><span class="checkbox"></span> Passport</span>
                  <span class="checkbox-item"><span class="checkbox"></span> Driving License</span>
                  <span class="checkbox-item"><span class="checkbox"></span> Voter ID</span>
                  <span class="checkbox-item"><span class="checkbox"></span> Other</span>
                </div>
              </div>
              <div class="field half-width">
                <span class="label">ID Number</span>
                <div class="input"></div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Permanent Address</div>
            <div class="grid grid-4">
              <div class="field full-width">
                <span class="label">Address</span>
                <div class="input input-tall"></div>
              </div>
              <div class="field">
                <span class="label">City</span>
                <div class="input"></div>
              </div>
              <div class="field">
                <span class="label">State</span>
                <div class="input"></div>
              </div>
              <div class="field">
                <span class="label">Pin Code</span>
                <div class="input"></div>
              </div>
              <div class="field">
                <span class="label">Country</span>
                <div class="input"></div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Contact Information</div>
            <div class="grid grid-2">
              <div class="field">
                <span class="label">Mobile Number</span>
                <div class="input"></div>
              </div>
              <div class="field">
                <span class="label">Email Address</span>
                <div class="input"></div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Stay Details</div>
            <div class="grid grid-4">
              <div class="field">
                <span class="label">Check-In Date</span>
                <div class="input"></div>
              </div>
              <div class="field">
                <span class="label">Check-In Time</span>
                <div class="input"></div>
              </div>
              <div class="field">
                <span class="label">Expected Departure Date</span>
                <div class="input"></div>
              </div>
              <div class="field">
                <span class="label">No. of Guests</span>
                <div class="input"></div>
              </div>
              <div class="field">
                <span class="label">Arrived From (City)</span>
                <div class="input"></div>
              </div>
              <div class="field">
                <span class="label">Next Destination</span>
                <div class="input"></div>
              </div>
              <div class="field half-width">
                <span class="label">Purpose of Visit</span>
                <div class="checkbox-group">
                  <span class="checkbox-item"><span class="checkbox"></span> Tourism</span>
                  <span class="checkbox-item"><span class="checkbox"></span> Business</span>
                  <span class="checkbox-item"><span class="checkbox"></span> Personal</span>
                  <span class="checkbox-item"><span class="checkbox"></span> Medical</span>
                  <span class="checkbox-item"><span class="checkbox"></span> Transit</span>
                  <span class="checkbox-item"><span class="checkbox"></span> Other</span>
                </div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">For Foreign Nationals Only (Form C)</div>
            <div class="grid grid-4">
              <div class="field">
                <span class="label">Passport Number</span>
                <div class="input"></div>
              </div>
              <div class="field">
                <span class="label">Place of Issue</span>
                <div class="input"></div>
              </div>
              <div class="field">
                <span class="label">Date of Issue</span>
                <div class="input"></div>
              </div>
              <div class="field">
                <span class="label">Date of Expiry</span>
                <div class="input"></div>
              </div>
              <div class="field">
                <span class="label">Visa Number</span>
                <div class="input"></div>
              </div>
              <div class="field">
                <span class="label">Visa Type</span>
                <div class="input"></div>
              </div>
              <div class="field">
                <span class="label">Visa Expiry</span>
                <div class="input"></div>
              </div>
              <div class="field">
                <span class="label">Date of Arrival in India</span>
                <div class="input"></div>
              </div>
              <div class="field half-width">
                <span class="label">Port of Entry (Airport/Seaport)</span>
                <div class="input"></div>
              </div>
            </div>
          </div>

          <div class="signature-section">
            <div class="sig-box">
              <div class="sig-line">Guest Signature</div>
            </div>
            <div class="sig-box">
              <div class="sig-line">Front Desk Officer</div>
            </div>
          </div>

          <div class="footer-note">
            I hereby declare that the information provided above is true to the best of my knowledge. I agree to abide by the hotel's rules and regulations during my stay.
          </div>

          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handlePrintRegistration = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !activeCheckInBooking) return;

    const data = {
      name: guestForm.name || '________________',
      id: activeCheckInBooking.id,
      roomNumber: activeCheckInBooking.roomNumber || 'Unassigned',
      nationality: guestForm.nationality || '________________',
      checkIn: activeCheckInBooking.checkIn,
      checkOut: guestForm.departureTime || activeCheckInBooking.checkOut,
      phone: guestForm.phoneNumber || '________________',
      email: guestForm.email || '________________',
      address: guestForm.address || '________________________________________________',
      idType: guestForm.idType || '________________',
      idNumber: guestForm.idNumber ? `XXXX-XXXX-${guestForm.idNumber.slice(-4)}` : '________________',
      purpose: guestForm.purposeOfVisit || '________________',
      from: guestForm.arrivedFrom || '________________'
    };

    const html = `
      <html>
        <head>
          <title>Guest Registration Card - ${data.name}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; line-height: 1.4; }
            .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
            .hotel-name { font-size: 26px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #0f172a; margin-bottom: 4px; }
            .hotel-address { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 15px; }
            .title { font-size: 12px; color: #6366f1; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; border: 1px solid #e2e8f0; display: inline-block; padding: 4px 12px; rounded: 4px; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
            .field { border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
            .label { font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
            .value { font-size: 13px; font-weight: 700; color: #1e293b; margin-top: 2px; }
            .full-width { grid-column: span 2; }
            .section-title { font-size: 11px; font-weight: 900; text-transform: uppercase; color: #0f172a; margin: 40px 0 15px 0; border-left: 4px solid #6366f1; padding-left: 10px; letter-spacing: 1px; }
            .signature-box { margin-top: 80px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 60px; }
            .sig-line { border-top: 1.5px solid #0f172a; padding-top: 10px; text-align: center; font-size: 10px; font-weight: 900; text-transform: uppercase; color: #0f172a; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="hotel-name">${propertySettings?.name || 'Hotel Management System'}</div>
            <div class="hotel-address">${propertySettings?.address || 'Property Address Not Registered'}</div>
            <div class="title">Guest Registration Card (GRC)</div>
          </div>

          <div class="grid">
            <div class="field">
              <div class="label">Guest Name</div>
              <div class="value">${data.name}</div>
            </div>
            <div class="field">
              <div class="label">Booking Reference / ID</div>
              <div class="value">${data.id}</div>
            </div>
            <div class="field">
              <div class="label">Room Number</div>
              <div class="value">#${data.roomNumber}</div>
            </div>
            <div class="field">
              <div class="label">Nationality</div>
              <div class="value">${data.nationality}</div>
            </div>
            <div class="field">
              <div class="label">Date of Arrival</div>
              <div class="value">${data.checkIn}</div>
            </div>
            <div class="field">
              <div class="label">Exp. Date of Departure</div>
              <div class="value">${data.checkOut}</div>
            </div>
            <div class="field">
              <div class="label">Mobile Number</div>
              <div class="value">${data.phone}</div>
            </div>
            <div class="field">
              <div class="label">Email Address</div>
              <div class="value">${data.email}</div>
            </div>
            <div class="field full-width">
              <div class="label">Permanent Residential Address</div>
              <div class="value">${data.address}</div>
            </div>
          </div>

          <div class="section-title">Compliance & Verification</div>
          <div class="grid">
            <div class="field">
              <div class="label">Identity Document</div>
              <div class="value">${data.idType}</div>
            </div>
            <div class="field">
              <div class="label">ID Number (Masked)</div>
              <div class="value">${data.idNumber}</div>
            </div>
            <div class="field">
              <div class="label">Purpose of Visit</div>
              <div class="value">${data.purpose}</div>
            </div>
            <div class="field">
              <div class="label">Arrived From</div>
              <div class="value">${data.from}</div>
            </div>
          </div>

          <div class="signature-box" style="margin-top: 120px;">
            <div class="sig-line">Guest Signature</div>
            <div class="sig-line">Receptionist / Duty Manager</div>
          </div>

          <div style="margin-top: 50px; font-size: 8px; color: #94a3b8; text-align: center; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
            Computer Generated Registration Card • No Signature Required for Record Purposes
          </div>

          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const closeCheckInAndShowProfile = () => {
    stopCamera();
    if (activeCheckInBooking) setSelectedBooking(activeCheckInBooking);
    setActiveCheckInBooking(null);
    setEditingAccessoryIndex(null);
    setIsScanOnlyMode(false);
  };

  const startCamera = async (targetStep: string = 'scan_front') => {
    try {
      setIsCameraActive(true);
      isCameraActiveRef.current = true;
      setOcrStep(targetStep as any);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setToastMessage("Camera not accessible. Using manual mode.");
      setCheckInMode('manual');
      isCameraActiveRef.current = false;
    }
  };


  const updateEventChannelStatus = (eventId: string, channel: string, status: ChannelStatus) => {
    setSyncEvents(prev => prev.map(e => {
      if (e.id === eventId) {
        return { ...e, channelSync: { ...(e.channelSync || {}), [channel]: status } };
      }
      return e;
    }));
  };

  const simulateFanOut = async (eventId: string, label: string) => {
    const activeChannels = connections.filter(c => c.status === 'connected');
    activeChannels.forEach(async (channel) => {
      // Check for STOP SELL Master Switch
      if (channel.isStopped) {
        updateEventChannelStatus(eventId, channel.name, 'stopped');
        return;
      }

      updateEventChannelStatus(eventId, channel.name, 'pending');
      const latency = 1000 + Math.random() * 2000;
      await new Promise(resolve => setTimeout(resolve, latency));

      if (Math.random() < 0.1) {
        updateEventChannelStatus(eventId, channel.name, 'error');
      } else {
        updateEventChannelStatus(eventId, channel.name, 'success');
      }
    });
  };

  const handleCreateBookings = async (data: {
    guestName: string,
    phoneNumber?: string,
    email?: string,
    guestDetails?: Partial<GuestDetails>,
    rooms: Array<{ roomTypeId: string, checkIn: string, checkOut: string }>
  }) => {
    const reservationId = `res-${Date.now()}`;
    // Track rooms already assigned in THIS booking session to avoid duplicates
    const assignedInThisSession: string[] = [];

    const newBookings: Booking[] = data.rooms.map((room, idx) => {
      const roomType = roomTypes.find(rt => rt.id === room.roomTypeId);
      let assignedRoom = 'Unassigned';
      if (roomType && roomType.roomNumbers) {
        for (const roomNum of roomType.roomNumbers) {
          // Check if room is already assigned in this session
          if (assignedInThisSession.includes(roomNum)) {
            continue;
          }
          // Check if room is occupied by existing bookings
          const isOccupied = syncEvents.some(e =>
            e.type === 'booking' &&
            e.roomNumber === roomNum &&
            e.status !== 'Cancelled' &&
            e.status !== 'Rejected' &&
            e.status !== 'CheckedOut' &&
            !(new Date(room.checkOut) <= new Date(e.checkIn) || new Date(room.checkIn) >= new Date(e.checkOut))
          );
          if (!isOccupied) {
            assignedRoom = roomNum;
            assignedInThisSession.push(roomNum); // Mark as taken for this session
            break;
          }
        }
      }
      return {
        id: `direct-${Date.now()}-${idx}`,
        guestName: data.guestName,
        roomTypeId: room.roomTypeId,
        roomNumber: assignedRoom,
        checkIn: room.checkIn,
        checkOut: room.checkOut,
        status: 'Confirmed',
        source: 'Direct',
        timestamp: Date.now(),
        numberOfRooms: data.rooms.length,
        reservationId,
        channelSync: {},
        guestDetails: {
          name: data.guestName,
          phoneNumber: data.phoneNumber || '',
          email: data.email || '',
          ...(data.guestDetails || {})
        }
      } as Booking;
    });

    try {
      const savedBookings = await createBulkBookings(newBookings);
      setSyncEvents(prev => [...prev, ...savedBookings.map(b => ({ ...b, type: 'booking' } as SyncEvent))]);
      setIsNewBookingModalOpen(false);
      setToastMessage(`Successfully booked ${savedBookings.length} rooms!`);
      setTimeout(() => setToastMessage(null), 3000);

      // Trigger Fan-Out for each booking in the multi-room set
      savedBookings.forEach(booking => {
        simulateFanOut(booking.id, `New Direct Booking for ${booking.guestName}`);
      });
    } catch (error: any) {
      console.error("Failed to create bookings", error);
      // Try to parse the error detail from the response
      let errorMsg = "Could not save bookings. Please try again.";
      if (error.message) {
        errorMsg = error.message;
      }
      setToastMessage(`Error: ${errorMsg}`);
      setTimeout(() => setToastMessage(null), 5000);

      // Refresh bookings to get latest state
      try {
        const latestBookings = await fetchBookings();
        setSyncEvents(prev => {
          const nonBookings = prev.filter(e => e.type !== 'booking');
          return [...nonBookings, ...latestBookings.map(b => ({ ...b, type: 'booking' } as SyncEvent))];
        });
      } catch (refreshErr) {
        console.error("Failed to refresh bookings", refreshErr);
      }
    }
  };

  const stopCamera = () => {
    isCameraActiveRef.current = false;

    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imgData = canvas.toDataURL('image/jpeg');
        if (ocrStep === 'scan_front') { setIdImages(prev => ({ ...prev, front: imgData })); setOcrStep('scan_back'); }
        else if (ocrStep === 'scan_back') { setIdImages(prev => ({ ...prev, back: imgData })); if (isForeigner) setOcrStep('scan_visa'); else { setOcrStep('scan_additional'); } }
        else if (ocrStep === 'scan_visa') { setIdImages(prev => ({ ...prev, visa: imgData })); setOcrStep('scan_additional'); }
        else if (ocrStep === 'scan_form') { setIdImages(prev => ({ ...prev, front: imgData })); setOcrStep('scan_additional'); }
        else if (ocrStep === 'scan_additional') { setIdImages(prev => ({ ...prev, additional: [...prev.additional, imgData] })); }
      }
    }
  };

  const finishScanning = () => {
    stopCamera();
    setOcrStep('processing');
    if (checkInMode === 'form_scan') {
      if (idImages.front) analyzeFilledForm(idImages.front.split(',')[1]);
      else setOcrStep('success');
    } else if (idImages.front && idImages.back) {
      analyzeIdImages(idImages.front.split(',')[1], idImages.back.split(',')[1], idImages.visa?.split(',')[1]);
    } else {
      setOcrStep('success');
    }
  };

  const analyzeIdImages = async (frontB64: string, backB64: string, visaB64?: string) => {
    try {
      const apiKey = propertySettings?.geminiApiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY' || apiKey === 'your_api_key_here') {
        setToastMessage("⚠️ Gemini API key not configured. Please add it in Property Setup -> Integrations.");
        setTimeout(() => setToastMessage(null), 5000);
        setOcrStep('success'); // Go to success anyway to show captured images
        setCheckInMode('manual');
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const parts: any[] = [
        { text: "Extract detailed ID details from these images. Return a JSON object with these fields: Name, ID_Number, Address, DOB (YYYY-MM-DD), Gender (Male/Female/Other), ID_Type (Aadhar/Passport/Driving License/Voter ID/PAN Card), Nationality, Passport_Number, Passport_Expiry, Passport_Place_Issue, Passport_Issue_Date, Visa_Number, Visa_Expiry, Visa_Type, Visa_Place_Issue. Only include fields you can extract from the images. Return clean JSON without markdown formatting." },
        { inlineData: { mimeType: 'image/jpeg', data: frontB64 } },
        { inlineData: { mimeType: 'image/jpeg', data: backB64 } }
      ];
      if (visaB64) parts.push({ inlineData: { mimeType: 'image/jpeg', data: visaB64 } });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ parts }],
        config: { responseMimeType: 'application/json' }
      });

      if (response.text) {
        // Clean up response text (remove markdown code blocks if present)
        let jsonText = response.text.trim();
        if (jsonText.startsWith('```json')) jsonText = jsonText.slice(7);
        if (jsonText.startsWith('```')) jsonText = jsonText.slice(3);
        if (jsonText.endsWith('```')) jsonText = jsonText.slice(0, -3);
        jsonText = jsonText.trim();

        const data = JSON.parse(jsonText);
        setGuestForm(prev => ({
          ...prev,
          name: data.Name || data.name || prev.name,
          idNumber: data.ID_Number || data.idNumber || data.id_number || prev.idNumber,
          address: data.Address || data.address || prev.address,
          dob: data.DOB || data.dob || data.Date_of_Birth || prev.dob,
          gender: data.Gender || data.gender || prev.gender,
          idType: data.ID_Type || data.idType || data.id_type || prev.idType,
          nationality: data.Nationality || data.nationality || prev.nationality,
          passportNumber: data.Passport_Number || data.passportNumber || prev.passportNumber,
          passportExpiry: data.Passport_Expiry || data.passportExpiry || prev.passportExpiry,
          passportPlaceIssue: data.Passport_Place_Issue || data.passportPlaceIssue || prev.passportPlaceIssue,
          passportIssueDate: data.Passport_Issue_Date || data.passportIssueDate || prev.passportIssueDate,
          visaNumber: data.Visa_Number || data.visaNumber || prev.visaNumber,
          visaExpiry: data.Visa_Expiry || data.visaExpiry || prev.visaExpiry,
          visaType: data.Visa_Type || data.visaType || prev.visaType,
        }));
        setOcrStep('success');
        setToastMessage("✅ ID data extracted successfully!");
        setTimeout(() => setToastMessage(null), 3000);
      } else {
        throw new Error("No response from Gemini AI");
      }
    } catch (e: any) {
      console.error("OCR Error:", e);
      setToastMessage(`❌ OCR failed: ${e.message || 'Unknown error'}`);
      setTimeout(() => setToastMessage(null), 5000);
      setOcrStep('success'); // Show captured images
      setCheckInMode('manual');
    }
  };

  // Analyze a filled registration form using Gemini AI
  const analyzeFilledForm = async (formImageB64: string) => {
    try {
      const apiKey = propertySettings?.geminiApiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY' || apiKey === 'your_api_key_here') {
        setToastMessage("⚠️ Gemini API key not configured. Please add it in Property Setup -> Integrations.");
        setTimeout(() => setToastMessage(null), 5000);
        setOcrStep('success');
        setCheckInMode('manual');
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{
          parts: [
            {
              text: `You are analyzing a filled Hotel Guest Registration Form. Extract ALL handwritten and printed information visible on this form and return it as structured JSON.

Extract these fields (use null if not visible or illegible):
- name: Full guest name
- fatherOrHusbandName: Father's or spouse's name
- dob: Date of birth in YYYY-MM-DD format
- gender: Male, Female, or Other (check which box is marked)
- nationality: Nationality of guest
- idType: Type of ID (Aadhar, Passport, Driving License, Voter ID, Other - check which is marked)
- idNumber: ID document number
- address: Full address
- city: City name
- state: State/Province
- pinCode: Postal/PIN code
- country: Country
- phoneNumber: Mobile/phone number
- email: Email address
- arrivedFrom: City/place guest came from
- nextDestination: Where guest is going next  
- purposeOfVisit: Tourism, Business, Personal, Medical, Transit, or Other (check which is marked)
- passportNumber: Passport number (if foreign national section filled)
- passportPlaceIssue: Where passport was issued
- passportIssueDate: Passport issue date (YYYY-MM-DD)
- passportExpiry: Passport expiry date (YYYY-MM-DD)
- visaNumber: Visa number
- visaType: Type of visa
- visaExpiry: Visa expiry date (YYYY-MM-DD)
- arrivalDateIndia: Date of arrival in India (YYYY-MM-DD)
- arrivalPort: Port of entry into India

Important: Read handwritten text carefully. Dates should be in YYYY-MM-DD format. Return clean JSON only.` },
            { inlineData: { mimeType: 'image/jpeg', data: formImageB64 } }
          ]
        }],
        config: { responseMimeType: 'application/json' }
      });

      if (response.text) {
        const data = JSON.parse(response.text);
        setGuestForm(prev => ({
          ...prev,
          name: data.name || prev.name,
          fatherOrHusbandName: data.fatherOrHusbandName || prev.fatherOrHusbandName,
          dob: data.dob || prev.dob,
          gender: data.gender || prev.gender,
          nationality: data.nationality || prev.nationality,
          idType: data.idType || prev.idType,
          idNumber: data.idNumber || prev.idNumber,
          address: data.address || prev.address,
          city: data.city || prev.city,
          state: data.state || prev.state,
          pinCode: data.pinCode || prev.pinCode,
          country: data.country || prev.country,
          phoneNumber: data.phoneNumber || prev.phoneNumber,
          email: data.email || prev.email,
          arrivedFrom: data.arrivedFrom || prev.arrivedFrom,
          nextDestination: data.nextDestination || prev.nextDestination,
          purposeOfVisit: data.purposeOfVisit || prev.purposeOfVisit,
          passportNumber: data.passportNumber || prev.passportNumber,
          passportPlaceIssue: data.passportPlaceIssue || prev.passportPlaceIssue,
          passportIssueDate: data.passportIssueDate || prev.passportIssueDate,
          passportExpiry: data.passportExpiry || prev.passportExpiry,
          visaNumber: data.visaNumber || prev.visaNumber,
          visaType: data.visaType || prev.visaType,
          visaExpiry: data.visaExpiry || prev.visaExpiry,
          arrivalDateIndia: data.arrivalDateIndia || prev.arrivalDateIndia,
          arrivalPort: data.arrivalPort || prev.arrivalPort,
        }));
        setOcrStep('success');
        setToastMessage('Form scanned successfully! Review the extracted data.');
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (e) {
      console.error('Form scan failed:', e);
      setToastMessage('Form scan failed. Please try again or enter manually.');
      setTimeout(() => setToastMessage(null), 4000);
      setCheckInMode('manual');
    }
  };

  // Handle form image capture/upload
  const handleFormScan = (imgData: string) => {
    setIdImages(prev => ({ ...prev, front: imgData }));
    setOcrStep('processing');
    analyzeFilledForm(imgData.split(',')[1]);
  };

  const triggerFileUpload = () => { fileInputRef.current?.click(); };
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const imgData = ev.target?.result as string;

        // Handle form scanning mode
        if (checkInMode === 'form_scan' || ocrStep === 'scan_form') {
          handleFormScan(imgData);
          return;
        }

        // Handle ID scanning mode
        if (ocrStep === 'idle' || ocrStep === 'scan_front') { setIdImages(prev => ({ ...prev, front: imgData })); setOcrStep('scan_back'); }
        else if (ocrStep === 'scan_back') { setIdImages(prev => ({ ...prev, back: imgData })); if (isForeigner) setOcrStep('scan_visa'); else { setOcrStep('scan_additional'); } }
        else if (ocrStep === 'scan_visa') { setIdImages(prev => ({ ...prev, visa: imgData })); setOcrStep('scan_additional'); }
        else if (ocrStep === 'scan_form') { setIdImages(prev => ({ ...prev, front: imgData })); setOcrStep('scan_additional'); }
        else if (ocrStep === 'scan_additional') { setIdImages(prev => ({ ...prev, additional: [...prev.additional, imgData] })); }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const saveScannedDocs = async () => {
    if (!activeCheckInBooking) return;
    const updated: Booking = { ...activeCheckInBooking, timestamp: Date.now() };

    // Validates that we have at least captured something or form is filled
    updated.guestDetails = {
      ...(activeCheckInBooking.guestDetails || {}),
      ...guestForm,
      idImage: idImages.front || activeCheckInBooking.guestDetails?.idImage,
      idImageBack: idImages.back || activeCheckInBooking.guestDetails?.idImageBack,
      visaPage: idImages.visa || activeCheckInBooking.guestDetails?.visaPage,
      additionalDocs: idImages.additional.length > 0 ? idImages.additional : activeCheckInBooking.guestDetails?.additionalDocs
    };

    // Update local state
    setSyncEvents(prev => prev.map(e => e.id === activeCheckInBooking.id && e.type === 'booking' ? { ...updated, type: 'booking' } as SyncEvent : e));

    // Close modal and return to profile
    stopCamera();
    setActiveCheckInBooking(null);
    setEditingAccessoryIndex(null);
    setIsScanOnlyMode(false);
    setSelectedBooking(updated);

    try {
      await updateBooking(updated);
      setToastMessage("Documents saved successfully!");
      setTimeout(() => setToastMessage(null), 2000);
    } catch (err: any) {
      console.error("Failed to persist documents", err);
      setToastMessage(`Error: ${err.message}`);
    }
  };

  const confirmCheckIn = async () => {
    if (!activeCheckInBooking) return;
    const updated: Booking = { ...activeCheckInBooking, timestamp: Date.now() };
    if (isAddingAccessory) {
      const currentAccessories = [...(activeCheckInBooking.accessoryGuests || [])];
      if (editingAccessoryIndex !== null) currentAccessories[editingAccessoryIndex] = { ...guestForm };
      else currentAccessories.push({ ...guestForm });
      updated.accessoryGuests = currentAccessories;
    } else {
      updated.status = 'CheckedIn';
      updated.guestName = guestForm.name || activeCheckInBooking.guestName;

      // Auto-register arrival time
      const now = new Date();
      const arrivalTimeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

      updated.guestDetails = {
        ...guestForm,
        arrivalTime: arrivalTimeStr, // Registered automatically
        idImage: idImages.front || undefined,
        idImageBack: idImages.back || undefined,
        visaPage: idImages.visa || undefined,
        additionalDocs: idImages.additional.length > 0 ? idImages.additional : undefined
      };
    }

    // Update local state
    stopCamera();
    setSyncEvents(prev => prev.map(e => e.id === activeCheckInBooking.id && e.type === 'booking' ? { ...updated, type: 'booking' } as SyncEvent : e));
    setActiveCheckInBooking(null);
    setEditingAccessoryIndex(null);
    setSelectedBooking(updated);

    try {
      await updateBooking(updated);
      setToastMessage("Check-in persisted successfully!");
      setTimeout(() => setToastMessage(null), 2000);
    } catch (err: any) {
      console.error("Failed to persist check-in", err);
      setToastMessage(`Critical Persistence Error: ${err.message}`);
    }
  };

  // Panning Event Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    if ((e.target as HTMLElement).closest('.cursor-pointer')) return;
    if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).tagName === 'INPUT') return;

    setIsPanning(true);
    setPanStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setPanScrollLeft(scrollContainerRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - panStartX) * 1.5;
    scrollContainerRef.current.scrollLeft = panScrollLeft - walk;
  };

  const handleMouseUpOrLeave = () => {
    setIsPanning(false);
  };

  useEffect(() => { return () => stopCamera(); }, []);

  const isForeigner = (guestForm.nationality || 'Indian').toLowerCase() !== 'indian';
  const getBookingForCell = (roomNumber: string, date: string) => {
    // 1. Find the booking that occupies this room on this date
    const booking = assignedBookings.find(b =>
      b.roomNumber === roomNumber &&
      b.checkIn <= date &&
      b.checkOut > date
    );
    if (!booking) return undefined;

    // 2. ONLY render the booking component in:
    //    a) The cell where it starts (checkIn === date)
    //    b) If it started BEFORE the current view, render it in the first visible cell of the timeline
    const isFirstVisibleDate = date === timelineDates[0];
    const startsBeforeVisible = booking.checkIn < timelineDates[0];

    if (booking.checkIn === date) return booking;
    if (isFirstVisibleDate && startsBeforeVisible) return booking;

    return undefined;
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} collisionDetection={pointerWithin}>
      <div className="flex h-full bg-[#f8fafc] font-inter relative overflow-hidden">
        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
          <header className="px-6 py-4 flex items-center justify-between bg-white border-b border-slate-100 z-[60] shadow-sm relative shrink-0">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200"><LayoutGrid className="w-5 h-5" /></div>
                <div><h2 className="text-lg font-black text-slate-900 leading-none">Front Desk</h2><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Grid System v3.0</p></div>
              </div>
              <div className="h-8 w-px bg-slate-100 mx-2"></div>
              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                <button onClick={() => { const d = new Date(startDate); d.setDate(d.getDate() - 7); setStartDate(d); }} className="p-2 hover:bg-white rounded-lg shadow-sm transition-all"><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
                <div className="px-4 text-center min-w-[140px]"><span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Current View</span><span className="text-sm font-bold text-slate-800 tabular-nums">{startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(new Date(startDate).setDate(startDate.getDate() + 13)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div>
                <button onClick={() => { const d = new Date(startDate); d.setDate(d.getDate() + 7); setStartDate(d); }} className="p-2 hover:bg-white rounded-lg shadow-sm transition-all"><ChevronRight className="w-4 h-4 text-slate-500" /></button>
              </div>
              <div className="h-8 w-px bg-slate-100 mx-1"></div>
              <div
                onClick={() => jumpDateRef.current?.showPicker()}
                className="flex items-center gap-3 bg-indigo-50 px-4 py-2 rounded-xl border-2 border-indigo-100 hover:border-indigo-300 transition-all cursor-pointer relative group shadow-sm active:scale-95"
              >
                <div className="p-1.5 bg-white rounded-lg shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <Calendar className="w-4 h-4 text-indigo-600 group-hover:text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400 leading-none mb-1">Calendar</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-900 leading-none">Jump to Date</span>
                </div>
                <input
                  ref={jumpDateRef}
                  type="date"
                  onChange={(e) => {
                    if (e.target.value) {
                      const selected = new Date(e.target.value);
                      selected.setHours(0, 0, 0, 0);
                      setStartDate(selected);
                    }
                  }}
                  className="absolute inset-0 opacity-0 pointer-events-none"
                />
              </div>
            </div>
            {connections.filter(c => c.isStopped).length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-600 rounded-xl animate-pulse">
                <ShieldAlert className="w-4 h-4" />
                <span className="text-[9px] font-black uppercase tracking-widest">{connections.filter(c => c.isStopped).length} Channels Stopped</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <button onClick={printBlankRegistrationForm} className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
                <FileText className="w-4 h-4" />
                Print Form
              </button>
              <button onClick={() => setIsNewBookingModalOpen(true)} className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl"><Plus className="w-4 h-4" /> New Booking</button>
            </div>

          </header>

          <div
            ref={scrollContainerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            className={`flex-1 overflow-auto custom-scrollbar bg-slate-50/50 ${isPanning ? 'cursor-grabbing select-none' : ''}`}
          >
            <div className="min-w-max pb-24">
              {/* FROZEN DATES PANE (VERTICAL STICKY) */}
              <div
                className="sticky top-0 z-[55] flex gap-3 px-6 py-4 bg-[#f8fafc]/95 backdrop-blur-sm border-b border-slate-200/50 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.1)]"
                style={{ height: STICKY_HEADER_TOTAL_HEIGHT }}
              >
                {/* Left Card - Matches Room Rows */}
                <div className="w-64 h-[72px] shrink-0 bg-white rounded-2xl shadow-xl border border-slate-300/30 px-6 flex flex-col justify-center sticky left-0 z-[56]">
                  <span className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">Grid Context</span>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-black text-slate-800 tracking-tighter">Inventory</span>
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shadow-inner">
                      <LayoutGrid className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Right Card - Date Timeline Segments */}
                <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-2xl border border-black/10 overflow-hidden relative">
                  {/* Month Heading Row */}
                  <div className="flex h-[24px] border-b border-slate-100 bg-slate-50/50 backdrop-blur-md">
                    {monthSpans.map((span, idx) => (
                      <div
                        key={idx}
                        style={{ width: span.count * CELL_WIDTH }}
                        className="flex items-center px-5 border-r border-slate-100 last:border-0 shrink-0"
                      >
                        <span className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-indigo-400" />
                          {span.name}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Date Timeline Row */}
                  <div className="flex h-[48px]">
                    {timelineDates.map(date => {
                      const d = new Date(date);
                      const isToday = new Date().toDateString() === d.toDateString();
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      return (
                        <div key={date} className={`flex flex-col items-center justify-center border-r border-slate-100 last:border-0 shrink-0 overflow-hidden ${isWeekend ? 'bg-slate-50/50' : ''}`} style={{ width: CELL_WIDTH }}>
                          <span className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${isToday ? 'text-indigo-600' : 'text-slate-400'}`}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                          <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-black transition-all tabular-nums ${isToday ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-800'}`}>{d.getDate()}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="px-6 space-y-3 pt-6">
                {isLoading ? (
                  <div className="space-y-4 animate-pulse">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="flex flex-col md:flex-row gap-3">
                        <div className="w-full md:w-64 h-[48px] bg-slate-200 rounded-xl shrink-0"></div>
                        <div className="flex-1 h-[48px] bg-slate-200 rounded-xl"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  gridRows.map((row, index) => {
                    const isHeader = row.type === 'header';
                    if (isHeader) {
                      const todayStr = new Date().toLocaleDateString('en-CA'); // More reliable YYYY-MM-DD
                      const occupiedCount = assignedBookings.filter(b => b.roomTypeId === row.id && b.status !== 'Cancelled' && b.status !== 'Rejected' && b.checkIn <= todayStr && b.checkOut > todayStr).length;
                      const gradientStyle = CATEGORY_GRADIENTS[index % CATEGORY_GRADIENTS.length];
                      return (
                        <div key={row.id} className="sticky top-[72px] z-30 flex flex-col md:flex-row gap-3 pt-3">
                          <div onClick={() => toggleExpand(row.id)} className="w-full md:w-64 shrink-0 rounded-xl shadow-xl px-4 py-2 flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] border border-white/20 backdrop-blur-lg relative overflow-hidden group sticky left-0 z-40" style={gradientStyle}>
                            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 100%)' }}></div>
                            <div className="flex items-center gap-3 relative z-10">
                              <div className="p-1.5 bg-black/30 rounded-lg text-white shadow-inner"><Bed className="w-4 h-4" /></div>
                              <div><span className="font-black text-xs text-white block tracking-tight leading-tight">{row.name}</span><span className="text-[8px] text-white/80 font-bold uppercase tracking-widest">{row.capacity} Units</span></div>
                            </div>
                            <div className="flex items-center gap-3 relative z-10">
                              <span className="text-xl font-black text-white tabular-nums tracking-tighter">{occupiedCount}</span>
                              <div className="p-1 bg-white/20 rounded-md text-white hover:bg-white/30 transition-colors shadow-sm">{expandedTypes[row.id] ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}</div>
                            </div>
                          </div>
                          <div className="hidden md:flex flex-1 bg-slate-200/40 rounded-2xl items-center px-6"><div className="h-px bg-slate-300/50 w-full"></div></div>
                        </div>
                      );
                    }

                    const securityStatus = roomSecurity.find(rs => rs.room_id === row.id);
                    const isAlerted = securityStatus && (securityStatus.failCount >= 3 || securityStatus.isLocked);

                    const categoryIndex = row.parentId ? roomTypes.findIndex(rt => rt.id === row.parentId) : -1;
                    const rowTintStyle = categoryIndex >= 0 ? ROW_TINTS[categoryIndex % ROW_TINTS.length] : { backgroundColor: '#ffffff' };
                    const labelTintStyle = categoryIndex >= 0 ? LABEL_TINTS[categoryIndex % LABEL_TINTS.length] : { backgroundColor: '#ffffff' };

                    return (
                      <div key={row.id} className="flex flex-col md:flex-row gap-3 group animate-in slide-in-from-top-2 fade-in duration-300 ease-out fill-mode-forwards">
                        <div className="w-full md:w-64 md:sticky md:left-0 z-20 shrink-0">
                          <div className={`h-[48px] w-full ${isAlerted ? 'bg-amber-100 ring-2 ring-amber-400' : ''} rounded-xl shadow-lg border ${isAlerted ? 'border-amber-500' : 'border-slate-300/30'} px-3 py-1 flex flex-col justify-center hover:shadow-indigo-500/10 transition-all group-hover:border-indigo-400/50 relative overflow-hidden`} style={isAlerted ? {} : labelTintStyle}>
                            <div className={`absolute top-0 left-0 w-1.5 h-full ${isAlerted ? 'bg-amber-600' : 'bg-indigo-600'} opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                            <div className="flex justify-between items-center">
                              <span className={`text-lg font-black ${isAlerted ? 'text-amber-900' : 'text-slate-900'} tabular-nums tracking-tighter`}>{row.name}</span>
                              <div className={`w-2 h-2 rounded-full ${isAlerted ? 'bg-amber-500 shadow-[0_0_10px_rgba(251,191,36,1)] animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`}></div>
                            </div>
                            <span className={`text-[8px] font-black ${isAlerted ? 'text-amber-700' : 'text-slate-500'} uppercase tracking-[0.2em] leading-none`}>
                              {isAlerted ? 'Alert Active' : 'Clean & Ready'}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 rounded-xl shadow-2xl border border-black/10 relative flex overflow-hidden hover:shadow-indigo-900/10 transition-all" style={rowTintStyle}>
                          {timelineDates.map(date => {
                            const booking = getBookingForCell(row.id, date);
                            const d = new Date(date);
                            return (
                              <DroppableCell
                                key={date}
                                date={date}
                                roomNumber={row.id}
                                isWeekend={d.getDay() === 0 || d.getDay() === 6}
                                isToday={new Date().toDateString() === d.toDateString()}
                                onClick={() => {
                                  if (!booking) {
                                    setBookingPrefill({ checkIn: date, roomTypeId: row.parentId || '' });
                                    setIsNewBookingModalOpen(true);
                                  }
                                }}
                              >
                                {booking && (() => {
                                  const bookingStart = new Date(booking.checkIn);
                                  const timelineStart = new Date(timelineDates[0]);
                                  const effectiveStart = bookingStart < timelineStart ? timelineStart : bookingStart;
                                  const bookingEnd = new Date(booking.checkOut);

                                  const visualDuration = Math.ceil((bookingEnd.getTime() - effectiveStart.getTime()) / (1000 * 3600 * 24));

                                  return (
                                    <DraggableBooking
                                      booking={booking}
                                      duration={visualDuration}
                                      onResize={(newDur) => handleResizeBooking(booking.id, newDur)}
                                      onSelect={handleBookingClick}
                                      isJustMoved={booking.id === lastMovedBookingId}
                                    />
                                  );
                                })()}
                              </DroppableCell>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="w-80 bg-white border-l border-slate-200 h-full overflow-y-auto hidden xl:flex flex-col shrink-0 z-30 shadow-2xl custom-scrollbar">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50"><h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2"><Zap className="w-5 h-5 text-amber-500" />Live Activity</h3><p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-widest">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p></div>
          <div className="flex-1 p-6 space-y-8">
            <div className="space-y-4 p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100/50">
              <div className="flex items-center justify-between"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Today's Arrivals</h4><span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-lg shadow-md">{todaysArrivals.length}</span></div>
              {todaysArrivals.length === 0 ? (<div className="text-center py-6 text-slate-400 text-[10px] font-black uppercase tracking-widest bg-white rounded-2xl border border-slate-100">All Checked In</div>) : (todaysArrivals.map((b: any) => (
                <div key={b.id} className="p-3.5 bg-white border border-slate-100 rounded-[2rem] shadow-sm hover:shadow-xl transition-all group border-l-4 border-l-indigo-600">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-sm shrink-0 shadow-inner border border-indigo-100">{b.guestName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}</div>
                    <div className="overflow-hidden flex-1">
                      <p className="font-black text-slate-900 text-sm truncate tracking-tighter uppercase">{b.guestName}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[8px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded uppercase tracking-widest border border-amber-100">Awaiting ID</span>
                        {b._roomCount > 1 && <span className="inline-flex items-center gap-1 text-[8px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase tracking-widest border border-indigo-100">{b._roomCount} Rooms</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                      {b._roomCount > 1 ? 'Multi-Room Booking' : (roomTypes.find(r => r.id === b.roomTypeId)?.name || 'Standard')}
                      <span className="font-black text-indigo-600 ml-1 bg-indigo-50 px-1.5 py-0.5 rounded shadow-sm">#{b.roomNumber || 'TBD'}</span>
                    </div>
                  </div>
                  <button onClick={() => setSelectedBooking(b)} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-indigo-200 flex items-center justify-center gap-3">Check-In <ArrowRightCircle className="w-4 h-4" /></button>
                </div>
              )))}
            </div>
            <div className="space-y-4 p-4 bg-rose-50/40 rounded-2xl border border-rose-100/50">
              <div className="flex items-center justify-between"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Pending Departures</h4><span className="text-[10px] font-black bg-rose-600 text-white px-2 py-0.5 rounded-lg shadow-md">{todaysDepartures.length}</span></div>
              {todaysDepartures.length === 0 ? (<div className="text-center py-6 text-slate-400 text-[10px] font-black uppercase tracking-widest bg-white rounded-2xl border border-slate-100">None Scheduled</div>) : (todaysDepartures.map(b => (
                <div key={b.id} className="p-3.5 bg-white border border-slate-100 rounded-[2rem] shadow-sm hover:shadow-xl transition-all group border-l-4 border-l-rose-600">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center font-black text-sm shrink-0 border border-slate-200">{b.guestName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}</div>
                    <div className="overflow-hidden">
                      <p className="font-black text-slate-900 text-sm truncate tracking-tighter uppercase">{b.guestName}</p>
                      {b.isSettled ? (
                        <span className="inline-flex items-center gap-1 text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase tracking-widest mt-0.5 border border-emerald-100">Paid & Clear</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[8px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded uppercase tracking-widest mt-0.5 border border-rose-100 animate-pulse">Payment Due</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Room <span className="font-black text-rose-600 ml-1 bg-rose-50 px-1.5 py-0.5 rounded shadow-sm">#{b.roomNumber}</span></div>
                  </div>
                  <button onClick={() => setSelectedBooking(b)} className="w-full py-2.5 bg-slate-900 hover:bg-black text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl flex items-center justify-center gap-3">Process Check-Out <LogOut className="w-4 h-4" /></button>
                </div>
              )))}
            </div>
          </div>
        </div>

        {selectedBooking && (
          <GuestProfilePage
            booking={selectedBooking}
            roomTypes={roomTypes}
            relatedBookings={relatedBookings}
            syncEvents={syncEvents}
            onClose={() => setSelectedBooking(null)}
            onUpdateStatus={handleUpdateStatusFromProfile}
            onToggleVIP={handleToggleVIPFromProfile}
            onCheckIn={handleOpenCheckInWizard}
            onScanId={handleScanIdOnly}
            onToggleSettled={handleToggleSettledFromProfile}
            onUpdateFolio={handleUpdateFolioFromProfile}
            onUpdateSpecialRequests={handleUpdateSpecialRequestsFromProfile}
            onUpdatePayments={handleUpdatePaymentsFromProfile}
            onUpdateExtraBeds={onUpdateExtraBeds}
            propertySettings={propertySettings}
            onEditInventory={() => { setToastMessage("Drag and drop to edit inventory."); setTimeout(() => setToastMessage(null), 3000); }}
            onRoomTransfer={async (bookingId, newRoomTypeId, newRoomNumber, effectiveDate, keepRate, transferFolio) => {
              try {
                const result = await transferBooking(bookingId, {
                  bookingId,
                  newRoomTypeId,
                  newRoomNumber,
                  effectiveDate,
                  keepRate,
                  transferFolio
                });

                // Update local state
                setSyncEvents(prev => {
                  let next = [...prev];
                  const originalIndex = next.findIndex(e => e.id === bookingId && e.type === 'booking');

                  if (originalIndex !== -1) {
                    const original = next[originalIndex] as Booking;

                    if (effectiveDate === original.checkIn) {
                      // Case A: Full Transfer
                      next[originalIndex] = { ...result, type: 'booking' } as SyncEvent;
                    } else {
                      // Case B: Mid-stay Switch
                      next[originalIndex] = { ...original, checkOut: effectiveDate, timestamp: Date.now(), type: 'booking' } as SyncEvent;
                      next.push({ ...result, type: 'booking' } as SyncEvent);
                    }
                  } else {
                    next.push({ ...result, type: 'booking' } as SyncEvent);
                  }
                  return next;
                });

                setSelectedBooking(result);
                setToastMessage(effectiveDate === result.checkIn ? `Room transferred to ${newRoomNumber}` : `Room switched to ${newRoomNumber} starting ${effectiveDate}`);
                setTimeout(() => setToastMessage(null), 3000);
              } catch (err: any) {
                console.error("Failed to persist room transfer", err);
                setToastMessage(`Error: ${err.message}`);
                setTimeout(() => setToastMessage(null), 5000);
              }
            }}
            onSwitchBooking={(booking) => setSelectedBooking(booking)}
          />
        )}

        {activeCheckInBooking && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20 flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    {isScanOnlyMode ? "Scan ID Documents" : "Guest Check-In"}
                    {isRepeatGuest && !isScanOnlyMode && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100 animate-pulse">
                        <Star className="w-3 h-3 fill-indigo-600" /> Repeat Guest
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 tabular-nums uppercase font-black">Booking #{activeCheckInBooking.id.split('-')[1]?.slice(0, 8)} • {activeCheckInBooking.guestName}</p>
                </div>
                <button onClick={closeCheckInAndShowProfile} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><XCircle className="w-6 h-6 text-slate-400" /></button>
              </div>
              {!isScanOnlyMode && (
                <div className="flex border-b border-slate-100">
                  <button onClick={() => { stopCamera(); setCheckInMode('scan'); setOcrStep('idle'); }} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${checkInMode === 'scan' ? 'bg-white text-indigo-600 border-b-4 border-indigo-600' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}><ScanLine className="w-4 h-4" /> Scan ID</button>
                  <button onClick={() => { stopCamera(); setCheckInMode('form_scan'); setOcrStep('idle'); }} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${checkInMode === 'form_scan' ? 'bg-white text-indigo-600 border-b-4 border-indigo-600' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}><FileText className="w-4 h-4" /> Scan Form</button>
                  <button onClick={() => { stopCamera(); setCheckInMode('manual'); setOcrStep('idle'); }} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${checkInMode === 'manual' ? 'bg-white text-indigo-600 border-b-4 border-indigo-600' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}><Keyboard className="w-4 h-4" /> Manual Entry</button>
                </div>
              )}
              <div className="p-8 overflow-y-auto custom-scrollbar">
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                {checkInMode === 'scan' ? (
                  <div className="flex flex-col items-center text-center space-y-6">
                    {ocrStep === 'idle' && (
                      <>
                        <div className="relative w-80 h-48 bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-800 flex items-center justify-center cursor-pointer group hover:border-slate-700 transition-colors" onClick={() => startCamera('scan_front')}><div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 group-hover:text-slate-300 transition-colors"><Camera className="w-12 h-12 mb-2" /><span className="text-xs font-black uppercase tracking-widest">Click to Start Camera</span></div></div>
                        <div className="flex items-center gap-4 w-80"><div className="h-px bg-slate-200 flex-1"></div><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">OR</span><div className="h-px bg-slate-200 flex-1"></div></div>
                        <button onClick={triggerFileUpload} className="w-80 py-4 bg-white border-2 border-slate-200 rounded-3xl flex items-center justify-center gap-3 hover:border-indigo-500 transition-all group shadow-xl"><div className="p-3 bg-slate-100 rounded-2xl group-hover:bg-indigo-50 transition-colors"><Upload className="w-6 h-6 text-slate-500 group-hover:text-indigo-600" /></div><div className="text-left"><span className="block text-xs font-black text-slate-700 uppercase tracking-widest">Digital Scanner</span><span className="block text-[10px] text-slate-400 font-bold uppercase">Upload from device</span></div></button>
                      </>
                    )}
                    {(ocrStep === 'scan_front' || ocrStep === 'scan_back' || ocrStep === 'scan_visa' || ocrStep === 'scan_additional') && (
                      <div className="relative w-80 h-60 bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-indigo-600">
                        {isCameraActive ? (
                          <>
                            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                            <canvas ref={canvasRef} className="hidden" />
                          </>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
                            <Upload className="w-12 h-12 text-slate-600 mb-2" />
                            <span className="text-xs font-bold text-slate-500 uppercase">{ocrStep === 'scan_front' ? 'Upload Front ID' : ocrStep === 'scan_back' ? 'Upload Back ID' : ocrStep === 'scan_visa' ? 'Upload Visa' : `Upload Additional Page (${idImages.additional.length + 1})`}</span>
                          </div>
                        )}
                        <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-30">
                          <span className="px-3 py-1 bg-indigo-600/90 text-white text-[9px] font-black uppercase rounded-lg backdrop-blur-md border border-white/20 tracking-[0.1em] whitespace-nowrap">
                            {ocrStep === 'scan_front' ? '📷 Front ID' : ocrStep === 'scan_back' ? '📷 Back ID' : ocrStep === 'scan_visa' ? '📷 Visa' : ocrStep === 'scan_form' ? '📷 Form Page 1' : `📷 Extra Page (${idImages.additional.length + 1})`}
                          </span>
                          {ocrStep === 'scan_additional' && (
                            <button
                              onClick={finishScanning}
                              className="px-3 py-1 bg-emerald-600 text-white text-[9px] font-black uppercase rounded-lg shadow-lg hover:bg-emerald-700 transition-all border border-emerald-400/30"
                            >
                              Done
                            </button>
                          )}
                        </div>
                        <div className="absolute bottom-3 left-0 w-full text-center">
                          <span className="text-[9px] text-white/70 font-medium">Position document in frame, then tap capture</span>
                        </div>
                        {isCameraActive ? (
                          <button onClick={captureImage} className="absolute bottom-10 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-4 border-indigo-400 flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-2xl">
                            <div className="w-12 h-12 rounded-full shadow-inner bg-red-500"></div>
                          </button>
                        ) : (
                          <div className="absolute bottom-6 left-0 w-full flex flex-col items-center gap-2">
                            <button onClick={triggerFileUpload} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all">Select File</button>
                            <button onClick={() => setOcrStep('idle')} className="text-[9px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors">Go Back</button>
                          </div>
                        )}
                      </div>
                    )}
                    {ocrStep === 'processing' && (<div className="w-80 h-48 flex flex-col items-center justify-center bg-slate-50 rounded-3xl border-2 border-dashed border-indigo-200"><Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" /><p className="text-sm font-black text-slate-800 tracking-tight uppercase">Extracting Intelligence...</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gemini AI OCR Layer Active</p></div>)}
                    {ocrStep === 'success' && (
                      <div className="w-full space-y-4">
                        <div className="flex flex-wrap gap-2 justify-center">
                          {idImages.front && <img src={idImages.front} className="w-20 h-14 rounded-lg border-2 border-slate-200 object-cover shadow-sm" />}
                          {idImages.back && <img src={idImages.back} className="w-20 h-14 rounded-lg border-2 border-slate-200 object-cover shadow-sm" />}
                          {idImages.visa && <img src={idImages.visa} className="w-20 h-14 rounded-lg border-2 border-slate-200 object-cover shadow-sm" />}
                          {idImages.additional.map((img, i) => (
                            <div key={i} className="relative group">
                              <img src={img} className="w-20 h-14 rounded-lg border-2 border-slate-200 object-cover shadow-sm" />
                              <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold">+{i + 1}</span>
                            </div>
                          ))}
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-4 text-emerald-700 shadow-sm">
                          <CheckCircle2 className="w-6 h-6" />
                          <span className="text-xs font-black uppercase tracking-[0.2em]">All Documents Captured ({2 + (idImages.visa ? 1 : 0) + idImages.additional.length} Pages)</span>
                        </div>
                        <div className="flex gap-4 justify-center">
                          <button onClick={() => { startCamera('scan_additional'); }} className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-colors"><Plus className="w-4 h-4" /> Add More Pages</button>
                          <button onClick={() => { setOcrStep('idle'); setIdImages({ front: null, back: null, visa: null, additional: [] }); setIsCameraActive(false); }} className="text-[10px] font-black text-slate-400 hover:text-slate-700 uppercase tracking-[0.2em] flex items-center justify-center gap-2"><RotateCcw className="w-4 h-4" /> Reset All</button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : checkInMode === 'form_scan' ? (
                  <div className="flex flex-col items-center text-center space-y-6">
                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl mb-4">
                      <p className="text-xs text-indigo-700 font-bold">📋 Scan a filled Guest Registration Form to auto-populate all fields</p>
                    </div>
                    {ocrStep === 'idle' && (
                      <>
                        <div className="relative w-80 h-48 bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-800 flex items-center justify-center cursor-pointer group hover:border-slate-700 transition-colors" onClick={() => startCamera('scan_form')}>
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 group-hover:text-slate-300 transition-colors">
                            <Camera className="w-12 h-12 mb-2" />
                            <span className="text-xs font-black uppercase tracking-widest">Click to Start Camera</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 w-80"><div className="h-px bg-slate-200 flex-1"></div><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">OR</span><div className="h-px bg-slate-200 flex-1"></div></div>
                        <button onClick={triggerFileUpload} className="w-80 py-4 bg-white border-2 border-slate-200 rounded-3xl flex items-center justify-center gap-3 hover:border-indigo-500 transition-all group shadow-xl">
                          <div className="p-3 bg-slate-100 rounded-2xl group-hover:bg-indigo-50 transition-colors">
                            <Upload className="w-6 h-6 text-slate-500 group-hover:text-indigo-600" />
                          </div>
                          <div className="text-left">
                            <span className="block text-xs font-black text-slate-700 uppercase tracking-widest">Digital Scanner</span>
                            <span className="block text-[10px] text-slate-400 font-bold uppercase">Upload from device</span>
                          </div>
                        </button>
                      </>
                    )}
                    {(ocrStep === 'scan_form' || ocrStep === 'scan_additional') && isCameraActive && (
                      <div className="relative w-80 h-60 bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-indigo-600">
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                        <canvas ref={canvasRef} className="hidden" />
                        <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-30">
                          <span className="px-3 py-1 bg-indigo-600/90 text-white text-[9px] font-black uppercase rounded-lg backdrop-blur-md border border-white/20 tracking-[0.1em] whitespace-nowrap">
                            {ocrStep === 'scan_form' ? '📷 Form Page 1' : `📷 Extra Page (${idImages.additional.length + 1})`}
                          </span>
                          {ocrStep === 'scan_additional' && (
                            <button
                              onClick={finishScanning}
                              className="px-3 py-1 bg-emerald-600 text-white text-[9px] font-black uppercase rounded-lg shadow-lg hover:bg-emerald-700 transition-all border border-emerald-400/30"
                            >
                              Done
                            </button>
                          )}
                        </div>
                        <div className="absolute bottom-3 left-0 w-full text-center">
                          <span className="text-[9px] text-white/70 font-medium">Position form in frame, then tap capture</span>
                        </div>
                        <button onClick={captureImage} className="absolute bottom-10 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-4 border-indigo-400 flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-2xl">
                          <div className="w-12 h-12 bg-indigo-500 rounded-full shadow-inner"></div>
                        </button>
                      </div>
                    )}
                    {ocrStep === 'processing' && (
                      <div className="w-80 h-48 flex flex-col items-center justify-center bg-indigo-50 rounded-3xl border-2 border-dashed border-indigo-200">
                        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                        <p className="text-sm font-black text-slate-800 tracking-tight uppercase">Reading Form Data...</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gemini AI Form OCR Active</p>
                      </div>
                    )}
                    {ocrStep === 'success' && (
                      <div className="w-full space-y-4">
                        <div className="flex flex-wrap gap-2 justify-center">
                          {idImages.front && <img src={idImages.front} className="w-20 h-14 rounded-lg border-2 border-slate-200 object-cover shadow-sm" />}
                          {idImages.additional.map((img, i) => (
                            <div key={i} className="relative group">
                              <img src={img} className="w-20 h-14 rounded-lg border-2 border-slate-200 object-cover shadow-sm" />
                              <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold">+{i + 1}</span>
                            </div>
                          ))}
                        </div>
                        <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-2xl flex items-center gap-4 text-indigo-700 shadow-sm">
                          <CheckCircle2 className="w-6 h-6" />
                          <span className="text-xs font-black uppercase tracking-[0.2em]">Form Data Extracted ({1 + idImages.additional.length} Pages)</span>
                        </div>
                        <p className="text-[10px] text-slate-500">Please review the auto-filled data below and make any corrections needed.</p>
                        <div className="flex gap-4 justify-center">
                          <button onClick={() => { startCamera('scan_additional'); }} className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-colors"><Plus className="w-4 h-4" /> Add More Pages</button>
                          <button onClick={() => { setOcrStep('idle'); setIdImages({ front: null, back: null, visa: null, additional: [] }); setCheckInMode('form_scan'); stopCamera(); }} className="text-[10px] font-black text-slate-400 hover:text-slate-700 uppercase tracking-[0.2em] flex items-center justify-center gap-2"><RotateCcw className="w-4 h-4" /> Reset</button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (<div className="text-center mb-6"><p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Manual Ledger Input Mode</p></div>)}
                {(checkInMode === 'manual' || (ocrStep === 'success' && !isScanOnlyMode) || (checkInMode === 'form_scan' && ocrStep === 'success')) && (
                  <div className="space-y-8 mt-4 animate-in fade-in duration-500">
                    <div className="grid grid-cols-2 md:grid-cols-2 gap-6">
                      <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Legal Full Name</label><input type="text" value={guestForm.name} onChange={e => setGuestForm({ ...guestForm, name: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-black text-slate-900 outline-none focus:border-indigo-400 shadow-inner" /></div>
                      <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Father's/Spouse's Name</label><input type="text" value={guestForm.fatherOrHusbandName || ''} onChange={e => setGuestForm({ ...guestForm, fatherOrHusbandName: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-black text-slate-900 outline-none focus:border-indigo-400 shadow-inner" /></div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                      <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Nationality</label><select value={guestForm.nationality} onChange={e => setGuestForm({ ...guestForm, nationality: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-black text-slate-900 outline-none focus:border-indigo-400 shadow-inner">{NATIONALITIES.map(n => <option key={n} value={n}>{n}</option>)}</select></div>
                      <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Gender</label><select value={guestForm.gender} onChange={e => setGuestForm({ ...guestForm, gender: e.target.value as any })} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-black text-slate-900 outline-none focus:border-indigo-400 shadow-inner"><option>Male</option><option>Female</option><option>Other</option></select></div>
                      <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Birth Date</label><input type="date" value={guestForm.dob} onChange={e => setGuestForm({ ...guestForm, dob: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-black text-slate-900 outline-none focus:border-indigo-400 shadow-inner" /></div>
                      <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">ID Protocol</label><select value={guestForm.idType} onChange={e => setGuestForm({ ...guestForm, idType: e.target.value as any })} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-black text-slate-900 outline-none focus:border-indigo-400 shadow-inner"><option>Aadhar</option><option>Passport</option><option>Driving License</option><option>Voter ID</option><option>Other</option></select></div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Credential Number</label>
                        <input
                          type="text"
                          value={isIdMasked && guestForm.idNumber ? `XXXX-XXXX-${guestForm.idNumber.slice(-4)}` : guestForm.idNumber}
                          onChange={e => {
                            setGuestForm({ ...guestForm, idNumber: e.target.value });
                            setIsIdMasked(false);
                          }}
                          onFocus={() => setIsIdMasked(false)}
                          className={`w-full px-4 py-3 bg-slate-50 border-2 rounded-2xl text-xs font-black outline-none shadow-inner transition-all ${isIdMasked ? 'border-amber-200 text-amber-600' : 'border-slate-200 text-slate-900 focus:border-indigo-400'}`}
                        />
                      </div>
                    </div>

                    <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Permanent Address (Verified)</label><textarea value={guestForm.address} onChange={e => setGuestForm({ ...guestForm, address: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-black text-slate-900 outline-none focus:border-indigo-400 min-h-[80px] shadow-inner" /></div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">City</label><input type="text" value={guestForm.city || ''} onChange={e => setGuestForm({ ...guestForm, city: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-black text-slate-900 outline-none focus:border-indigo-400 shadow-inner" /></div>
                      <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">State</label><input type="text" value={guestForm.state || ''} onChange={e => setGuestForm({ ...guestForm, state: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-black text-slate-900 outline-none focus:border-indigo-400 shadow-inner" /></div>
                      <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Pin Code</label><input type="text" value={guestForm.pinCode || ''} onChange={e => setGuestForm({ ...guestForm, pinCode: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-black text-slate-900 outline-none focus:border-indigo-400 shadow-inner" /></div>
                      <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Country</label><input type="text" value={guestForm.country || ''} onChange={e => setGuestForm({ ...guestForm, country: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-black text-slate-900 outline-none focus:border-indigo-400 shadow-inner" /></div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-2 gap-6">
                      <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Expected Departure Date</label><input type="date" value={guestForm.departureTime || ''} onChange={e => setGuestForm({ ...guestForm, departureTime: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-black text-slate-900 outline-none focus:border-indigo-400 shadow-inner" /></div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Purpose of Visit</label>
                        <select
                          value={guestForm.purposeOfVisit || 'Tourism'}
                          onChange={e => setGuestForm({ ...guestForm, purposeOfVisit: e.target.value as any })}
                          className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-black text-slate-900 outline-none focus:border-indigo-400 shadow-inner"
                        >
                          <option value="Tourism">Tourism</option>
                          <option value="Business">Business</option>
                          <option value="Transit">Transit</option>
                          <option value="Personal">Personal</option>
                          <option value="Medical">Medical</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Arrived From</label><input type="text" value={guestForm.arrivedFrom || ''} onChange={e => setGuestForm({ ...guestForm, arrivedFrom: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-black text-slate-900 outline-none focus:border-indigo-400 shadow-inner" /></div>
                      <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Next Destination</label><input type="text" value={guestForm.nextDestination || ''} onChange={e => setGuestForm({ ...guestForm, nextDestination: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-black text-slate-900 outline-none focus:border-indigo-400 shadow-inner" /></div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Verified Mobile</label><input type="text" value={guestForm.phoneNumber} onChange={e => setGuestForm({ ...guestForm, phoneNumber: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-black text-slate-900 outline-none focus:border-indigo-400 shadow-inner" /></div>
                      <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Communication Email</label><input type="email" value={guestForm.email} onChange={e => setGuestForm({ ...guestForm, email: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-black text-slate-900 outline-none focus:border-indigo-400 shadow-inner" /></div>
                    </div>

                    {isForeigner && (
                      <div className="p-8 bg-amber-50 border-2 border-amber-200 rounded-[2.5rem] space-y-8 shadow-inner">
                        <div className="flex items-center justify-between border-b border-amber-200 pb-4"><span className="text-xs font-black text-amber-800 uppercase tracking-[0.3em] flex items-center gap-3"><Globe className="w-4 h-4" /> Form C: FRRO Audit Protocol</span></div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                          <div className="space-y-2"><label className="text-[9px] font-black text-amber-600/80 uppercase">Passport ID</label><input type="text" value={guestForm.passportNumber || ''} onChange={e => setGuestForm({ ...guestForm, passportNumber: e.target.value })} className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-black text-slate-900 outline-none" /></div>
                          <div className="space-y-2"><label className="text-[9px] font-black text-amber-600/80 uppercase">Expiry Date</label><input type="date" value={guestForm.passportExpiry || ''} onChange={e => setGuestForm({ ...guestForm, passportExpiry: e.target.value })} className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-black text-slate-900 outline-none" /></div>
                          <div className="space-y-2"><label className="text-[9px] font-black text-amber-600/80 uppercase">Origin Port</label><input type="text" value={guestForm.passportPlaceIssue || ''} onChange={e => setGuestForm({ ...guestForm, passportPlaceIssue: e.target.value })} className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-black text-slate-900 outline-none" /></div>
                          <div className="space-y-2"><label className="text-[9px] font-black text-amber-600/80 uppercase">Issue Date</label><input type="date" value={guestForm.passportIssueDate || ''} onChange={e => setGuestForm({ ...guestForm, passportIssueDate: e.target.value })} className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-black text-slate-900 outline-none" /></div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-4 border-t border-amber-100">
                          <div className="space-y-2"><label className="text-[9px] font-black text-amber-600/80 uppercase">Visa Number</label><input type="text" value={guestForm.visaNumber || ''} onChange={e => setGuestForm({ ...guestForm, visaNumber: e.target.value })} className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-black text-slate-900 outline-none" /></div>
                          <div className="space-y-2"><label className="text-[9px] font-black text-amber-600/80 uppercase">Visa End Date</label><input type="date" value={guestForm.visaExpiry || ''} onChange={e => setGuestForm({ ...guestForm, visaExpiry: e.target.value })} className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-black text-slate-900 outline-none" /></div>
                          <div className="space-y-2"><label className="text-[9px] font-black text-amber-600/80 uppercase">Visa Category</label><input type="text" value={guestForm.visaType || ''} onChange={e => setGuestForm({ ...guestForm, visaType: e.target.value })} className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-black text-slate-900 outline-none" /></div>
                          <div className="space-y-2"><label className="text-[9px] font-black text-amber-600/80 uppercase">Embassy Loc</label><input type="text" value={guestForm.visaPlaceIssue || ''} onChange={e => setGuestForm({ ...guestForm, visaPlaceIssue: e.target.value })} className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-black text-slate-900 outline-none" /></div>
                        </div>


                        <div className="grid grid-cols-2 gap-6 pt-4 border-t border-amber-100">
                          <div className="space-y-2"><label className="text-[9px] font-black text-amber-600/80 uppercase">India Entry Date</label><input type="date" value={guestForm.arrivalDateIndia || ''} onChange={e => setGuestForm({ ...guestForm, arrivalDateIndia: e.target.value })} className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-black text-slate-900 outline-none" /></div>
                          <div className="space-y-2"><label className="text-[9px] font-black text-amber-600/80 uppercase">Entry Port (IATA)</label><input type="text" value={guestForm.arrivalPort || ''} onChange={e => setGuestForm({ ...guestForm, arrivalPort: e.target.value })} className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-black text-slate-900 outline-none" /></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="p-8 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                <div className="flex gap-4">
                  <button onClick={closeCheckInAndShowProfile} className="px-8 py-4 rounded-2xl font-black text-[10px] text-slate-500 hover:bg-slate-200 transition-colors uppercase tracking-[0.2em]">Abort Process</button>
                  <button onClick={handlePrintRegistration} className="px-8 py-4 bg-slate-900 hover:bg-black text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl transition-all flex items-center gap-3">
                    <Printer className="w-4 h-4" />
                    Print GRC
                  </button>
                  {isRepeatGuest && !isScanOnlyMode && (
                    <button
                      onClick={() => {
                        setIsRepeatGuest(false);
                        setIsIdMasked(false);
                        setIdImages({ front: null, back: null, visa: null });
                        setGuestForm({
                          name: activeCheckInBooking?.guestDetails?.name || activeCheckInBooking?.guestName || '',
                          phoneNumber: activeCheckInBooking?.guestDetails?.phoneNumber || '',
                          email: '', idType: 'Aadhar', idNumber: '', address: '', dob: '', nationality: 'Indian', gender: 'Male', visaType: 'Tourist', purposeOfVisit: 'Tourism', arrivalPort: 'Delhi (DEL)',
                          city: '', state: '', pinCode: '', country: '', arrivalTime: '', departureTime: ''
                        });
                      }}
                      className="px-8 py-4 bg-slate-200 rounded-2xl font-black text-[10px] text-slate-500 hover:text-slate-800 hover:bg-slate-300 transition-colors uppercase tracking-[0.2em]"
                    >
                      Reset Guest
                    </button>
                  )}
                </div>
                {isScanOnlyMode ? (
                  <button onClick={saveScannedDocs} className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-2xl hover:shadow-indigo-200 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3">
                    <ScanLine className="w-5 h-5" />
                    Save Documents
                  </button>
                ) : (
                  <button onClick={confirmCheckIn} className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/20 transition-all active:scale-95">Verify & Commit {isAddingAccessory ? 'Co-Guest' : 'Occupancy'}</button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
        <DragOverlay>{dragState.activeId && (() => { const booking = assignedBookings.find(b => b.id === dragState.activeId); if (!booking) return null; const duration = Math.ceil((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 3600 * 24)); return <DraggableBooking booking={booking} duration={duration} isOverlay={true} isValid={dragState.isValid} />; })()}</DragOverlay>
        {toastMessage && (<div className="absolute top-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4 border-2 border-indigo-500/50"><CheckCircle2 className="w-6 h-6 text-emerald-400" /><span className="font-black text-sm uppercase tracking-widest">{toastMessage}</span></div>)}

        <NewBookingModal
          isOpen={isNewBookingModalOpen}
          onClose={() => {
            setIsNewBookingModalOpen(false);
            setBookingPrefill(null);
          }}
          roomTypes={roomTypes}
          syncEvents={syncEvents}
          onCreateBookings={handleCreateBookings}
          prefill={bookingPrefill}
        />
      </div>
    </DndContext>
  );
};

export default FrontDeskView;
