import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  User,
  Bed,
  Maximize2,
  Minimize2,
  GripVertical,
  CheckCircle2,
  AlertOctagon,
  XCircle,
  LogIn,
  LogOut,
  CreditCard,
  ShieldAlert,
  Loader2,
  Search,
  Plus,
  FileText,
  Lock,
  Smartphone,
  Mail,
  MapPin,
  FileBadge,
  X,
  Clock,
  Star,
  Globe,
  Plane,
  LayoutGrid,
  Briefcase,
  Flag,
  Zap,
  ArrowRightCircle,
  Minus,
  AlertTriangle,
  Check,
} from "lucide-react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
  pointerWithin,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
} from "@dnd-kit/core";
import { hasPermission } from "../utils";
import { PERMISSIONS } from "./permissions";
import { formatDate } from "../utils";
import {
  RoomType,
  SyncEvent,
  Booking,
  GuestDetails,
  RoomSecurityStatus,
  ChannelStatus,
  OTAConnection,
  FolioItem,
  Payment,
  PropertySettings,
  RoomStatus,
  UserResponse,
} from "../types";
import GuestProfilePage from "./GuestProfilePage";
import NewBookingModal from "./NewBookingModal";
import {
  createBulkBookings,
  updateBooking,
  transferBooking,
  lookupGuest,
  fetchBookings,
} from "../api";
import { NATIONALITIES } from "../constants";

interface FrontDeskViewProps {
  roomTypes: RoomType[];
  connections: OTAConnection[];
  syncEvents: SyncEvent[];
  setSyncEvents: React.Dispatch<React.SetStateAction<SyncEvent[]>>;
  onUpdateExtraBeds?: (bookingId: string, count: number) => void;
  roomSecurity?: RoomSecurityStatus[];
  propertySettings: PropertySettings | null;
  roomStatuses?: RoomStatus[];
  user: UserResponse | null;
}

const CELL_WIDTH = 140;
const CELL_HEIGHT = 48;
const HEADER_HEIGHT = 48; // Matching room row height
const STICKY_HEADER_TOTAL_HEIGHT = 104; // Monthly row (24) + Date row (48) + padding-y (16*2)

const STATUS_STYLES: Record<string, string> = {
  Confirmed: "bg-blue-600 text-white shadow-blue-900/10",
  CheckedIn: "bg-emerald-600 text-white shadow-emerald-900/10",
  Pending: "bg-amber-500 text-white shadow-amber-900/10",
  Warning: "bg-rose-600 text-white shadow-rose-900/10",
  CheckedOut: "bg-slate-500 text-white shadow-slate-900/10",
  VIP: "bg-violet-600 text-white shadow-violet-900/10",
};

const CATEGORY_GRADIENTS = [
  { background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)" }, // slate
  { background: "linear-gradient(135deg, #4f46e5 0%, #1d4ed8 100%)" }, // indigo-blue
  { background: "linear-gradient(135deg, #7c3aed 0%, #c026d3 100%)" }, // violet-fuchsia
  { background: "linear-gradient(135deg, #0d9488 0%, #115e59 100%)" }, // teal
  { background: "linear-gradient(135deg, #f43f5e 0%, #be123c 100%)" }, // rose
];

// SOFTER TINTS FOR ROOM LANES (400-level at 50% opacity)
const ROW_TINTS = [
  { backgroundColor: "rgba(148, 163, 184, 0.4)" }, // slate
  { backgroundColor: "rgba(96, 165, 250, 0.4)" }, // blue
  { backgroundColor: "rgba(192, 132, 252, 0.4)" }, // purple
  { backgroundColor: "rgba(45, 212, 191, 0.4)" }, // teal
  { backgroundColor: "rgba(251, 113, 133, 0.4)" }, // rose
];

const LABEL_TINTS = [
  { backgroundColor: "#f1f5f9" }, // slate-100
  { backgroundColor: "#eff6ff" }, // blue-50
  { backgroundColor: "#faf5ff" }, // purple-50
  { backgroundColor: "#f0fdfa" }, // teal-50
  { backgroundColor: "#fff1f2" }, // rose-50
];

interface DraggableBookingProps {
  booking: Booking;
  duration: number;
  isOverlay?: boolean;
  isValid?: boolean;
  onResize?: (newDuration: number) => void;
  onSelect?: (booking: Booking) => void;
  isJustMoved?: boolean;
  canEdit?: boolean;
}

const DraggableBooking = ({
  booking,
  duration,
  isOverlay = false,
  isValid = true,
  onResize,
  onSelect,
  isJustMoved,
  canEdit = true,
}: DraggableBookingProps) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: booking.id,
    data: { ...booking, duration },
    disabled: !canEdit,
  });

  const [localDuration, setLocalDuration] = useState(duration);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (!isResizing) setLocalDuration(duration);
  }, [duration, isResizing]);

  const style = {
    width: `${localDuration * CELL_WIDTH - 16}px`,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 20,
  };

  const getStatusStyle = () => {
    if (isOverlay) {
      return isValid
        ? "bg-emerald-600 border-emerald-400 ring-4 ring-emerald-500/20"
        : "bg-rose-600 border-rose-400 ring-4 ring-rose-500/20";
    }
    if (booking.status === "Cancelled" || booking.status === "Rejected")
      return STATUS_STYLES["Warning"];
    if (booking.status === "CheckedIn") return STATUS_STYLES["CheckedIn"];
    if (booking.status === "CheckedOut") return STATUS_STYLES["CheckedOut"];
    if (booking.isVIP) return STATUS_STYLES["VIP"];
    return STATUS_STYLES["Confirmed"];
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
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!isDragging && !isResizing && onSelect) {
      e.stopPropagation();
      onSelect(booking);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`absolute top-0.5 bottom-0.5 left-1 rounded-lg border border-white/30 shadow-2xl cursor-pointer overflow-hidden ${displayColor} transition-all duration-300 group hover:scale-[1.02] hover:shadow-indigo-900/20 hover:z-30 hover:border-white/60 ${isJustMoved ? "animate-pulse ring-4 ring-white/50" : ""}`}
      onClick={handleClick}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent pointer-events-none"></div>
      <div className="relative h-full flex flex-col justify-center px-2">
        <div className="flex flex-col gap-0">
          <span className="text-[10px] font-black leading-tight text-white drop-shadow-md truncate uppercase tracking-tighter">
            {booking.guestName}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-black text-white/80 uppercase tracking-widest opacity-90">
              {booking.source}
            </span>
            {booking.isVIP && (
              <Star className="w-2 h-2 text-amber-200 fill-amber-200" />
            )}
          </div>
        </div>
      </div>
      {!isOverlay && onResize && canEdit && (
        <div
          className="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize hover:bg-white/10 flex items-center justify-center transition-colors z-20 opacity-0 group-hover:opacity-100"
          onPointerDown={handleResizeStart}
        >
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

const DroppableCell: React.FC<DroppableCellProps> = ({
  date,
  roomNumber,
  children,
  isWeekend,
  isToday,
  onClick,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `${roomNumber}::${date}`,
    data: { date, roomNumber },
  });
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`relative border-r border-black/5 flex-shrink-0 h-[48px] transition-colors ${isWeekend ? "bg-black/5" : "bg-transparent"} ${isOver ? "bg-indigo-400/20 ring-inset ring-2 ring-indigo-400/50 z-0" : ""} ${isToday ? "bg-cyan-400/10 ring-2 ring-inset ring-cyan-400/40 z-[5]" : ""} ${!children ? "cursor-cell hover:bg-indigo-50/50" : ""}`}
      style={{ width: CELL_WIDTH }}
    >
      {isToday && (
        <div className="absolute inset-x-0 top-0 h-full border-x-2 border-cyan-400/30 pointer-events-none"></div>
      )}
      {children}
    </div>
  );
};

const FrontDeskView: React.FC<FrontDeskViewProps> = ({
  roomTypes,
  connections,
  syncEvents,
  setSyncEvents,
  onUpdateExtraBeds,
  roomSecurity = [],
  propertySettings,
  roomStatuses = [],
  user,
}) => {
  const canCreate = hasPermission(user, PERMISSIONS.FRONT_DESK.CREATE_BOOKING);
  const canEdit = hasPermission(user, PERMISSIONS.FRONT_DESK.EDIT_BOOKING);
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("week");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 1); // Default to start from yesterday
    return d;
  });
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>(
    {},
  );
  const [isLoading, setIsLoading] = useState(false);
  const [lastMovedBookingId, setLastMovedBookingId] = useState<string | null>(
    null,
  );

  // Panning State
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStartX, setPanStartX] = useState(0);
  const [panScrollLeft, setPanScrollLeft] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const [dragState, setDragState] = useState<{
    activeId: string | null;
    isValid: boolean;
    targetRoom: string | null;
    targetDate: string | null;
    versionSnapshot: number | null;
  }>({
    activeId: null,
    isValid: true,
    targetRoom: null,
    targetDate: null,
    versionSnapshot: null,
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [bookingPrefill, setBookingPrefill] = useState<{
    checkIn: string;
    roomTypeId: string;
    roomId?: string;
  } | null>(null);

  const jumpDateRef = useRef<HTMLInputElement>(null);
  const [isAutoBookingsOpen, setIsAutoBookingsOpen] = useState(false);
  const [isActivityPanelOpen, setIsActivityPanelOpen] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, [startDate]);

  useEffect(() => {
    if (selectedBooking) {
      const liveBooking = syncEvents.find(
        (e) => e.id === selectedBooking.id && e.type === "booking",
      ) as Booking | undefined;
      if (
        liveBooking &&
        (liveBooking.timestamp !== selectedBooking.timestamp ||
          liveBooking.extraBeds !== selectedBooking.extraBeds ||
          (liveBooking.folio?.length || 0) !==
            (selectedBooking.folio?.length || 0) ||
          (liveBooking.payments?.length || 0) !==
            (selectedBooking.payments?.length || 0))
      ) {
        setSelectedBooking(liveBooking);
      }
    }
  }, [syncEvents, selectedBooking?.id]);

  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);

  const toggleExpand = (id: string) => {
    setExpandedTypes((prev) => ({
      ...prev,
      [id]: !effectiveExpandedTypes[id],
    }));
  };

  const timelineDates = useMemo(() => {
    const dates: string[] = [];
    if (viewMode === "day") {
      const d = new Date(startDate);
      dates.push(d.toISOString().split("T")[0]);
      return dates;
    }

    if (viewMode === "month") {
      const startOfMonth = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        1,
      );
      const endOfMonth = new Date(
        startDate.getFullYear(),
        startDate.getMonth() + 1,
        0,
      );
      const firstDay = new Date(startOfMonth);
      firstDay.setDate(firstDay.getDate() - (firstDay.getDay() || 0));
      const lastDay = new Date(endOfMonth);
      if (lastDay.getDay() < 6)
        lastDay.setDate(lastDay.getDate() + (6 - lastDay.getDay()));

      const current = new Date(firstDay);
      while (current <= lastDay) {
        dates.push(current.toISOString().split("T")[0]);
        current.setDate(current.getDate() + 1);
      }
      return dates;
    }

    // Default: 14-day Week/Timeline view
    for (let i = 0; i < 14; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
  }, [startDate, viewMode]);

  const monthSpans = useMemo(() => {
    const spans: { name: string; count: number }[] = [];
    timelineDates.forEach((dateStr) => {
      const d = new Date(dateStr);
      const name = d.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      if (spans.length === 0 || spans[spans.length - 1].name !== name) {
        spans.push({ name, count: 1 });
      } else {
        spans[spans.length - 1].count++;
      }
    });
    return spans;
  }, [timelineDates]);

  const assignedBookings = useMemo(() => {
    const bookings = syncEvents.filter(
      (e) =>
        e.type === "booking" &&
        (e.status === "Confirmed" ||
          e.status === "CheckedIn" ||
          e.status === "CheckedOut" ||
          e.status === "Rejected"),
    ) as Booking[];
    return bookings.map((b) => {
      const rt = roomTypes.find((t) => t.id === b.roomTypeId);
      if (!rt) return b;

      const availableRooms =
        rt.roomNumbers && rt.roomNumbers.length > 0 ? rt.roomNumbers : [];

      // Check if booking has a room number AND if it's still valid for this room type
      const hasValidRoom =
        b.roomNumber &&
        b.roomNumber !== "Unassigned" &&
        availableRooms.includes(b.roomNumber);

      if (hasValidRoom) return b;

      // Room number is missing or no longer valid for this room type - reassign
      if (availableRooms.length === 0)
        return { ...b, roomNumber: "Unassigned" };

      const hash = b.id
        .split("")
        .reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const roomIndex = hash % availableRooms.length;
      const assignedNum = availableRooms[roomIndex];
      return { ...b, roomNumber: assignedNum };
    });
  }, [syncEvents, roomTypes]);

  const autoBookings = useMemo(() => {
    return assignedBookings
      .filter((b) => b.isAutoGenerated && b.status === "Confirmed")
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [assignedBookings]);

  const effectiveExpandedTypes = useMemo(() => {
    const result: Record<string, boolean> = {};
    const tStart = timelineDates[0];
    const tEnd = timelineDates[timelineDates.length - 1];

    roomTypes.forEach((rt) => {
      if (expandedTypes[rt.id] !== undefined) {
        result[rt.id] = expandedTypes[rt.id];
        return;
      }

      const hasBooking = assignedBookings.some((b) => {
        if (b.roomTypeId !== rt.id) return false;
        return b.checkIn <= tEnd && b.checkOut > tStart;
      });
      result[rt.id] = hasBooking;
    });
    return result;
  }, [roomTypes, expandedTypes, assignedBookings, timelineDates]);

  const gridRows = useMemo(() => {
    const rows: {
      type: "header" | "room";
      id: string;
      name: string;
      parentId?: string;
      capacity?: number;
      category?: RoomType;
    }[] = [];
    roomTypes.forEach((rt) => {
      rows.push({
        type: "header",
        id: rt.id,
        name: rt.name,
        capacity: rt.totalCapacity,
        category: rt,
      });
      if (effectiveExpandedTypes[rt.id]) {
        const rooms =
          rt.roomNumbers ||
          Array.from(
            { length: rt.totalCapacity },
            (_, i) => `${rt.name.substring(0, 2).toUpperCase()}-${101 + i}`,
          );
        rooms.forEach((roomNum) => {
          rows.push({
            type: "room",
            id: roomNum,
            name: roomNum,
            parentId: rt.id,
          });
        });
      }
    });
    return rows;
  }, [roomTypes, effectiveExpandedTypes]);

  // Get all bookings related to the selected booking by reservationId
  const relatedBookings = useMemo(() => {
    if (!selectedBooking) return [];
    const resId = (selectedBooking as any).reservationId;
    if (!resId) return [selectedBooking];
    return assignedBookings.filter((b) => (b as any).reservationId === resId);
  }, [selectedBooking, assignedBookings]);

  const todayStr = new Date().toISOString().split("T")[0];

  // Group arrivals by reservationId to show one entry per multi-room booking
  const todaysArrivals = useMemo(() => {
    const arrivals = assignedBookings.filter(
      (b) => b.checkIn === todayStr && b.status === "Confirmed",
    );
    const grouped: Record<string, Booking[]> = {};
    arrivals.forEach((b) => {
      const key = (b as any).reservationId || b.id;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(b);
    });
    return Object.values(grouped)
      .map((group) => ({
        ...group[0],
        _roomCount: group.length,
        _allRooms: group,
      }))
      .sort((a, b) => a.guestName.localeCompare(b.guestName));
  }, [assignedBookings, todayStr]);

  const todaysDepartures = useMemo(
    () =>
      assignedBookings
        .filter((b) => b.checkOut === todayStr && b.status === "CheckedIn")
        .sort((a, b) => a.guestName.localeCompare(b.guestName)),
    [assignedBookings, todayStr],
  );

  const dailyOccupancy = useMemo(() => {
    return timelineDates.map((date) => {
      return assignedBookings.filter(
        (b) =>
          b.status !== "Cancelled" &&
          b.status !== "Rejected" &&
          b.checkIn <= date &&
          b.checkOut > date,
      ).length;
    });
  }, [timelineDates, assignedBookings]);

  const handleDragStart = (event: any) => {
    const booking = assignedBookings.find((b) => b.id === event.active.id);
    setDragState({
      activeId: event.active.id,
      isValid: true,
      targetRoom: null,
      targetDate: null,
      versionSnapshot: booking ? booking.timestamp : null,
    });
  };

  const handleDragOver = (event: any) => {
    const { active, over } = event;
    if (!over) return;
    const [roomNumber, dateStr] = over.id.split("::");
    const activeBooking = assignedBookings.find((b) => b.id === active.id);
    if (activeBooking && roomNumber && dateStr) {
      const checkIn = new Date(dateStr);
      const duration = Math.ceil(
        (new Date(activeBooking.checkOut).getTime() -
          new Date(activeBooking.checkIn).getTime()) /
          (1000 * 3600 * 24),
      );
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + duration);
      const hasConflict = assignedBookings.some((b) => {
        if (b.id === active.id) return false;
        if (b.roomNumber !== roomNumber) return false;
        const bStart = new Date(b.checkIn);
        const bEnd = new Date(b.checkOut);
        return checkIn < bEnd && checkOut > bStart;
      });
      setDragState((prev) => ({
        ...prev,
        isValid: !hasConflict,
        targetRoom: roomNumber,
        targetDate: dateStr,
      }));
    }
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    const snapshot = dragState.versionSnapshot;
    setDragState({
      activeId: null,
      isValid: true,
      targetRoom: null,
      targetDate: null,
      versionSnapshot: null,
    });
    if (!over) return;
    const [newRoomNumber, newDateStr] = over.id.split("::");
    const currentBooking = syncEvents.find(
      (e) => e.id === active.id && e.type === "booking",
    ) as Booking | undefined;
    if (!currentBooking) {
      setToastMessage("Error: Booking no longer exists.");
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    if (currentBooking.timestamp !== snapshot) {
      setToastMessage(
        "Optimistic Lock Error: This booking was modified by another user. Please refresh.",
      );
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    if (dragState.isValid) {
      const duration = Math.ceil(
        (new Date(currentBooking.checkOut).getTime() -
          new Date(currentBooking.checkIn).getTime()) /
          (1000 * 3600 * 24),
      );
      const newCheckIn = new Date(newDateStr);
      const newCheckOut = new Date(newCheckIn);
      newCheckOut.setDate(newCheckIn.getDate() + duration);
      const targetRow = gridRows.find(
        (r) => r.id === newRoomNumber && r.type === "room",
      );
      const newRoomTypeId = targetRow?.parentId || currentBooking.roomTypeId;

      const updatedBooking = {
        ...currentBooking,
        roomNumber: newRoomNumber,
        roomTypeId: newRoomTypeId,
        checkIn: newDateStr,
        checkOut: newCheckOut.toISOString().split("T")[0],
        timestamp: Date.now(),
      };

      setLastMovedBookingId(active.id);
      setTimeout(() => setLastMovedBookingId(null), 1500);

      // Update local state and then persist
      setSyncEvents((prev) =>
        prev.map((e) =>
          e.id === active.id && e.type === "booking"
            ? ({ ...updatedBooking, type: "booking" } as SyncEvent)
            : e,
        ),
      );

      updateBooking(updatedBooking).catch((err) => {
        console.error("Failed to persist drag update", err);
        setToastMessage(`Persistence Error: ${err.message}`);
        setTimeout(() => setToastMessage(null), 3000);
      });
    }
  };

  const handleResizeBooking = async (
    bookingId: string,
    newDuration: number,
  ) => {
    const booking = syncEvents.find(
      (e) => e.id === bookingId && e.type === "booking",
    ) as Booking | undefined;
    if (!booking) return;

    // Calculate nights before the visible timeline
    const bookingStart = new Date(booking.checkIn);
    const timelineStart = new Date(timelineDates[0]);
    const effectiveStart =
      bookingStart < timelineStart ? timelineStart : bookingStart;
    const hiddenNights = Math.round(
      (effectiveStart.getTime() - bookingStart.getTime()) / (1000 * 3600 * 24),
    );

    // Total duration is hidden nights + new visible duration
    const totalDuration = hiddenNights + newDuration;

    const oldDuration = Math.max(
      1,
      Math.ceil(
        (new Date(booking.checkOut).getTime() -
          new Date(booking.checkIn).getTime()) /
          (1000 * 3600 * 24),
      ),
    );

    const roomType = roomTypes.find((rt) => rt.id === booking.roomTypeId);
    const base = roomType?.basePrice || 0;

    let dailyRate = (booking.amount || 0) / oldDuration;

    // HEURISTIC: If the derived dailyRate is suspiciously low but the 'amount' itself matches the base price,
    // the 'amount' was likely storing the daily rate instead of total.
    if (
      oldDuration > 1 &&
      base > 0 &&
      dailyRate < base * 0.6 &&
      Math.abs((booking.amount || 0) - base) < base * 0.3
    ) {
      dailyRate = booking.amount || 0;
    } else if (dailyRate === 0 && base > 0) {
      dailyRate = base;
    }

    const newAmount = dailyRate * totalDuration;

    const newCheckOut = new Date(bookingStart);
    newCheckOut.setDate(bookingStart.getDate() + totalDuration);
    const updated = {
      ...booking,
      checkOut: newCheckOut.toISOString().split("T")[0],
      amount: newAmount,
      timestamp: Date.now(),
    };

    setSyncEvents((prev) =>
      prev.map((e) =>
        e.id === bookingId && e.type === "booking"
          ? ({ ...updated, type: "booking" } as SyncEvent)
          : e,
      ),
    );

    try {
      await updateBooking(updated);
    } catch (err: any) {
      console.error("Failed to persist resize update", err);
      setToastMessage(`Persistence Error: ${err.message}`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleBookingClick = (booking: Booking) => setSelectedBooking(booking);

  const handleUpdateStatusFromProfile = async (
    bookingId: string,
    newStatus: string,
  ) => {
    const booking = syncEvents.find(
      (e) => e.id === bookingId && e.type === "booking",
    ) as Booking | undefined;
    if (!booking) return;

    const updated = {
      ...booking,
      status: newStatus as any,
      timestamp: Date.now(),
    };

    // Optimistically update local state
    setSyncEvents((prev) =>
      prev.map((e) =>
        e.id === bookingId && e.type === "booking"
          ? ({ ...updated, type: "booking" } as SyncEvent)
          : e,
      ),
    );
    if (selectedBooking?.id === bookingId) setSelectedBooking(updated);

    try {
      await updateBooking(updated);
      (window as any).__refreshDashboardData?.();
    } catch (err: any) {
      console.error("Failed to persist status update", err);
      setToastMessage(`Persistence Error: ${err.message}`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleToggleVIPFromProfile = async (bookingId: string) => {
    const booking = syncEvents.find(
      (e) => e.id === bookingId && e.type === "booking",
    ) as Booking | undefined;
    if (!booking) return;

    const updated = {
      ...booking,
      isVIP: !booking.isVIP,
      timestamp: Date.now(),
    };

    setSyncEvents((prev) =>
      prev.map((e) =>
        e.id === bookingId && e.type === "booking"
          ? ({ ...updated, type: "booking" } as SyncEvent)
          : e,
      ),
    );
    if (selectedBooking?.id === bookingId) setSelectedBooking(updated);

    try {
      await updateBooking(updated);
    } catch (err: any) {
      console.error("Failed to persist VIP toggle", err);
      // We could revert local state here if needed
    }
  };

  const handleToggleSettledFromProfile = async (bookingId: string) => {
    const booking = syncEvents.find(
      (e) => e.id === bookingId && e.type === "booking",
    ) as Booking | undefined;
    if (!booking) return;

    const updated = {
      ...booking,
      isSettled: !booking.isSettled,
      timestamp: Date.now(),
    };

    setSyncEvents((prev) =>
      prev.map((e) =>
        e.id === bookingId && e.type === "booking"
          ? ({ ...updated, type: "booking" } as SyncEvent)
          : e,
      ),
    );
    if (selectedBooking?.id === bookingId) setSelectedBooking(updated);

    try {
      await updateBooking(updated);
      setToastMessage(
        updated.isSettled
          ? "Folio marked as Settled"
          : "Folio marked as Unsettled",
      );
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      console.error("Failed to persist settlement update", err);
      setToastMessage(`Persistence Error: ${err.message}`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleUpdateFolioFromProfile = async (
    bookingId: string,
    updatedFolio: FolioItem[],
  ) => {
    const booking = syncEvents.find(
      (e) => e.id === bookingId && e.type === "booking",
    ) as Booking | undefined;
    if (!booking) return;

    const updated = { ...booking, folio: updatedFolio, timestamp: Date.now() };

    setSyncEvents((prev) =>
      prev.map((e) =>
        e.id === bookingId && e.type === "booking"
          ? ({ ...updated, type: "booking" } as SyncEvent)
          : e,
      ),
    );
    if (selectedBooking?.id === bookingId) setSelectedBooking(updated);

    try {
      await updateBooking(updated);
      setToastMessage("Folio updated successfully");
      setTimeout(() => setToastMessage(null), 3000);
      (window as any).__refreshDashboardData?.();
    } catch (err: any) {
      console.error("Failed to update folio", err);
      setToastMessage(`Persistence Error: ${err.message}`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleUpdateSpecialRequestsFromProfile = async (
    bookingId: string,
    requests: string,
  ) => {
    const booking = syncEvents.find(
      (e) => e.id === bookingId && e.type === "booking",
    ) as Booking | undefined;
    if (!booking) return;

    const updated = {
      ...booking,
      specialRequests: requests,
      timestamp: Date.now(),
    };

    setSyncEvents((prev) =>
      prev.map((e) =>
        e.id === bookingId && e.type === "booking"
          ? ({ ...updated, type: "booking" } as SyncEvent)
          : e,
      ),
    );
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

  const handleUpdatePaymentsFromProfile = async (
    bookingId: string,
    payments: Payment[],
  ) => {
    const booking = syncEvents.find(
      (e) => e.id === bookingId && e.type === "booking",
    ) as Booking | undefined;
    if (!booking) return;

    const updated = { ...booking, payments, timestamp: Date.now() };

    setSyncEvents((prev) =>
      prev.map((e) =>
        e.id === bookingId && e.type === "booking"
          ? ({ ...updated, type: "booking" } as SyncEvent)
          : e,
      ),
    );
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

  const handleUpdateBooking = async (updatedBooking: Booking) => {
    // Optimistically update local state
    setSyncEvents((prev) =>
      prev.map((e) =>
        e.id === updatedBooking.id && e.type === "booking"
          ? ({ ...updatedBooking, type: "booking" } as SyncEvent)
          : e,
      ),
    );
    if (selectedBooking?.id === updatedBooking.id)
      setSelectedBooking(updatedBooking);

    try {
      const response = await updateBooking(updatedBooking);
      setSyncEvents((prev) =>
        prev.map((e) =>
          e.id === updatedBooking.id && e.type === "booking"
            ? ({ ...response, type: "booking" } as SyncEvent)
            : e,
        ),
      );
      if (selectedBooking?.id === updatedBooking.id)
        setSelectedBooking(response);
      setToastMessage("Booking updated successfully");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      console.error("Failed to update booking", err);
      setToastMessage(`Persistence Error: ${err.message}`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const updateEventChannelStatus = (
    eventId: string,
    channel: string,
    status: ChannelStatus,
  ) => {
    setSyncEvents((prev) =>
      prev.map((e) => {
        if (e.id === eventId) {
          return {
            ...e,
            channelSync: { ...(e.channelSync || {}), [channel]: status },
          };
        }
        return e;
      }),
    );
  };

  const simulateFanOut = async (eventId: string, label: string) => {
    const activeChannels = connections.filter((c) => c.status === "connected");
    activeChannels.forEach(async (channel) => {
      // Check for STOP SELL Master Switch
      if (channel.isStopped) {
        updateEventChannelStatus(eventId, channel.name, "stopped");
        return;
      }

      updateEventChannelStatus(eventId, channel.name, "pending");
      const latency = 1000 + Math.random() * 2000;
      await new Promise((resolve) => setTimeout(resolve, latency));

      if (Math.random() < 0.1) {
        updateEventChannelStatus(eventId, channel.name, "error");
      } else {
        updateEventChannelStatus(eventId, channel.name, "success");
      }
    });
  };

  const handleCreateBookings = async (data: {
    guestName: string;
    phoneNumber?: string;
    email?: string;
    guestDetails?: Partial<GuestDetails>;
    rooms: Array<{
      roomTypeId: string;
      checkIn: string;
      checkOut: string;
      roomNumber?: string;
      customRate?: number;
      extraAdults?: number;
      extraChildren?: number;
      extraBeds?: number;
    }>;
    source?: "Direct" | "MMT" | "Booking.com" | "Expedia";
  }) => {
    const reservationId = `res-${Date.now()}`;
    // Track rooms already assigned in THIS booking session to avoid duplicates
    const assignedInThisSession: string[] = [];

    const newBookings: Booking[] = data.rooms.map((room, idx) => {
      const roomType = roomTypes.find((rt) => rt.id === room.roomTypeId);
      let assignedRoom = "Unassigned";

      // If a specific room number was requested/pre-filled, try to use it first
      if (room.roomNumber) {
        const isOccupied =
          syncEvents.some(
            (e) =>
              e.type === "booking" &&
              e.roomNumber === room.roomNumber &&
              e.status !== "Cancelled" &&
              e.status !== "Rejected" &&
              e.status !== "CheckedOut" &&
              !(
                new Date(room.checkOut) <= new Date(e.checkIn) ||
                new Date(room.checkIn) >= new Date(e.checkOut)
              ),
          ) || assignedInThisSession.includes(room.roomNumber);

        if (!isOccupied) {
          assignedRoom = room.roomNumber;
          assignedInThisSession.push(room.roomNumber);
        }
      }

      // If no room assigned yet, find first available
      if (assignedRoom === "Unassigned" && roomType && roomType.roomNumbers) {
        for (const roomNum of roomType.roomNumbers) {
          // Check if room is already assigned in this session
          if (assignedInThisSession.includes(roomNum)) {
            continue;
          }
          // Check if room is occupied by existing bookings
          const isOccupied = syncEvents.some(
            (e) =>
              e.type === "booking" &&
              e.roomNumber === roomNum &&
              e.status !== "Cancelled" &&
              e.status !== "Rejected" &&
              e.status !== "CheckedOut" &&
              !(
                new Date(room.checkOut) <= new Date(e.checkIn) ||
                new Date(room.checkIn) >= new Date(e.checkOut)
              ),
          );
          if (!isOccupied) {
            assignedRoom = roomNum;
            assignedInThisSession.push(roomNum); // Mark as taken for this session
            break;
          }
        }
      }
      const duration = Math.max(
        1,
        Math.ceil(
          (new Date(room.checkOut).getTime() -
            new Date(room.checkIn).getTime()) /
            (1000 * 3600 * 24),
        ),
      );

      // Use custom rate if provided (Direct bookings), otherwise use room type base price
      let rate = room.customRate ?? roomType?.basePrice ?? 0;
      if (data.source && data.source !== "Direct") {
        // For OTA bookings, apply markup to base price (custom rate not applicable)
        rate = roomType?.basePrice || 0;
        const conn = connections.find((c) => c.name === data.source);
        if (conn && conn.markupValue) {
          if (conn.markupType === "percentage") {
            rate = rate + (rate * conn.markupValue) / 100;
          } else if (conn.markupType === "fixed") {
            rate = rate + conn.markupValue;
          }
        }
      }
      let totalAmount = rate * duration;

      // Add extra charges
      const extraAdults = room.extraAdults || 0;
      const extraChildren = room.extraChildren || 0;
      const extraBeds = room.extraBeds || 0;

      if (roomType) {
        totalAmount += extraAdults * (roomType.extraAdultRate || 0) * duration;
        totalAmount +=
          extraChildren * (roomType.extraChildRate || 0) * duration;
        totalAmount += extraBeds * (roomType.extraBedCharge || 0) * duration;
      }

      return {
        id: `${(data.source || "Direct").toLowerCase().replace(/[^a-z0-9]/g, "")}-${Date.now()}-${idx}`,
        guestName: data.guestName,
        roomTypeId: room.roomTypeId,
        roomNumber: assignedRoom,
        checkIn: room.checkIn,
        checkOut: room.checkOut,
        status: "Confirmed",
        source: data.source || "Direct",
        timestamp: Date.now(),
        amount: totalAmount,
        numberOfRooms: data.rooms.length,
        extraAdults: room.extraAdults || 0,
        extraChildren: room.extraChildren || 0,
        extraBeds: room.extraBeds || 0,
        reservationId,
        channelSync: {},
        guestDetails: {
          name: data.guestName,
          phoneNumber: data.phoneNumber || "",
          email: data.email || "",
          ...(data.guestDetails || {}),
        },
      } as Booking;
    });

    // Optimistic Update: Show immediately before server response
    const optimisticEvents = newBookings.map(
      (b) => ({ ...b, type: "booking" }) as SyncEvent,
    );
    setSyncEvents((prev) => [...prev, ...optimisticEvents]);
    setIsNewBookingModalOpen(false);

    try {
      const savedBookings = await createBulkBookings(newBookings);

      // Confirm with server response (update optimistic entries with real data)
      setSyncEvents((prev) =>
        prev.map((e) => {
          const saved = savedBookings.find((s) => s.id === e.id);
          return saved ? ({ ...saved, type: "booking" } as SyncEvent) : e;
        }),
      );

      setToastMessage(`Successfully booked ${savedBookings.length} rooms!`);
      setTimeout(() => setToastMessage(null), 3000);

      // Trigger immediate notification check for better UX
      (window as any).__refreshDashboardData?.();

      // Trigger Fan-Out for each booking in the multi-room set
      savedBookings.forEach((booking) => {
        simulateFanOut(
          booking.id,
          `New Direct Booking for ${booking.guestName}`,
        );
      });
    } catch (error: any) {
      console.error("Failed to create bookings", error);
      // Rollback optimistic update on failure
      setSyncEvents((prev) =>
        prev.filter((e) => !newBookings.find((nb) => nb.id === e.id)),
      );
      setIsNewBookingModalOpen(true);
      // Try to parse the error detail from the response
      let errorMsg = "Could not save bookings. Please try again.";
      if (error.message) {
        errorMsg =
          typeof error.message === "string"
            ? error.message
            : JSON.stringify(error.message);
      }
      setToastMessage(`Error: ${errorMsg}`);
      setTimeout(() => setToastMessage(null), 5000);

      // Refresh bookings to get latest state
      try {
        const latestBookings = await fetchBookings();
        setSyncEvents((prev) => {
          const nonBookings = prev.filter((e) => e.type !== "booking");
          return [
            ...nonBookings,
            ...latestBookings.map(
              (b) => ({ ...b, type: "booking" }) as SyncEvent,
            ),
          ];
        });
      } catch (refreshErr) {
        console.error("Failed to refresh bookings", refreshErr);
      }
    }
  };

  // Panning Event Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    if ((e.target as HTMLElement).closest(".cursor-pointer")) return;
    if (
      (e.target as HTMLElement).tagName === "BUTTON" ||
      (e.target as HTMLElement).tagName === "INPUT"
    )
      return;

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

  const getBookingForCell = (roomNumber: string, date: string) => {
    // 1. Find the booking that occupies this room on this date
    const booking = assignedBookings.find(
      (b) =>
        b.roomNumber === roomNumber && b.checkIn <= date && b.checkOut > date,
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
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      collisionDetection={pointerWithin}
    >
      <div className="flex h-full bg-[#f8fafc] font-inter relative overflow-hidden">
        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
          <header className="px-6 py-4 flex items-center justify-between bg-white border-b border-slate-100 z-[60] shadow-sm relative shrink-0">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
                  <LayoutGrid className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 leading-none">
                    Front Desk
                  </h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    Grid System v3.0
                  </p>
                </div>
              </div>
              <div className="h-8 w-px bg-slate-100 mx-2"></div>
              <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm h-12">
                <button
                  onClick={() => {
                    const d = new Date();
                    d.setHours(0, 0, 0, 0);
                    if (viewMode === "week") d.setDate(d.getDate() - 1);
                    setStartDate(d);
                  }}
                  className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-all"
                >
                  Today
                </button>
                <div className="w-px h-4 bg-slate-200 self-center mx-1"></div>
                <button
                  onClick={() => {
                    const d = new Date(startDate);
                    if (viewMode === "day") d.setDate(d.getDate() - 1);
                    else if (viewMode === "month") d.setMonth(d.getMonth() - 1);
                    else d.setDate(d.getDate() - 7);
                    setStartDate(d);
                  }}
                  className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    const d = new Date(startDate);
                    if (viewMode === "day") d.setDate(d.getDate() + 1);
                    else if (viewMode === "month") d.setMonth(d.getMonth() + 1);
                    else d.setDate(d.getDate() + 7);
                    setStartDate(d);
                  }}
                  className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <div className="w-px h-4 bg-slate-200 self-center mx-1"></div>

                <div className="relative group">
                  <button className="h-full px-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 rounded-lg transition-all">
                    {viewMode} View
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                  </button>
                  <div className="absolute top-full right-0 mt-1 w-32 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-[100] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    {(["day", "week", "month"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setViewMode(v)}
                        className={`w-full text-left px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-50 transition-colors ${viewMode === v ? "text-indigo-600 bg-indigo-50/50" : "text-slate-500"}`}
                      >
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  className="relative flex items-center px-4 hover:bg-slate-50 transition-all rounded-lg cursor-pointer"
                  onClick={() => jumpDateRef.current?.showPicker()}
                >
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 ml-2 min-w-[120px] text-center">
                    {viewMode === "month"
                      ? startDate.toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric",
                        })
                      : viewMode === "day"
                        ? formatDate(startDate.toISOString().split("T")[0])
                        : `${formatDate(startDate.toISOString().split("T")[0])} - 14 Days`}
                  </span>
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
                    className="absolute inset-0 opacity-0 cursor-pointer pointer-events-none"
                  />
                </div>
              </div>
            </div>
            {connections.filter((c) => c.isStopped).length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-600 rounded-xl animate-pulse">
                <ShieldAlert className="w-4 h-4" />
                <span className="text-[9px] font-black uppercase tracking-widest">
                  {connections.filter((c) => c.isStopped).length} Channels
                  Stopped
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setIsAutoBookingsOpen(!isAutoBookingsOpen)}
                  className={`h-12 flex items-center gap-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${autoBookings.length > 0 ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100" : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"}`}
                >
                  <Mail
                    className={`w-3.5 h-3.5 ${autoBookings.length > 0 ? "animate-bounce" : ""}`}
                  />
                  {autoBookings.length > 0 ? (
                    <>
                      <span>{autoBookings.length} New</span>
                    </>
                  ) : (
                    <span className="hidden sm:inline">Idle</span>
                  )}
                </button>

                {isAutoBookingsOpen && autoBookings.length > 0 && (
                  <div className="absolute top-full right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">
                        Recent AI Parsing
                      </span>
                      <button
                        onClick={() => setIsAutoBookingsOpen(false)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="max-h-96 overflow-auto">
                      {autoBookings.map((b) => (
                        <div
                          key={b.id}
                          onClick={() => {
                            setSelectedBooking(b);
                            setIsAutoBookingsOpen(false);
                          }}
                          className="p-4 border-b border-slate-50 hover:bg-indigo-50/50 cursor-pointer transition-all group"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-lg">
                              {b.source}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 tabular-nums">
                              {new Date(b.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="font-black text-slate-900 text-sm tracking-tighter uppercase mb-0.5">
                            {b.guestName}
                          </p>
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold text-slate-500">
                              {formatDate(b.checkIn)} - {formatDate(b.checkOut)}
                            </p>
                            <div className="flex items-center gap-1 text-[9px] font-black text-indigo-400 opacity-0 group-hover:opacity-100 transition-all">
                              MAPPING <ArrowRightCircle className="w-3 h-3" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setIsNewBookingModalOpen(true)}
                className="h-12 flex items-center gap-2 px-6 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl hover:scale-105 active:scale-95"
              >
                <Plus className="w-4 h-4" /> New Booking
              </button>

              {/* Live Activity Toggle Button - Only visible when panel is closed */}
              {!isActivityPanelOpen && (
                <button
                  onClick={() => setIsActivityPanelOpen(true)}
                  className="h-12 w-12 flex items-center justify-center rounded-xl bg-white border-2 border-slate-100 text-slate-400 hover:border-amber-300 hover:text-amber-500 hover:bg-amber-50 transition-all shrink-0 shadow-sm"
                  title="Open Live Activity"
                >
                  <Zap className="w-5 h-5" />
                </button>
              )}
            </div>
          </header>

          <div
            ref={scrollContainerRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            className={`flex-1 overflow-auto custom-scrollbar bg-slate-50/50 ${isPanning ? "cursor-grabbing select-none" : ""}`}
          >
            <div
              className={`${viewMode === "week" ? "min-w-max pb-24" : "h-full flex flex-col pt-4"}`}
            >
              {/* FROZEN DATES PANE (VERTICAL STICKY) - Only for Week/Timeline view */}
              {viewMode === "week" && (
                <div
                  className={`sticky top-0 z-[55] flex gap-3 px-6 py-4 bg-[#f8fafc]/95 backdrop-blur-sm border-b border-slate-200/50 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.1)] cursor-grab ${isPanning ? "cursor-grabbing" : ""}`}
                  style={{ height: STICKY_HEADER_TOTAL_HEIGHT }}
                  onMouseDown={handleMouseDown}
                >
                  {/* Left Card - Matches Room Rows */}
                  <div className="w-44 h-[72px] shrink-0 bg-white rounded-2xl shadow-xl border border-slate-300/30 px-6 flex flex-col justify-center sticky left-0 z-[56]">
                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">
                      Grid Context
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-black text-slate-800 tracking-tighter">
                        Inventory
                      </span>
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
                      {timelineDates.map((date) => {
                        const d = new Date(date);
                        const isToday =
                          new Date().toDateString() === d.toDateString();
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                        return (
                          <div
                            key={date}
                            className={`flex flex-col items-center justify-center border-r border-slate-100 last:border-0 shrink-0 overflow-hidden relative ${isWeekend ? "bg-slate-50/50" : ""} ${isToday ? "bg-cyan-400/10 ring-2 ring-inset ring-cyan-400/40 z-10" : ""}`}
                            style={{ width: CELL_WIDTH }}
                          >
                            {isToday && (
                              <div className="absolute inset-x-0 top-0 h-full border-x-2 border-cyan-400/30 pointer-events-none"></div>
                            )}
                            <span
                              className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${isToday ? "text-cyan-600" : "text-slate-400"}`}
                            >
                              {d.toLocaleDateString("en-US", {
                                weekday: "short",
                              })}
                            </span>
                            <div
                              className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-black transition-all tabular-nums ${isToday ? "bg-cyan-600 text-white shadow-lg shadow-cyan-200" : "text-slate-800"}`}
                            >
                              {d.getDate()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div
                className={`${viewMode === "week" ? "px-6 space-y-3 pt-6" : "px-6 flex-1 flex flex-col"}`}
              >
                {isLoading ? (
                  <div className="space-y-4 animate-pulse">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex flex-col md:flex-row gap-3">
                        <div className="w-full md:w-44 h-[48px] bg-slate-200 rounded-xl shrink-0"></div>
                        <div className="flex-1 h-[48px] bg-slate-200 rounded-xl"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  (() => {
                    const todayStrLocal = new Date().toLocaleDateString(
                      "en-CA",
                    );
                    const todayIndex = timelineDates.indexOf(todayStrLocal);

                    return (
                      <>
                        {viewMode === "month" ? (
                          <div
                            className="grid grid-cols-7 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500 flex-1 min-h-0"
                            style={{
                              gridTemplateRows: `auto repeat(${Math.ceil(timelineDates.length / 7)}, 1fr)`,
                            }}
                          >
                            {[
                              "Sun",
                              "Mon",
                              "Tue",
                              "Wed",
                              "Thu",
                              "Fri",
                              "Sat",
                            ].map((day) => (
                              <div
                                key={day}
                                className="py-2.5 bg-slate-50 border-b border-r border-slate-100 last:border-r-0 text-center flex items-center justify-center"
                              >
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                  {day}
                                </span>
                              </div>
                            ))}
                            {timelineDates.map((date) => {
                              const d = new Date(date);
                              const isToday =
                                d.toDateString() === new Date().toDateString();
                              const isCurrentMonth =
                                d.getMonth() === startDate.getMonth();
                              const dayBookings = assignedBookings.filter(
                                (b) =>
                                  b.checkIn <= date &&
                                  b.checkOut > date &&
                                  (b.status === "Confirmed" ||
                                    b.status === "CheckedIn" ||
                                    b.status === "CheckedOut"),
                              );

                              return (
                                <div
                                  key={date}
                                  className={`p-2 border-b border-r border-slate-100 last:border-r-0 transition-all hover:bg-slate-50/50 relative group flex flex-col min-h-0 ${!isCurrentMonth ? "bg-slate-50/30 opacity-40 text-slate-300" : "bg-white"}`}
                                  onClick={() => {
                                    setBookingPrefill({
                                      checkIn: date,
                                      roomTypeId: roomTypes[0]?.id || "",
                                    });
                                    setIsNewBookingModalOpen(true);
                                  }}
                                >
                                  <div className="flex justify-between items-start mb-0.5">
                                    <span
                                      className={`w-5 h-5 flex items-center justify-center rounded-full text-[9px] font-black tabular-nums transition-all ${isToday ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-slate-800"}`}
                                    >
                                      {d.getDate()}
                                    </span>
                                    {dayBookings.length > 0 && (
                                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-1.5 py-0.5 rounded-md">
                                        {dayBookings.length}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex-1 space-y-1 overflow-hidden">
                                    {dayBookings.slice(0, 4).map((b) => (
                                      <div
                                        key={b.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedBooking(b);
                                        }}
                                        className={`px-2 py-1 rounded-md text-[10px] font-black text-white truncate uppercase tracking-tight cursor-pointer hover:brightness-110 shadow-sm ${STATUS_STYLES[b.status] || "bg-indigo-600"}`}
                                      >
                                        {b.guestName}
                                      </div>
                                    ))}
                                    {dayBookings.length > 4 && (
                                      <div className="text-[9px] font-black text-indigo-500 text-center uppercase tracking-widest">
                                        + {dayBookings.length - 4}
                                      </div>
                                    )}
                                  </div>
                                  <div className="absolute inset-0 border-2 border-indigo-500 opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none rounded-lg"></div>
                                </div>
                              );
                            })}
                          </div>
                        ) : viewMode === "day" ? (
                          <div className="flex-1 flex flex-col gap-6 animate-in slide-in-from-left-4 duration-500 min-h-0 overflow-y-auto pt-4">
                            <div className="grid grid-cols-1 gap-4">
                              {gridRows.map((row) => {
                                if (row.type === "header") {
                                  const categoryIndex = roomTypes.findIndex(
                                    (rt) => rt.id === row.id,
                                  );
                                  const gradientStyle =
                                    CATEGORY_GRADIENTS[
                                      categoryIndex >= 0
                                        ? categoryIndex %
                                          CATEGORY_GRADIENTS.length
                                        : 0
                                    ];
                                  const isExpanded =
                                    effectiveExpandedTypes[row.id];
                                  return (
                                    <div
                                      key={row.id}
                                      onClick={() => toggleExpand(row.id)}
                                      className="mt-6 first:mt-0 rounded-2xl shadow-xl px-5 py-3 flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] border border-white/20 relative overflow-hidden group"
                                      style={gradientStyle}
                                    >
                                      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
                                      <div className="flex items-center gap-3 relative z-10">
                                        <div className="p-2 bg-black/20 rounded-lg text-white shadow-inner">
                                          <Bed className="w-5 h-5" />
                                        </div>
                                        <div className="flex flex-col">
                                          <span className="text-sm font-black text-white uppercase tracking-tight shadow-sm">
                                            {row.name}
                                          </span>
                                          <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest border-l-2 border-white/30 pl-2 mt-0.5">
                                            {row.capacity || 0} Units
                                          </span>
                                        </div>
                                      </div>
                                      <div className="p-2 bg-white/20 rounded-lg text-white hover:bg-white/30 transition-colors shadow-sm relative z-10">
                                        {isExpanded ? (
                                          <Minimize2 className="w-4 h-4" />
                                        ) : (
                                          <Maximize2 className="w-4 h-4" />
                                        )}
                                      </div>
                                    </div>
                                  );
                                }
                                const dayBooking = getBookingForCell(
                                  row.id,
                                  timelineDates[0],
                                );
                                return (
                                  <div
                                    key={row.id}
                                    className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-lg border border-slate-200 group hover:border-indigo-400 transition-all"
                                  >
                                    <div className="w-32 shrink-0">
                                      <span className="text-xl font-black text-slate-900">
                                        {row.name}
                                      </span>
                                    </div>
                                    <div className="flex-1 min-h-[60px] relative rounded-lg bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center">
                                      {dayBooking ? (
                                        <div
                                          onClick={() =>
                                            setSelectedBooking(dayBooking)
                                          }
                                          className={`w-full h-[60px] flex items-center justify-between px-6 rounded-lg text-white cursor-pointer shadow-lg animate-in fade-in zoom-in-95 ${STATUS_STYLES[dayBooking.status] || "bg-indigo-600"}`}
                                        >
                                          <div className="flex flex-col gap-0.5">
                                            <span className="text-lg font-black uppercase tracking-tight leading-none">
                                              {dayBooking.guestName}
                                            </span>
                                            <span className="text-[10px] font-bold opacity-80 uppercase tracking-widest leading-tight">
                                              {dayBooking.source} •{" "}
                                              {dayBooking.checkIn} to{" "}
                                              {dayBooking.checkOut}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-4">
                                            {dayBooking.isVIP && (
                                              <Star className="w-5 h-5 text-amber-300 fill-amber-300" />
                                            )}
                                            <div className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest">
                                              View Details
                                            </div>
                                          </div>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => {
                                            setBookingPrefill({
                                              checkIn: timelineDates[0],
                                              roomTypeId: row.parentId || "",
                                              roomId: row.id,
                                            });
                                            setIsNewBookingModalOpen(true);
                                          }}
                                          className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-widest text-[10px] hover:text-indigo-600 transition-colors"
                                        >
                                          <Plus className="w-4 h-4" /> Available
                                          for Check-In
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Daily Occupancy Summary Row */}
                            <div className="flex flex-col md:flex-row gap-3 items-center mb-1 animate-in fade-in slide-in-from-top-2 duration-500">
                              <div
                                className="w-full md:w-44 shrink-0 px-4 flex items-center h-[32px] sticky left-0 z-40 bg-white/80 backdrop-blur-md rounded-xl border border-slate-200/50 shadow-sm"
                                style={{
                                  background:
                                    "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
                                }}
                              >
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                  <Zap className="w-3 h-3 text-amber-500 animate-pulse" />
                                  Total Booked
                                </span>
                              </div>
                              <div className="flex-1 flex overflow-hidden rounded-xl bg-white border border-slate-200/50 h-[32px] items-center shadow-sm">
                                {timelineDates.map((date, idx) => {
                                  const isToday =
                                    new Date().toDateString() ===
                                    new Date(date).toDateString();
                                  return (
                                    <div
                                      key={date}
                                      style={{ width: CELL_WIDTH }}
                                      className={`shrink-0 flex items-center justify-center border-r border-slate-100 last:border-0 h-full transition-colors ${isToday ? "bg-cyan-50/50" : "hover:bg-slate-50"}`}
                                    >
                                      <div
                                        className={`px-2 py-0.5 rounded-md text-[11px] font-black tabular-nums transition-all ${dailyOccupancy[idx] > 0 ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-110" : "text-slate-300"}`}
                                      >
                                        {dailyOccupancy[idx]}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {gridRows.map((row) => {
                              const isHeader = row.type === "header";
                              const effectiveExpandedTypes =
                                Object.keys(expandedTypes).length === 0
                                  ? Object.fromEntries(
                                      roomTypes.map((rt) => [rt.id, true]),
                                    )
                                  : expandedTypes;

                              if (isHeader) {
                                // Re-using the high-fidelity header logic from before
                                const occupiedCount = assignedBookings.filter(
                                  (b) =>
                                    b.roomTypeId === row.id &&
                                    b.status !== "Cancelled" &&
                                    b.status !== "Rejected" &&
                                    b.checkIn <= todayStrLocal &&
                                    b.checkOut > todayStrLocal,
                                ).length;
                                const categoryIndex = roomTypes.findIndex(
                                  (rt) => rt.id === row.id,
                                );
                                const gradientStyle =
                                  CATEGORY_GRADIENTS[
                                    categoryIndex >= 0
                                      ? categoryIndex %
                                        CATEGORY_GRADIENTS.length
                                      : 0
                                  ];
                                return (
                                  <div
                                    key={row.id}
                                    className="sticky top-[72px] z-30 flex flex-col md:flex-row gap-3 pt-3"
                                  >
                                    <div
                                      onClick={() => toggleExpand(row.id)}
                                      className="h-[48px] w-full md:w-44 shrink-0 rounded-xl shadow-xl px-3 py-1 flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] border border-white/20 backdrop-blur-lg relative overflow-hidden group sticky left-0 z-40"
                                      style={gradientStyle}
                                    >
                                      <div
                                        className="absolute inset-0 pointer-events-none"
                                        style={{
                                          background:
                                            "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 100%)",
                                        }}
                                      ></div>
                                      <div className="flex items-center gap-2 relative z-10">
                                        <div className="p-1.5 bg-black/30 rounded-lg text-white shadow-inner shrink-0">
                                          <Bed className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="flex flex-col justify-center min-w-0">
                                          <span className="font-black text-[10px] text-white block tracking-tight leading-none truncate uppercase">
                                            {row.name}
                                          </span>
                                          <span className="text-[7px] text-white/80 font-bold uppercase tracking-widest leading-none mt-1">
                                            {row.capacity} Units
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 relative z-10">
                                        <div className="p-1 bg-white/20 rounded-md text-white hover:bg-white/30 transition-colors shadow-sm shrink-0">
                                          {effectiveExpandedTypes[row.id] ? (
                                            <Minimize2 className="w-3 h-3" />
                                          ) : (
                                            <Maximize2 className="w-3 h-3" />
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="hidden md:flex flex-1 bg-slate-200/40 rounded-2xl items-center relative overflow-hidden group/lane h-[48px]">
                                      <div className="h-px bg-slate-300/50 absolute left-0 right-0 top-1/2 -translate-y-1/2 z-0"></div>
                                      {todayIndex !== -1 && (
                                        <div
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleExpand(row.id);
                                          }}
                                          className="absolute z-20 flex items-center justify-center h-full border-x-2 border-cyan-400/40 bg-cyan-400/10 shadow-[0_0_20px_rgba(34,211,238,0.1)] transition-all duration-500 cursor-pointer group/today-col hover:bg-cyan-400/20"
                                          style={{
                                            width: CELL_WIDTH,
                                            left: todayIndex * CELL_WIDTH,
                                          }}
                                        >
                                          <div className="flex items-center gap-2 bg-white/95 backdrop-blur-md px-3 py-1 rounded-full border-2 border-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,0.2)] group-hover/today-col:border-cyan-400 group-hover/today-col:shadow-cyan-400/30 group-active/today-col:scale-95 transition-all duration-200 select-none group/badge">
                                            <span className="text-[9px] font-black text-cyan-600 uppercase tracking-widest flex items-center gap-1">
                                              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse group-hover/badge:scale-125 transition-transform"></div>
                                              Today
                                            </span>
                                            <span className="text-sm font-black text-slate-900 tabular-nums">
                                              {occupiedCount}
                                            </span>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase">
                                              / {row.capacity}
                                            </span>
                                          </div>
                                        </div>
                                      )}
                                      <div className="relative z-10 flex-1 flex items-center justify-end px-6 opacity-0 group-hover/lane:opacity-100 transition-opacity">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                          Click heading to{" "}
                                          {effectiveExpandedTypes[row.id]
                                            ? "collapse"
                                            : "expand"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }

                              const securityStatus = roomSecurity.find(
                                (rs) => rs.room_id === row.id,
                              );
                              const isAlerted =
                                securityStatus &&
                                (securityStatus.failCount >= 3 ||
                                  securityStatus.isLocked);

                              const roomStatus = roomStatuses.find(
                                (s) => s.roomNumber === row.id,
                              );
                              const status = isAlerted
                                ? "Alert"
                                : roomStatus?.status || "Clean";

                              let statusColor =
                                "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]";
                              let statusLabel = "Clean & Ready";
                              let statusTextColor = "text-slate-500";
                              let statusBg = "";
                              let statusBorder = "border-slate-300/30";

                              if (isAlerted) {
                                statusColor =
                                  "bg-amber-500 shadow-[0_0_10px_rgba(251,191,36,1)] animate-pulse";
                                statusLabel = "Alert Active";
                                statusTextColor = "text-amber-700";
                                statusBg = "bg-amber-100 ring-2 ring-amber-400";
                                statusBorder = "border-amber-500";
                              } else if (status === "Dirty") {
                                statusColor = "bg-rose-500";
                                statusLabel = "Dirty";
                                statusTextColor = "text-rose-600";
                                statusBorder = "border-rose-200";
                                statusBg = "bg-rose-50";
                              } else if (status === "OutOfOrder") {
                                statusColor = "bg-red-500 animate-pulse";
                                statusLabel = "MAINTENANCE";
                                statusTextColor = "text-white/90";
                                statusBg = "bg-slate-800";
                                statusBorder = "border-slate-900";
                              }

                              const categoryIndex = row.parentId
                                ? roomTypes.findIndex(
                                    (rt) => rt.id === row.parentId,
                                  )
                                : -1;
                              const rowTintStyle =
                                categoryIndex >= 0
                                  ? ROW_TINTS[categoryIndex % ROW_TINTS.length]
                                  : { backgroundColor: "#ffffff" };
                              const labelTintStyle =
                                categoryIndex >= 0
                                  ? LABEL_TINTS[
                                      categoryIndex % LABEL_TINTS.length
                                    ]
                                  : { backgroundColor: "#ffffff" };

                              const effectiveRowStyle =
                                status === "OutOfOrder"
                                  ? {
                                      backgroundImage:
                                        "repeating-linear-gradient(45deg, #f1f5f9 0px, #f1f5f9 10px, #e2e8f0 10px, #e2e8f0 20px)",
                                      opacity: 0.8,
                                    }
                                  : rowTintStyle;

                              return (
                                <div
                                  key={row.id}
                                  className="flex flex-col md:flex-row gap-3 group animate-in slide-in-from-top-2 fade-in duration-300 ease-out fill-mode-forwards"
                                >
                                  <div className="w-full md:w-44 md:sticky md:left-0 z-20 shrink-0">
                                    <div
                                      className={`h-[48px] w-full ${statusBg} rounded-xl shadow-lg border ${statusBorder} px-3 py-1 flex flex-col justify-center hover:shadow-indigo-500/10 transition-all group-hover:border-indigo-400/50 relative overflow-hidden`}
                                      style={
                                        isAlerted || statusBg
                                          ? {}
                                          : labelTintStyle
                                      }
                                    >
                                      <div
                                        className={`absolute top-0 left-0 w-1.5 h-full ${isAlerted ? "bg-amber-600" : "bg-indigo-600"} opacity-0 group-hover:opacity-100 transition-opacity`}
                                      ></div>
                                      <div className="flex justify-between items-center">
                                        <span
                                          className={`text-lg font-black ${isAlerted ? "text-amber-900" : status === "OutOfOrder" ? "text-white" : "text-slate-900"} tabular-nums tracking-tighter`}
                                        >
                                          {row.name}
                                        </span>
                                        <div
                                          className={`w-2 h-2 rounded-full ${statusColor}`}
                                        ></div>
                                      </div>
                                      <span
                                        className={`text-[8px] font-black ${statusTextColor} uppercase tracking-[0.2em] leading-none`}
                                      >
                                        {statusLabel}
                                      </span>
                                    </div>
                                  </div>
                                  <div
                                    className="flex-1 rounded-xl shadow-2xl border border-black/10 relative flex overflow-hidden hover:shadow-indigo-900/10 transition-all"
                                    style={effectiveRowStyle}
                                  >
                                    {timelineDates.map((date) => {
                                      const booking = getBookingForCell(
                                        row.id,
                                        date,
                                      );
                                      const d = new Date(date);
                                      return (
                                        <DroppableCell
                                          key={date}
                                          date={date}
                                          roomNumber={row.id}
                                          isWeekend={
                                            d.getDay() === 0 || d.getDay() === 6
                                          }
                                          isToday={
                                            new Date().toDateString() ===
                                            d.toDateString()
                                          }
                                          onClick={() => {
                                            if (!booking && canCreate) {
                                              setBookingPrefill({
                                                checkIn: date,
                                                roomTypeId: row.parentId || "",
                                                roomId: row.id,
                                              });
                                              setIsNewBookingModalOpen(true);
                                            }
                                          }}
                                        >
                                          {booking &&
                                            (() => {
                                              const bookingStart = new Date(
                                                booking.checkIn,
                                              );
                                              const timelineStart = new Date(
                                                timelineDates[0],
                                              );
                                              const effectiveStart =
                                                bookingStart < timelineStart
                                                  ? timelineStart
                                                  : bookingStart;
                                              const bookingEnd = new Date(
                                                booking.checkOut,
                                              );
                                              const visualDuration = Math.ceil(
                                                (bookingEnd.getTime() -
                                                  effectiveStart.getTime()) /
                                                  (1000 * 3600 * 24),
                                              );

                                              return (
                                                <DraggableBooking
                                                  booking={booking}
                                                  duration={visualDuration}
                                                  onResize={(newDur) =>
                                                    handleResizeBooking(
                                                      booking.id,
                                                      newDur,
                                                    )
                                                  }
                                                  onSelect={handleBookingClick}
                                                  isJustMoved={
                                                    booking.id ===
                                                    lastMovedBookingId
                                                  }
                                                  canEdit={canEdit}
                                                />
                                              );
                                            })()}
                                        </DroppableCell>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        )}
                      </>
                    );
                  })()
                )}
              </div>
            </div>
          </div>
        </div>

        {isActivityPanelOpen && (
          <div className="w-56 bg-white border-l border-slate-200 h-full overflow-y-auto hidden lg:flex flex-col shrink-0 z-30 shadow-2xl custom-scrollbar animate-in slide-in-from-right-10 duration-300">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-md font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                  Live Activity
                </h3>
                <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-widest">
                  {new Date().toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
              <button
                onClick={() => setIsActivityPanelOpen(false)}
                className="p-2 hover:bg-slate-200/50 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 p-3 space-y-4">
              <div className="space-y-2 p-2 bg-indigo-50/40 rounded-xl border border-indigo-100/50">
                <div className="flex items-center justify-between">
                  <h4 className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    Today's Arrivals
                  </h4>
                  <span className="text-[8px] font-black bg-indigo-600 text-white px-1.5 py-0.5 rounded-md shadow-md">
                    {todaysArrivals.length}
                  </span>
                </div>
                {todaysArrivals.length === 0 ? (
                  <div className="text-center py-3 text-slate-400 text-[8px] font-black uppercase tracking-widest bg-white rounded-xl border border-slate-100">
                    All Checked In
                  </div>
                ) : (
                  todaysArrivals.map((b: any) => (
                    <div
                      key={b.id}
                      className="p-2 bg-white border border-slate-100 rounded-lg shadow-sm hover:shadow-lg transition-all group border-l-2 border-l-indigo-600"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-[10px] shrink-0 shadow-inner border border-indigo-100">
                          {b.guestName
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .substring(0, 2)
                            .toUpperCase()}
                        </div>
                        <div className="overflow-hidden flex-1">
                          <p className="font-black text-slate-900 text-[10px] truncate tracking-tighter uppercase">
                            {b.guestName}
                          </p>
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            <span className="inline-flex items-center gap-0.5 text-[6px] font-black text-amber-600 bg-amber-50 px-1 py-0.5 rounded uppercase tracking-widest border border-amber-100">
                              Awaiting ID
                            </span>
                            {b._roomCount > 1 && (
                              <span className="inline-flex items-center gap-0.5 text-[6px] font-black text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded uppercase tracking-widest border border-indigo-100">
                                {b._roomCount} Rooms
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mb-2 px-1">
                        <div className="text-[8px] text-slate-500 font-bold uppercase tracking-widest truncate">
                          {b._roomCount > 1
                            ? "Multi-Room"
                            : roomTypes.find((r) => r.id === b.roomTypeId)
                                ?.name || "Standard"}
                          <span className="font-black text-indigo-600 ml-1 bg-indigo-50 px-1 py-0.5 rounded shadow-sm">
                            #{b.roomNumber || "TBD"}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedBooking(b)}
                        className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[8px] font-black uppercase tracking-[0.2em] rounded-md transition-all shadow-md shadow-indigo-200 flex items-center justify-center gap-2"
                      >
                        Check-In <ArrowRightCircle className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="space-y-2 p-2 bg-rose-50/40 rounded-xl border border-rose-100/50">
                <div className="flex items-center justify-between">
                  <h4 className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    Pending Departures
                  </h4>
                  <span className="text-[8px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded-md shadow-md">
                    {todaysDepartures.length}
                  </span>
                </div>
                {todaysDepartures.length === 0 ? (
                  <div className="text-center py-3 text-slate-400 text-[8px] font-black uppercase tracking-widest bg-white rounded-xl border border-slate-100">
                    None Scheduled
                  </div>
                ) : (
                  todaysDepartures.map((b) => (
                    <div
                      key={b.id}
                      className="p-2 bg-white border border-slate-100 rounded-lg shadow-sm hover:shadow-lg transition-all group border-l-2 border-l-rose-600"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center font-black text-[10px] shrink-0 border border-slate-200">
                          {b.guestName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .substring(0, 2)
                            .toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                          <p className="font-black text-slate-900 text-[10px] truncate tracking-tighter uppercase">
                            {b.guestName}
                          </p>
                          {b.isSettled ? (
                            <span className="inline-flex items-center gap-0.5 text-[6px] font-black text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded uppercase tracking-widest mt-0.5 border border-emerald-100">
                              Paid & Clear
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-[6px] font-black text-rose-600 bg-rose-50 px-1 py-0.5 rounded uppercase tracking-widest mt-0.5 border border-rose-100 animate-pulse">
                              Payment Due
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mb-2 px-1">
                        <div className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">
                          Room{" "}
                          <span className="font-black text-rose-600 ml-1 bg-rose-50 px-1 py-0.5 rounded shadow-sm">
                            #{b.roomNumber}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedBooking(b)}
                        className="w-full py-1.5 bg-slate-900 hover:bg-black text-white text-[8px] font-black uppercase tracking-[0.2em] rounded-md transition-all shadow-xl flex items-center justify-center gap-2"
                      >
                        Process Check-Out <LogOut className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {selectedBooking && (
          <GuestProfilePage
            booking={selectedBooking}
            roomTypes={roomTypes}
            relatedBookings={relatedBookings}
            syncEvents={syncEvents}
            onClose={() => setSelectedBooking(null)}
            onUpdateStatus={handleUpdateStatusFromProfile}
            onToggleVIP={handleToggleVIPFromProfile}
            onToggleSettled={handleToggleSettledFromProfile}
            onUpdateFolio={handleUpdateFolioFromProfile}
            onUpdateSpecialRequests={handleUpdateSpecialRequestsFromProfile}
            onUpdatePayments={handleUpdatePaymentsFromProfile}
            onUpdateBooking={handleUpdateBooking}
            onUpdateExtraBeds={onUpdateExtraBeds}
            propertySettings={propertySettings}
            onEditInventory={() => {
              setToastMessage("Drag and drop to edit inventory.");
              setTimeout(() => setToastMessage(null), 3000);
            }}
            onRoomTransfer={async (
              bookingId,
              newRoomTypeId,
              newRoomNumber,
              effectiveDate,
              keepRate,
              transferFolio,
            ) => {
              try {
                const result = await transferBooking(bookingId, {
                  bookingId,
                  newRoomTypeId,
                  newRoomNumber,
                  effectiveDate,
                  keepRate,
                  transferFolio,
                });

                // Update local state
                setSyncEvents((prev) => {
                  let next = [...prev];
                  const originalIndex = next.findIndex(
                    (e) => e.id === bookingId && e.type === "booking",
                  );

                  if (originalIndex !== -1) {
                    const original = next[originalIndex] as Booking;

                    if (effectiveDate === original.checkIn) {
                      // Case A: Full Transfer
                      next[originalIndex] = {
                        ...result,
                        type: "booking",
                      } as SyncEvent;
                    } else {
                      // Case B: Mid-stay Switch
                      next[originalIndex] = {
                        ...original,
                        checkOut: effectiveDate,
                        timestamp: Date.now(),
                        type: "booking",
                      } as SyncEvent;
                      next.push({ ...result, type: "booking" } as SyncEvent);
                    }
                  } else {
                    next.push({ ...result, type: "booking" } as SyncEvent);
                  }
                  return next;
                });

                setSelectedBooking(result);
                setToastMessage(
                  effectiveDate === result.checkIn
                    ? `Room transferred to ${newRoomNumber}`
                    : `Room switched to ${newRoomNumber} starting ${effectiveDate}`,
                );
                setTimeout(() => setToastMessage(null), 3000);
              } catch (err: any) {
                console.error("Failed to persist room transfer", err);
                setToastMessage(`Error: ${err.message}`);
                setTimeout(() => setToastMessage(null), 5000);
              }
            }}
            onSwitchBooking={(booking) => setSelectedBooking(booking)}
            user={user}
          />
        )}

        <DragOverlay>
          {dragState.activeId &&
            (() => {
              const booking = assignedBookings.find(
                (b) => b.id === dragState.activeId,
              );
              if (!booking) return null;
              const duration = Math.ceil(
                (new Date(booking.checkOut).getTime() -
                  new Date(booking.checkIn).getTime()) /
                  (1000 * 3600 * 24),
              );
              return (
                <DraggableBooking
                  booking={booking}
                  duration={duration}
                  isOverlay={true}
                  isValid={dragState.isValid}
                />
              );
            })()}
        </DragOverlay>
        {toastMessage && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[10000] bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4 border-2 border-indigo-500/50">
            {toastMessage.startsWith("Error") ? (
              <XCircle className="w-6 h-6 text-rose-400" />
            ) : (
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            )}
            <span className="font-black text-sm uppercase tracking-widest">
              {toastMessage}
            </span>
          </div>
        )}

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
          user={user}
        />
      </div>
    </DndContext>
  );
};

export default FrontDeskView;
