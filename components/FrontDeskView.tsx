
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft, ChevronRight, Calendar, User,
  Bed, Maximize2, Minimize2, GripVertical, CheckCircle2,
  AlertOctagon, XCircle, LogIn, LogOut, ScanLine, CreditCard,
  Loader2, Search, Plus, FileText, Lock, Smartphone, Mail, MapPin, FileBadge, Keyboard, X, Clock, Camera, RotateCcw,
  Star, Globe, Plane, Upload, Printer, LayoutGrid, Briefcase, Flag, Zap, ArrowRightCircle, Minus
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
import { RoomType, SyncEvent, Booking, GuestDetails, RoomSecurityStatus } from '../types';
import GuestProfilePage from './GuestProfilePage';

interface FrontDeskViewProps {
  roomTypes: RoomType[];
  syncEvents: SyncEvent[];
  setSyncEvents: React.Dispatch<React.SetStateAction<SyncEvent[]>>;
  onUpdateExtraBeds?: (bookingId: string, count: number) => void;
  roomSecurity?: RoomSecurityStatus[];
}

const CELL_WIDTH = 140;
const CELL_HEIGHT = 80;
const HEADER_HEIGHT = 80; // Matching room row height
const STICKY_HEADER_TOTAL_HEIGHT = 104; // HEADER_HEIGHT (80) + padding-y (12*2)

const STATUS_STYLES: Record<string, string> = {
  'Confirmed': 'bg-blue-600 text-white shadow-blue-900/10',
  'CheckedIn': 'bg-emerald-600 text-white shadow-emerald-900/10',
  'Pending': 'bg-amber-500 text-white shadow-amber-900/10',
  'Warning': 'bg-rose-600 text-white shadow-rose-900/10',
  'CheckedOut': 'bg-slate-500 text-white shadow-slate-900/10',
  'VIP': 'bg-violet-600 text-white shadow-violet-900/10'
};

const CATEGORY_GRADIENTS = [
  'bg-gradient-to-br from-slate-800 to-slate-900 shadow-slate-900/20 border-slate-700/50',
  'bg-gradient-to-br from-indigo-600 to-blue-700 shadow-indigo-900/20 border-indigo-400/30',
  'bg-gradient-to-br from-violet-600 to-fuchsia-700 shadow-violet-900/20 border-violet-400/30',
  'bg-gradient-to-br from-teal-600 to-teal-800 shadow-emerald-900/20 border-teal-400/30',
  'bg-gradient-to-br from-rose-500 to-rose-700 shadow-rose-900/20 border-rose-400/30',
];

// SOFTER TINTS FOR ROOM LANES (400-level at 50% opacity)
const ROW_TINTS = [
  'bg-slate-400/40',
  'bg-blue-400/40',
  'bg-purple-400/40',
  'bg-teal-400/40', // Milder Green/Teal
  'bg-rose-400/40'  // Milder Pink/Rose
];

const LABEL_TINTS = [
  'bg-slate-100',
  'bg-blue-50',
  'bg-purple-50',
  'bg-teal-50',
  'bg-rose-50'
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
      className={`absolute top-2 bottom-2 left-2 rounded-xl border border-white/30 shadow-2xl cursor-pointer overflow-hidden ${displayColor} transition-all duration-300 group hover:scale-[1.02] hover:shadow-indigo-900/20 hover:z-20 hover:border-white/60 ${isJustMoved ? 'animate-pulse ring-4 ring-white/50' : ''}`}
      onClick={handleClick}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent pointer-events-none"></div>
      <div className="relative h-full flex flex-col justify-between p-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-black leading-tight text-white drop-shadow-md truncate uppercase tracking-tighter">{booking.guestName}</span>
          <span className="text-[9px] font-black text-white/80 uppercase tracking-widest opacity-90">{booking.source}</span>
        </div>
        <div className="flex justify-between items-end">
          <span className="text-[8px] font-bold text-white/50 font-mono tracking-widest tabular-nums">#{booking.id.split('-')[1]?.slice(-4)}</span>
          {booking.isVIP && (
            <div className="p-1 bg-amber-400/30 rounded-full border border-amber-300/40 backdrop-blur-sm shadow-inner">
              <Star className="w-2.5 h-2.5 text-amber-200 fill-amber-200" />
            </div>
          )}
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
}

const DroppableCell: React.FC<DroppableCellProps> = ({ date, roomNumber, children, isWeekend, isToday }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `${roomNumber}::${date}`,
    data: { date, roomNumber }
  });
  return (
    <div ref={setNodeRef} className={`relative border-r border-black/5 flex-shrink-0 h-[80px] transition-colors ${isWeekend ? 'bg-black/5' : 'bg-transparent'} ${isOver ? 'bg-indigo-400/20 ring-inset ring-2 ring-indigo-400/50 z-0' : ''} ${isToday ? 'bg-indigo-500/10' : ''}`} style={{ width: CELL_WIDTH }}>
      {children}
    </div>
  );
};

const FrontDeskView: React.FC<FrontDeskViewProps> = ({ roomTypes, syncEvents, setSyncEvents, onUpdateExtraBeds, roomSecurity = [] }) => {
  const [startDate, setStartDate] = useState(new Date());
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
  const [isAddingAccessory, setIsAddingAccessory] = useState(false);
  const [editingAccessoryIndex, setEditingAccessoryIndex] = useState<number | null>(null);
  const [checkInMode, setCheckInMode] = useState<'scan' | 'manual'>('scan');
  const [ocrStep, setOcrStep] = useState<'idle' | 'scan_front' | 'scan_back' | 'scan_visa' | 'processing' | 'success'>('idle');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [idImages, setIdImages] = useState<{ front: string | null, back: string | null, visa: string | null }>({ front: null, back: null, visa: null });

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

  const toggleExpand = (id: string) => { setExpandedTypes(prev => ({ ...prev, [id]: !prev[id] })); };

  const timelineDates = useMemo(() => {
    const dates: string[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  }, [startDate]);

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
      const availableRooms = rt.roomNumbers && rt.roomNumbers.length > 0
        ? rt.roomNumbers
        : Array.from({ length: rt.totalCapacity }, (_, i) => `${rt.name.substring(0, 2).toUpperCase()}-${101 + i}`);
      const hash = b.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const roomIndex = hash % (availableRooms.length || 1);
      const assignedNum = availableRooms[roomIndex] || 'Unassigned';
      return { ...b, roomNumber: assignedNum };
    });
  }, [syncEvents, roomTypes]);

  const todayStr = new Date().toISOString().split('T')[0];
  const todaysArrivals = useMemo(() => assignedBookings.filter(b => b.checkIn === todayStr && b.status === 'Confirmed').sort((a, b) => a.guestName.localeCompare(b.guestName)), [assignedBookings, todayStr]);
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
      const newCheckOut = newCheckIn;
      newCheckOut.setDate(newCheckOut.getDate() + duration);
      const targetRow = gridRows.find(r => r.id === newRoomNumber && r.type === 'room');
      const newRoomTypeId = targetRow?.parentId || currentBooking.roomTypeId;
      setLastMovedBookingId(active.id);
      setTimeout(() => setLastMovedBookingId(null), 1500);
      setSyncEvents(prev => prev.map(e => {
        if (e.id === active.id && e.type === 'booking') {
          return { ...e, roomNumber: newRoomNumber, roomTypeId: newRoomTypeId, checkIn: newDateStr, checkOut: newCheckOut.toISOString().split('T')[0], timestamp: Date.now() };
        }
        return e;
      }));
    }
  };

  const handleResizeBooking = (bookingId: string, newDuration: number) => {
    setSyncEvents(prev => prev.map(e => {
      if (e.id === bookingId && e.type === 'booking') {
        const checkInDate = new Date(e.checkIn);
        const newCheckOut = new Date(checkInDate);
        newCheckOut.setDate(checkInDate.getDate() + newDuration);
        return { ...e, checkOut: newCheckOut.toISOString().split('T')[0], timestamp: Date.now() };
      }
      return e;
    }));
  };

  const handleBookingClick = (booking: Booking) => setSelectedBooking(booking);

  const handleUpdateStatusFromProfile = (bookingId: string, newStatus: string) => {
    setSyncEvents(prev => prev.map(e => {
      if (e.id === bookingId && e.type === 'booking') {
        const updated = { ...e, status: newStatus as any, timestamp: Date.now() };
        if (selectedBooking?.id === bookingId) setSelectedBooking(updated as Booking);
        return updated;
      }
      return e;
    }));
  };

  const handleToggleVIPFromProfile = (bookingId: string) => {
    setSyncEvents(prev => prev.map(e => {
      if (e.id === bookingId && e.type === 'booking') {
        const updated = { ...e, isVIP: !e.isVIP, timestamp: Date.now() };
        if (selectedBooking?.id === bookingId) setSelectedBooking(updated);
        return updated;
      }
      return e;
    }));
  };

  const handleOpenCheckInWizard = (booking: Booking, isAccessory: boolean = false, index: number | null = null) => {
    setActiveCheckInBooking(booking);
    setIsAddingAccessory(isAccessory);
    setEditingAccessoryIndex(index);
    setCheckInMode('scan');
    setOcrStep('idle');
    setIdImages({ front: null, back: null, visa: null });
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
    if (isAccessory) {
      if (index !== null && booking.accessoryGuests && booking.accessoryGuests[index]) setGuestForm(getGuestData(booking.accessoryGuests[index]));
      else setGuestForm(getGuestData(undefined));
    } else {
      setGuestForm({ ...getGuestData(booking.guestDetails), name: booking.guestDetails?.name || booking.guestName });
    }
    setSelectedBooking(null);
  };

  const closeCheckInAndShowProfile = () => {
    stopCamera();
    if (activeCheckInBooking) setSelectedBooking(activeCheckInBooking);
    setActiveCheckInBooking(null);
    setEditingAccessoryIndex(null);
  };

  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      setOcrStep('scan_front');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      setToastMessage("Camera not accessible. Using manual mode.");
      setCheckInMode('manual');
    }
  };

  const stopCamera = () => {
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
        else if (ocrStep === 'scan_back') { setIdImages(prev => ({ ...prev, back: imgData })); if (isForeigner) setOcrStep('scan_visa'); else { stopCamera(); setOcrStep('processing'); if (idImages.front) analyzeIdImages(idImages.front.split(',')[1], imgData.split(',')[1]); } }
        else if (ocrStep === 'scan_visa') { setIdImages(prev => ({ ...prev, visa: imgData })); stopCamera(); setOcrStep('processing'); if (idImages.front && idImages.back) analyzeIdImages(idImages.front.split(',')[1], idImages.back.split(',')[1], imgData.split(',')[1]); }
      }
    }
  };

  const analyzeIdImages = async (frontB64: string, backB64: string, visaB64?: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const parts: any[] = [{ text: "Extract detailed ID details including Name, ID Number, Address, Date of Birth (YYYY-MM-DD), Gender (Male/Female/Other), ID Type (Aadhar/Passport/etc), Nationality, Passport Details (Number, Expiry, Place of Issue, Issue Date), Visa Details (Number, Expiry, Type, Place of Issue, Issue Date). Return clean JSON." }, { inlineData: { mimeType: 'image/jpeg', data: frontB64 } }, { inlineData: { mimeType: 'image/jpeg', data: backB64 } }];
      if (visaB64) parts.push({ inlineData: { mimeType: 'image/jpeg', data: visaB64 } });
      const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: [{ parts }], config: { responseMimeType: 'application/json' } });
      if (response.text) {
        const data = JSON.parse(response.text);
        setGuestForm(prev => ({
          ...prev,
          name: data.Name || data.name || prev.name,
          idNumber: data.ID_Number || data.idNumber || '',
          address: data.Address || data.address || '',
          dob: data.DOB || data.dob || '',
          gender: data.Gender || data.gender || 'Male',
          idType: data.ID_Type || data.idType || 'Aadhar',
          nationality: data.Nationality || data.nationality || 'Indian',
          passportNumber: data.Passport_Number || data.passportNumber || prev.passportNumber,
          passportExpiry: data.Passport_Expiry || data.passportExpiry || prev.passportExpiry,
          passportPlaceIssue: data.Passport_Place_Issue || data.passportPlaceIssue || prev.passportPlaceIssue,
          passportIssueDate: data.Passport_Issue_Date || data.passportIssueDate || prev.passportIssueDate,
          visaNumber: data.Visa_Number || data.visaNumber || prev.visaNumber,
          visaExpiry: data.Visa_Expiry || data.visaExpiry || prev.visaExpiry,
          visaType: data.Visa_Type || data.visaType || prev.visaType,
        }));
        setOcrStep('success');
      }
    } catch (e) { setCheckInMode('manual'); }
  };

  const triggerFileUpload = () => { fileInputRef.current?.click(); };
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const imgData = ev.target?.result as string;
        if (ocrStep === 'idle' || ocrStep === 'scan_front') { setIdImages(prev => ({ ...prev, front: imgData })); setOcrStep('scan_back'); }
        else if (ocrStep === 'scan_back') { setIdImages(prev => ({ ...prev, back: imgData })); if (isForeigner) setOcrStep('scan_visa'); else { stopCamera(); setOcrStep('processing'); if (idImages.front) analyzeIdImages(idImages.front.split(',')[1], imgData.split(',')[1]); } }
        else if (ocrStep === 'scan_visa') { setIdImages(prev => ({ ...prev, visa: imgData })); stopCamera(); setOcrStep('processing'); if (idImages.front && idImages.back) analyzeIdImages(idImages.front.split(',')[1], idImages.back.split(',')[1], imgData.split(',')[1]); }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const confirmCheckIn = () => {
    if (!activeCheckInBooking) return;
    const updated: Booking & { type: 'booking' } = { ...activeCheckInBooking, timestamp: Date.now(), type: 'booking' };
    if (isAddingAccessory) {
      const currentAccessories = [...(activeCheckInBooking.accessoryGuests || [])];
      if (editingAccessoryIndex !== null) currentAccessories[editingAccessoryIndex] = { ...guestForm };
      else currentAccessories.push({ ...guestForm });
      updated.accessoryGuests = currentAccessories;
    } else {
      updated.status = 'CheckedIn';
      updated.guestName = guestForm.name || activeCheckInBooking.guestName;
      updated.guestDetails = { ...guestForm, idImage: idImages.front || undefined, idImageBack: idImages.back || undefined, visaPage: idImages.visa || undefined };
    }
    setSyncEvents(prev => prev.map(e => e.id === activeCheckInBooking.id ? updated : e));
    setActiveCheckInBooking(null);
    setEditingAccessoryIndex(null);
    setSelectedBooking(updated);
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
  const getBookingForCell = (roomNumber: string, date: string) => assignedBookings.find(b => b.roomNumber === roomNumber && b.checkIn === date);

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
            </div>
            <button className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl"><Plus className="w-4 h-4" /> New Booking</button>
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
                className="sticky top-0 z-[55] flex gap-3 px-6 py-3 bg-[#f8fafc] border-b border-slate-200/50 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.1)]"
                style={{ height: STICKY_HEADER_TOTAL_HEIGHT }}
              >
                {/* Left Card - Matches Room Rows */}
                <div className="w-64 h-[80px] shrink-0 bg-white rounded-2xl shadow-xl border border-slate-300/30 p-5 flex flex-col justify-center sticky left-0 z-[56]">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Grid Context</span>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-black text-slate-800 tracking-tighter">Inventory</span>
                    <Calendar className="w-4 h-4 text-indigo-500/50" />
                  </div>
                </div>

                {/* Right Card - Date Timeline Segments */}
                <div className="flex-1 h-[80px] flex bg-white rounded-2xl shadow-2xl border border-black/10 overflow-hidden">
                  {timelineDates.map(date => {
                    const d = new Date(date);
                    const isToday = new Date().toDateString() === d.toDateString();
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <div key={date} className={`flex-1 flex flex-col items-center justify-center border-r border-slate-100 last:border-0 ${isWeekend ? 'bg-slate-50/50' : ''}`} style={{ minWidth: CELL_WIDTH }}>
                        <span className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isToday ? 'text-indigo-600' : 'text-slate-400'}`}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                        <div className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-black transition-all tabular-nums ${isToday ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-300' : 'text-slate-800'}`}>{d.getDate()}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="px-6 space-y-3 pt-6">
                {isLoading ? (
                  <div className="space-y-4 animate-pulse">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="flex flex-col md:flex-row gap-3">
                        <div className="w-full md:w-64 h-[80px] bg-slate-200 rounded-2xl shrink-0"></div>
                        <div className="flex-1 h-[80px] bg-slate-200 rounded-2xl"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  gridRows.map((row, index) => {
                    const isHeader = row.type === 'header';
                    if (isHeader) {
                      const todayStr = new Date().toISOString().split('T')[0];
                      const occupiedCount = assignedBookings.filter(b => b.roomTypeId === row.id && b.status !== 'Cancelled' && b.status !== 'Rejected' && b.checkIn <= todayStr && b.checkOut > todayStr).length;
                      const gradientClass = CATEGORY_GRADIENTS[index % CATEGORY_GRADIENTS.length];
                      return (
                        <div key={row.id} className="sticky top-[104px] z-30 flex flex-col md:flex-row gap-3 pt-4">
                          <div onClick={() => toggleExpand(row.id)} className={`w-full md:w-64 shrink-0 rounded-2xl shadow-xl p-4 flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] border border-white/20 backdrop-blur-lg relative overflow-hidden group sticky left-0 z-40 ${gradientClass}`}>
                            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
                            <div className="flex items-center gap-3 relative z-10">
                              <div className="p-2.5 bg-black/30 rounded-xl text-white shadow-inner"><Bed className="w-5 h-5" /></div>
                              <div><span className="font-black text-sm text-white block tracking-tight leading-tight">{row.name}</span><span className="text-[9px] text-white/80 font-bold uppercase tracking-widest">{row.capacity} Units</span></div>
                            </div>
                            <div className="flex items-center gap-3 relative z-10">
                              <span className="text-2xl font-black text-white tabular-nums tracking-tighter">{occupiedCount}</span>
                              <div className="p-1.5 bg-white/20 rounded-lg text-white hover:bg-white/30 transition-colors shadow-sm">{expandedTypes[row.id] ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}</div>
                            </div>
                          </div>
                          <div className="hidden md:flex flex-1 bg-slate-200/40 rounded-2xl items-center px-6"><div className="h-px bg-slate-300/50 w-full"></div></div>
                        </div>
                      );
                    }

                    const securityStatus = roomSecurity.find(rs => rs.room_id === row.id);
                    const isAlerted = securityStatus && (securityStatus.failCount >= 3 || securityStatus.isLocked);

                    const categoryIndex = row.parentId ? roomTypes.findIndex(rt => rt.id === row.parentId) : -1;
                    const rowTint = categoryIndex >= 0 ? ROW_TINTS[categoryIndex % ROW_TINTS.length] : 'bg-white';
                    const labelTint = categoryIndex >= 0 ? LABEL_TINTS[categoryIndex % LABEL_TINTS.length] : 'bg-white';

                    return (
                      <div key={row.id} className="flex flex-col md:flex-row gap-3 group animate-in slide-in-from-top-2 fade-in duration-300 ease-out fill-mode-forwards">
                        <div className="w-full md:w-64 md:sticky md:left-0 z-20 shrink-0">
                          <div className={`h-[80px] w-full ${isAlerted ? 'bg-amber-100 ring-4 ring-amber-400' : labelTint} rounded-2xl shadow-xl border ${isAlerted ? 'border-amber-500' : 'border-slate-300/30'} p-3 flex flex-col justify-center hover:shadow-indigo-500/10 transition-all group-hover:border-indigo-400/50 relative overflow-hidden`}>
                            <div className={`absolute top-0 left-0 w-2 h-full ${isAlerted ? 'bg-amber-600' : 'bg-indigo-600'} opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                            <div className="flex justify-between items-center mb-1">
                              <span className={`text-xl font-black ${isAlerted ? 'text-amber-900' : 'text-slate-900'} tabular-nums tracking-tighter`}>{row.name}</span>
                              <div className={`w-3 h-3 rounded-full ${isAlerted ? 'bg-amber-500 shadow-[0_0_15px_rgba(251,191,36,1)] animate-pulse' : 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]'}`}></div>
                            </div>
                            <span className={`text-[9px] font-black ${isAlerted ? 'text-amber-700' : 'text-slate-500'} uppercase tracking-[0.2em]`}>
                              {isAlerted ? 'Alert Active' : 'Clean & Ready'}
                            </span>
                          </div>
                        </div>
                        <div className={`flex-1 ${rowTint} rounded-2xl shadow-2xl border border-black/10 relative flex overflow-hidden hover:shadow-indigo-900/10 transition-all`}>
                          {timelineDates.map(date => {
                            const booking = getBookingForCell(row.id, date);
                            const d = new Date(date);
                            return (
                              <DroppableCell key={date} date={date} roomNumber={row.id} isWeekend={d.getDay() === 0 || d.getDay() === 6} isToday={new Date().toDateString() === d.toDateString()}>
                                {booking && <DraggableBooking booking={booking} duration={Math.ceil((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 3600 * 24))} onResize={(newDur) => handleResizeBooking(booking.id, newDur)} onSelect={handleBookingClick} isJustMoved={booking.id === lastMovedBookingId} />}
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
            <div className="space-y-4">
              <div className="flex items-center justify-between"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Today's Arrivals</h4><span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-lg shadow-md">{todaysArrivals.length}</span></div>
              {todaysArrivals.length === 0 ? (<div className="text-center py-6 text-slate-400 text-[10px] font-black uppercase tracking-widest bg-slate-50 rounded-2xl border border-slate-100">All Checked In</div>) : (todaysArrivals.map(b => (
                <div key={b.id} className="p-5 bg-white border border-slate-100 rounded-[2rem] shadow-sm hover:shadow-xl transition-all group border-l-4 border-l-indigo-600"><div className="flex items-center gap-4 mb-4"><div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-sm shrink-0 shadow-inner border border-indigo-100">{b.guestName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}</div><div className="overflow-hidden"><p className="font-black text-slate-900 text-sm truncate tracking-tighter uppercase">{b.guestName}</p><span className="inline-flex items-center gap-1 text-[8px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded uppercase tracking-widest mt-1 border border-amber-100">Awaiting ID</span></div></div><div className="flex items-center justify-between mb-5 px-1"><div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{roomTypes.find(r => r.id === b.roomTypeId)?.name || 'Standard'} <span className="font-black text-indigo-600 ml-1 bg-indigo-50 px-1.5 py-0.5 rounded shadow-sm">#{b.roomNumber || 'TBD'}</span></div></div><button onClick={() => handleOpenCheckInWizard(b)} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-indigo-200 flex items-center justify-center gap-3">One-Click Check-In <ArrowRightCircle className="w-4 h-4" /></button></div>
              )))}
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Pending Departures</h4><span className="text-[10px] font-black bg-rose-600 text-white px-2 py-0.5 rounded-lg shadow-md">{todaysDepartures.length}</span></div>
              {todaysDepartures.length === 0 ? (<div className="text-center py-6 text-slate-400 text-[10px] font-black uppercase tracking-widest bg-slate-50 rounded-2xl border border-slate-100">None Scheduled</div>) : (todaysDepartures.map(b => (
                <div key={b.id} className="p-5 bg-white border border-slate-100 rounded-[2rem] shadow-sm hover:shadow-xl transition-all group border-l-4 border-l-rose-600"><div className="flex items-center gap-4 mb-4"><div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center font-black text-sm shrink-0 border border-slate-200">{b.guestName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}</div><div className="overflow-hidden"><p className="font-black text-slate-900 text-sm truncate tracking-tighter uppercase">{b.guestName}</p><span className="inline-flex items-center gap-1 text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase tracking-widest mt-1 border border-emerald-100">Paid & Clear</span></div></div><div className="flex items-center justify-between mb-5 px-1"><div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Room <span className="font-black text-rose-600 ml-1 bg-rose-50 px-1.5 py-0.5 rounded shadow-sm">#{b.roomNumber}</span></div></div><button onClick={() => setSelectedBooking(b)} className="w-full py-3.5 bg-slate-900 hover:bg-black text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl flex items-center justify-center gap-3">Process Check-Out <LogOut className="w-4 h-4" /></button></div>
              )))}
            </div>
          </div>
        </div>

        {selectedBooking && (
          <GuestProfilePage
            booking={selectedBooking}
            roomTypes={roomTypes}
            onClose={() => setSelectedBooking(null)}
            onUpdateStatus={handleUpdateStatusFromProfile}
            onToggleVIP={handleToggleVIPFromProfile}
            onCheckIn={handleOpenCheckInWizard}
            onUpdateExtraBeds={onUpdateExtraBeds}
            onEditInventory={() => { setToastMessage("Drag and drop to edit inventory."); setTimeout(() => setToastMessage(null), 3000); }}
          />
        )}

        {activeCheckInBooking && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20 flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div><h3 className="text-xl font-black text-slate-900 tracking-tight">Guest Check-In</h3><p className="text-xs text-slate-500 tabular-nums uppercase font-black">Booking #{activeCheckInBooking.id.split('-')[1]?.slice(0, 8)} • {activeCheckInBooking.guestName}</p></div>
                <button onClick={closeCheckInAndShowProfile} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><XCircle className="w-6 h-6 text-slate-400" /></button>
              </div>
              <div className="flex border-b border-slate-100">
                <button onClick={() => setCheckInMode('scan')} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${checkInMode === 'scan' ? 'bg-white text-indigo-600 border-b-4 border-indigo-600' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}><ScanLine className="w-4 h-4" /> Scan / Upload ID</button>
                <button onClick={() => { stopCamera(); setCheckInMode('manual'); }} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${checkInMode === 'manual' ? 'bg-white text-indigo-600 border-b-4 border-indigo-600' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}><Keyboard className="w-4 h-4" /> Manual Entry</button>
              </div>
              <div className="p-8 overflow-y-auto custom-scrollbar">
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                {checkInMode === 'scan' ? (
                  <div className="flex flex-col items-center text-center space-y-6">
                    {ocrStep === 'idle' && (
                      <>
                        <div className="relative w-80 h-48 bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-800 flex items-center justify-center cursor-pointer group hover:border-slate-700 transition-colors" onClick={startCamera}><div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 group-hover:text-slate-300 transition-colors"><Camera className="w-12 h-12 mb-2" /><span className="text-xs font-black uppercase tracking-widest">Click to Start Camera</span></div></div>
                        <div className="flex items-center gap-4 w-80"><div className="h-px bg-slate-200 flex-1"></div><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">OR</span><div className="h-px bg-slate-200 flex-1"></div></div>
                        <button onClick={triggerFileUpload} className="w-80 py-4 bg-white border-2 border-slate-200 rounded-3xl flex items-center justify-center gap-3 hover:border-indigo-500 transition-all group shadow-xl"><div className="p-3 bg-slate-100 rounded-2xl group-hover:bg-indigo-50 transition-colors"><Upload className="w-6 h-6 text-slate-500 group-hover:text-indigo-600" /></div><div className="text-left"><span className="block text-xs font-black text-slate-700 uppercase tracking-widest">Digital Scanner</span><span className="block text-[10px] text-slate-400 font-bold uppercase">Upload from device</span></div></button>
                      </>
                    )}
                    {(ocrStep === 'scan_front' || ocrStep === 'scan_back' || ocrStep === 'scan_visa') && (
                      <div className="relative w-80 h-60 bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-800">{isCameraActive ? (<><video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" /><canvas ref={canvasRef} className="hidden" /></>) : (<div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900"><Upload className="w-12 h-12 text-slate-600 mb-2" /><span className="text-xs font-bold text-slate-500 uppercase">{ocrStep === 'scan_front' ? 'Upload Front ID' : ocrStep === 'scan_back' ? 'Upload Back ID' : 'Upload Visa'}</span></div>)}<div className="absolute top-4 left-0 w-full text-center"><span className="px-4 py-1.5 bg-black/60 text-white text-[10px] font-black uppercase rounded-full backdrop-blur-md border border-white/20 tracking-[0.2em]">{ocrStep === 'scan_front' ? 'Scan Front' : ocrStep === 'scan_back' ? 'Scan Back' : 'Scan Visa'}</span></div>{isCameraActive ? (<button onClick={captureImage} className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-4 border-slate-300 flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-2xl"><div className="w-12 h-12 bg-red-500 rounded-full shadow-inner"></div></button>) : (<button onClick={triggerFileUpload} className="absolute bottom-6 left-1/2 -translate-x-1/2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all">Select File</button>)}</div>
                    )}
                    {ocrStep === 'processing' && (<div className="w-80 h-48 flex flex-col items-center justify-center bg-slate-50 rounded-3xl border-2 border-dashed border-indigo-200"><Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" /><p className="text-sm font-black text-slate-800 tracking-tight uppercase">Extracting Intelligence...</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gemini AI OCR Layer Active</p></div>)}
                    {ocrStep === 'success' && (<div className="w-full space-y-4"><div className="flex gap-4 justify-center">{idImages.front && <img src={idImages.front} className="w-24 h-16 rounded-xl border-2 border-slate-200 object-cover shadow-md" />}{idImages.back && <img src={idImages.back} className="w-24 h-16 rounded-xl border-2 border-slate-200 object-cover shadow-md" />}</div><div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-4 text-emerald-700 shadow-sm"><CheckCircle2 className="w-6 h-6" /><span className="text-xs font-black uppercase tracking-[0.2em]">Biometric Data Captured</span></div><button onClick={() => { setOcrStep('idle'); setIdImages({ front: null, back: null, visa: null }); setIsCameraActive(false); }} className="text-[10px] font-black text-slate-400 hover:text-slate-700 uppercase tracking-[0.2em] flex items-center justify-center gap-2 mx-auto"><RotateCcw className="w-4 h-4" /> Reset Documents</button></div>)}
                  </div>
                ) : (<div className="text-center mb-6"><p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Manual Ledger Input Mode</p></div>)}
                {(checkInMode === 'manual' || ocrStep === 'success') && (
                  <div className="space-y-8 mt-4 animate-in fade-in duration-500">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                      <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Legal Full Name</label><input type="text" value={guestForm.name} onChange={e => setGuestForm({ ...guestForm, name: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-black text-slate-900 outline-none focus:border-indigo-400 shadow-inner" /></div>
                      <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Nationality</label><select value={guestForm.nationality} onChange={e => setGuestForm({ ...guestForm, nationality: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-black text-slate-900 outline-none focus:border-indigo-400 shadow-inner"><option>Indian</option><option>American</option><option>British</option><option>French</option><option>German</option><option>Other</option></select></div>
                      <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Gender</label><select value={guestForm.gender} onChange={e => setGuestForm({ ...guestForm, gender: e.target.value as any })} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-black text-slate-900 outline-none focus:border-indigo-400 shadow-inner"><option>Male</option><option>Female</option><option>Other</option></select></div>
                      <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Birth Date</label><input type="date" value={guestForm.dob} onChange={e => setGuestForm({ ...guestForm, dob: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-black text-slate-900 outline-none focus:border-indigo-400 shadow-inner" /></div>
                      <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">ID Protocol</label><select value={guestForm.idType} onChange={e => setGuestForm({ ...guestForm, idType: e.target.value as any })} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-black text-slate-900 outline-none focus:border-indigo-400 shadow-inner"><option>Aadhar</option><option>Passport</option><option>Driving License</option><option>Voter ID</option><option>Other</option></select></div>
                      <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Credential Number</label><input type="text" value={guestForm.idNumber} onChange={e => setGuestForm({ ...guestForm, idNumber: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-black text-slate-900 outline-none focus:border-indigo-400 shadow-inner" /></div>
                    </div>

                    <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Permanent Address (Verified)</label><textarea value={guestForm.address} onChange={e => setGuestForm({ ...guestForm, address: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-black text-slate-900 outline-none focus:border-indigo-400 min-h-[80px] shadow-inner" /></div>

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

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-4 border-t border-amber-100">
                          <div className="space-y-2"><label className="text-[9px] font-black text-amber-600/80 uppercase">Arrived From</label><input type="text" value={guestForm.arrivedFrom || ''} onChange={e => setGuestForm({ ...guestForm, arrivedFrom: e.target.value })} className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-black text-slate-900 outline-none" /></div>
                          <div className="space-y-2"><label className="text-[9px] font-black text-amber-600/80 uppercase">Next Route</label><input type="text" value={guestForm.nextDestination || ''} onChange={e => setGuestForm({ ...guestForm, nextDestination: e.target.value })} className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-black text-slate-900 outline-none" /></div>
                          <div className="space-y-2"><label className="text-[9px] font-black text-amber-600/80 uppercase">Objective</label><input type="text" value={guestForm.purposeOfVisit || ''} onChange={e => setGuestForm({ ...guestForm, purposeOfVisit: e.target.value })} className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-black text-slate-900 outline-none" /></div>
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
              <div className="p-8 border-t border-slate-100 bg-slate-50 flex justify-end gap-4 shrink-0"><button onClick={closeCheckInAndShowProfile} className="px-8 py-4 rounded-2xl font-black text-[10px] text-slate-500 hover:bg-slate-200 transition-colors uppercase tracking-[0.2em]">Abort Process</button><button onClick={confirmCheckIn} className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/20 transition-all active:scale-95">Verify & Commit {isAddingAccessory ? 'Co-Guest' : 'Occupancy'}</button></div>
            </div>
          </div>,
          document.body
        )}
        <DragOverlay>{dragState.activeId && (() => { const booking = assignedBookings.find(b => b.id === dragState.activeId); if (!booking) return null; const duration = Math.ceil((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 3600 * 24)); return <DraggableBooking booking={booking} duration={duration} isOverlay={true} isValid={dragState.isValid} />; })()}</DragOverlay>
        {toastMessage && (<div className="absolute top-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4 border-2 border-indigo-500/50"><CheckCircle2 className="w-6 h-6 text-emerald-400" /><span className="font-black text-sm uppercase tracking-widest">{toastMessage}</span></div>)}
      </div>
    </DndContext>
  );
};

export default FrontDeskView;
