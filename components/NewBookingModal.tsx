import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  X,
  Plus,
  Minus,
  Calendar,
  Bed,
  User,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Search,
  Smartphone,
  Mail,
  Sparkles,
  RotateCcw,
  Globe,
} from "lucide-react";
import {
  RoomType,
  Booking,
  SyncEvent,
  GuestDetails,
  UserResponse,
  RateRulesConfig,
  OTAConnection,
} from "../types";
import { lookupGuest } from "../api";

function defaultExtraRatesForRoomType(
  roomTypes: RoomType[],
  roomTypeId: string,
) {
  const rt = roomTypes.find((r) => r.id === roomTypeId);
  return {
    extraAdultRatePerNight: rt?.extraAdultRate ?? 0,
    extraChildRatePerNight: rt?.extraChildRate ?? 0,
    extraBedChargePerNight: rt?.extraBedCharge ?? 0,
  };
}

function stayNightsBetween(checkIn: string, checkOut: string): number {
  const [y1, m1, d1] = checkIn.split("-").map(Number);
  const [y2, m2, d2] = checkOut.split("-").map(Number);
  const a = new Date(y1, m1 - 1, d1);
  const b = new Date(y2, m2 - 1, d2);
  const n = Math.round((b.getTime() - a.getTime()) / (1000 * 3600 * 24));
  return Math.max(1, n);
}

interface NewBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomTypes: RoomType[];
  syncEvents: SyncEvent[];
  onCreateBookings: (data: {
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
      extraAdultRatePerNight?: number;
      extraChildRatePerNight?: number;
      extraBedChargePerNight?: number;
    }>;
    source?: "Direct" | "MMT" | "Booking.com" | "Expedia";
  }) => void;
  prefill?: { checkIn: string; roomTypeId: string; roomId?: string } | null;
  user?: UserResponse | null;
  rules?: RateRulesConfig | null;
  connections?: OTAConnection[];
}

export default function NewBookingModal({
  isOpen,
  onClose,
  roomTypes,
  syncEvents,
  onCreateBookings,
  prefill,
  rules,
  connections = [],
}: NewBookingModalProps) {
  const [step, setStep] = useState(1);
  const [guestName, setGuestName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [roomCount, setRoomCount] = useState(1);
  const [roomDetails, setRoomDetails] = useState<
    Array<{
      tempId: number;
      roomTypeId: string;
      checkIn: string;
      checkOut: string;
      roomNumber?: string;
      customRate?: number;
      extraAdults: number;
      extraChildren: number;
      extraBeds: number;
      extraAdultRatePerNight: number;
      extraChildRatePerNight: number;
      extraBedChargePerNight: number;
    }>
  >([]);
  const [foundGuest, setFoundGuest] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [guestDetails, setGuestDetails] =
    useState<Partial<GuestDetails> | null>(null);
  const [syncDatesAcrossRooms, setSyncDatesAcrossRooms] = useState(false);
  const [source, setSource] = useState<
    "Direct" | "MMT" | "Booking.com" | "Expedia"
  >("Direct");
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const getSuggestedNightlyRate = useCallback(
    (room: {
      roomTypeId: string;
      checkIn: string;
      customRate?: number;
    }) => {
      const roomType = roomTypes.find((rt) => rt.id === room.roomTypeId);
      if (!roomType) return 0;

      // Manual override always takes precedence in the UI.
      if (room.customRate !== undefined) return room.customRate;

      let nightly = roomType.basePrice || 0;
      const date = new Date(room.checkIn);
      const dateStr = date.toISOString().split("T")[0];

      // Match backend behavior for direct bookings: special events > weekly rule.
      if (source === "Direct" && rules) {
        const event = rules.specialEvents?.find(
          (e) => dateStr >= e.startDate && dateStr <= e.endDate,
        );
        if (event) {
          if (event.modifierType === "percentage") {
            nightly = nightly * event.modifierValue;
          } else {
            nightly = nightly + event.modifierValue;
          }
        } else if (
          rules.weeklyRules?.isActive &&
          rules.weeklyRules.activeDays.includes(date.getDay())
        ) {
          if (rules.weeklyRules.modifierType === "percentage") {
            nightly = nightly * rules.weeklyRules.modifierValue;
          } else {
            nightly = nightly + rules.weeklyRules.modifierValue;
          }
        }
      } else if (source !== "Direct") {
        const conn = connections.find((c) => c.name === source);
        if (conn?.markupValue) {
          if (conn.markupType === "percentage") {
            nightly += (nightly * conn.markupValue) / 100;
          } else {
            nightly += conn.markupValue;
          }
        }
      }

      return Math.round(nightly);
    },
    [roomTypes, source, rules, connections],
  );

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setGuestName("");
      setPhoneNumber("");
      setEmail("");
      setRoomCount(1);
      setFoundGuest(null);
      setGuestDetails(null);
      setSource("Direct");

      // Set initial room detail from prefill
      const initialCheckIn = prefill?.checkIn || today;
      const d = new Date(initialCheckIn);
      d.setDate(d.getDate() + 1);
      const initialCheckOut = d.toISOString().split("T")[0];
      const initialRtId = prefill?.roomTypeId || roomTypes[0]?.id || "";
      const initialRates = defaultExtraRatesForRoomType(
        roomTypes,
        initialRtId,
      );

      // Set initial room detail from prefill
      const initialRoomDetails = [
        {
          tempId: Date.now(),
          roomTypeId: initialRtId,
          checkIn: initialCheckIn,
          checkOut: initialCheckOut,
          roomNumber: prefill?.roomId,
          extraAdults: 0,
          extraChildren: 0,
          extraBeds: 0,
          ...initialRates,
        },
      ];
      setRoomDetails(initialRoomDetails);
      setRoomCount(1);
      setSyncDatesAcrossRooms(false);
    }
  }, [isOpen, prefill, roomTypes, today]);

  // Auto-lookup when phone number changes (debounced)
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (phoneNumber.length >= 6) {
      setIsSearching(true);
      debounceTimeoutRef.current = setTimeout(async () => {
        try {
          const data = await lookupGuest(undefined, phoneNumber);
          if (Array.isArray(data) && data.length > 0) {
            setFoundGuest(data);
          } else {
            setFoundGuest(null);
          }
        } catch (err) {
          console.error("Lookup failed", err);
          setFoundGuest(null);
        } finally {
          setIsSearching(false);
        }
      }, 500); // 500ms debounce
    } else {
      setIsSearching(false);
      setFoundGuest(null);
    }

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [phoneNumber]);

  const applyGuestDetails = (guest: any) => {
    if (!guest) return;
    setGuestName(guest.name || "");
    setPhoneNumber(guest.phone_number || phoneNumber);
    setEmail(guest.email || "");
    setGuestDetails({
      profileId: guest.id,
      name: guest.name,
      phoneNumber: guest.phone_number || phoneNumber,
      email: guest.email,
      idType: guest.idType,
      idNumber: guest.idNumber,
      address: guest.address,
      dob: guest.dob,
      nationality: guest.nationality || "Indian",
      gender: guest.gender || "Male",
      passportNumber: guest.passportNumber,
      passportPlaceIssue: guest.passportPlaceIssue,
      passportIssueDate: guest.passportIssueDate,
      passportExpiry: guest.passportExpiry,
      visaNumber: guest.visaNumber,
      visaType: guest.visaType,
      visaPlaceIssue: guest.visaPlaceIssue,
      visaIssueDate: guest.visaIssueDate,
      visaExpiry: guest.visaExpiry,
      arrivedFrom: guest.arrivedFrom,
      arrivalDateIndia: guest.arrivalDateIndia,
      arrivalPort: guest.arrivalPort,
      nextDestination: guest.nextDestination,
      purposeOfVisit: guest.purposeOfVisit,
      idImage: guest.idImage,
      idImageBack: guest.idImageBack,
      visaPage: guest.visaPage,
    });
    setFoundGuest(null);
  };

  const handleNext = () => {
    if (!guestName.trim()) return;

    // Initialize room details based on count
    const initialDetails = Array.from({ length: roomCount }, (_, i) => {
      // Preserve the first room if it was already initialized (potentially via prefill)
      if (i === 0 && roomDetails.length > 0) {
        const r0 = roomDetails[0];
        const d = defaultExtraRatesForRoomType(roomTypes, r0.roomTypeId);
        return {
          ...r0,
          tempId: i,
          extraAdultRatePerNight:
            r0.extraAdultRatePerNight ?? d.extraAdultRatePerNight,
          extraChildRatePerNight:
            r0.extraChildRatePerNight ?? d.extraChildRatePerNight,
          extraBedChargePerNight:
            r0.extraBedChargePerNight ?? d.extraBedChargePerNight,
        };
      }

      const checkInDate = prefill?.checkIn || today;
      const nextDay = new Date(checkInDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const rtId = prefill?.roomTypeId || roomTypes[0]?.id || "";

      return {
        tempId: i,
        roomTypeId: rtId,
        checkIn: checkInDate,
        checkOut: nextDay.toISOString().split("T")[0],
        extraAdults: 0,
        extraChildren: 0,
        extraBeds: 0,
        ...defaultExtraRatesForRoomType(roomTypes, rtId),
      };
    });
    setRoomDetails(initialDetails);
    setStep(2);
  };

  const nextDayYmd = (checkInYmd: string): string | null => {
    const parts = checkInYmd.split("-").map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
    const [y, m, d] = parts;
    const next = new Date(y, m - 1, d);
    next.setDate(next.getDate() + 1);
    const yy = next.getFullYear();
    const mm = String(next.getMonth() + 1).padStart(2, "0");
    const dd = String(next.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  };

  const handleUpdateRoom = (index: number, field: string, value: any) => {
    if (field === "checkIn") {
      if (value < today) {
        alert("Cannot book for a previous date");
        return;
      }
    }
    setRoomDetails((prev) => {
      const sync = syncDatesAcrossRooms && prev.length > 1;

      if (sync && field === "checkIn" && typeof value === "string" && value) {
        const nextOut = nextDayYmd(value);
        if (nextOut) {
          return prev.map((item) => ({
            ...item,
            checkIn: value,
            checkOut: nextOut,
          }));
        }
      }

      if (sync && field === "checkOut") {
        return prev.map((item) => ({ ...item, checkOut: value }));
      }

      return prev.map((item, i) => {
        if (i !== index) return item;

        if (field === "roomTypeId" && value !== item.roomTypeId) {
          return {
            ...item,
            [field]: value,
            roomNumber: undefined,
            customRate: undefined,
            ...defaultExtraRatesForRoomType(roomTypes, value),
          };
        }

        if (field === "checkIn" && typeof value === "string" && value) {
          const nextOut = nextDayYmd(value);
          if (nextOut) {
            return {
              ...item,
              checkIn: value,
              checkOut: nextOut,
            };
          }
        }

        return { ...item, [field]: value };
      });
    });
  };

  const getAvailableRoomNumbers = useCallback(
    (
      roomTypeId: string,
      checkIn: string,
      checkOut: string,
      excludeIdx: number = -1,
    ) => {
      const rt = roomTypes.find((t) => t.id === roomTypeId);
      if (!rt) return [];

      const allRooms = rt.roomNumbers || [];
      if (allRooms.length === 0) return [];

      const occupiedRooms = new Set<string>();
      const parseDate = (s: string) => {
        const [y, m, d] = s.split("-").map(Number);
        return new Date(y, m - 1, d);
      };

      let curr = parseDate(checkIn);
      const end = parseDate(checkOut);
      if (isNaN(curr.getTime()) || isNaN(end.getTime()) || curr >= end)
        return [];

      while (curr < end) {
        const year = curr.getFullYear();
        const month = String(curr.getMonth() + 1).padStart(2, "0");
        const day = String(curr.getDate()).padStart(2, "0");
        const dateStr = `${year}-${month}-${day}`;

        syncEvents.forEach((e) => {
          if (
            e.type === "booking" &&
            e.roomTypeId === roomTypeId &&
            e.roomNumber &&
            e.status !== "Cancelled" &&
            e.status !== "Rejected" &&
            e.status !== "CheckedOut" &&
            e.checkIn <= dateStr &&
            e.checkOut > dateStr
          ) {
            occupiedRooms.add(e.roomNumber);
          }
        });

        roomDetails.forEach((r, idx) => {
          if (
            idx !== excludeIdx &&
            r.roomTypeId === roomTypeId &&
            r.roomNumber &&
            r.checkIn <= dateStr &&
            r.checkOut > dateStr
          ) {
            occupiedRooms.add(r.roomNumber);
          }
        });
        curr.setDate(curr.getDate() + 1);
      }
      return allRooms.filter((num) => !occupiedRooms.has(num));
    },
    [roomTypes, syncEvents, roomDetails],
  );

  const getRoomAvailability = useMemo(() => {
    return (
      roomTypeId: string,
      checkIn: string,
      checkOut: string,
      excludeIdx: number = -1,
    ) => {
      const rt = roomTypes.find((t) => t.id === roomTypeId);
      if (!rt) return 0;

      let minAvailable = rt.totalCapacity;
      const parseDate = (s: string) => {
        const [y, m, d] = s.split("-").map(Number);
        return new Date(y, m - 1, d);
      };

      let curr = parseDate(checkIn);
      const end = parseDate(checkOut);
      if (isNaN(curr.getTime()) || isNaN(end.getTime()) || curr >= end)
        return 0;

      while (curr < end) {
        const year = curr.getFullYear();
        const month = String(curr.getMonth() + 1).padStart(2, "0");
        const day = String(curr.getDate()).padStart(2, "0");
        const dateStr = `${year}-${month}-${day}`;

        const occupied = syncEvents.filter(
          (e) =>
            e.type === "booking" &&
            e.roomTypeId === roomTypeId &&
            e.status !== "Cancelled" &&
            e.status !== "Rejected" &&
            e.status !== "CheckedOut" &&
            e.checkIn <= dateStr &&
            e.checkOut > dateStr,
        ).length;

        const sameModalOccupied = roomDetails.filter(
          (r, idx) =>
            idx !== excludeIdx &&
            r.roomTypeId === roomTypeId &&
            r.checkIn <= dateStr &&
            r.checkOut > dateStr,
        ).length;

        minAvailable = Math.min(
          minAvailable,
          rt.totalCapacity - occupied - sameModalOccupied,
        );
        curr.setDate(curr.getDate() + 1);
      }
      return minAvailable;
    };
  }, [roomTypes, syncEvents, roomDetails]);

  const handleSubmit = () => {
    // Final validation before submitting
    const hasPastDates = roomDetails.some((room) => room.checkIn < today);
    if (hasPastDates) {
      alert("Cannot book for a previous date.");
      return;
    }

    const hasAvailabilityIssues = roomDetails.some(
      (room, idx) =>
        getRoomAvailability(
          room.roomTypeId,
          room.checkIn,
          room.checkOut,
          idx,
        ) <= 0,
    );

    if (hasAvailabilityIssues) {
      alert(
        "Some selected rooms are no longer available. Please check the configurations.",
      );
      return;
    }

    onCreateBookings({
      guestName,
      phoneNumber,
      email,
      guestDetails: guestDetails || undefined,
      rooms: roomDetails.map(
        ({
          roomTypeId,
          checkIn,
          checkOut,
          roomNumber,
          customRate,
          extraAdults,
          extraChildren,
          extraBeds,
          extraAdultRatePerNight,
          extraChildRatePerNight,
          extraBedChargePerNight,
        }) => ({
          roomTypeId,
          checkIn,
          checkOut,
          roomNumber,
          customRate,
          extraAdults,
          extraChildren,
          extraBeds,
          extraAdultRatePerNight,
          extraChildRatePerNight,
          extraBedChargePerNight,
        }),
      ),
      source,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh] animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-xl shadow-indigo-200">
              <Plus className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">
                New Reservation
              </h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                Step {step} of 2
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 sm:px-8 sm:py-6 custom-scrollbar">
          {step === 1 ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Smartphone className="w-3.5 h-3.5 text-indigo-500" /> Phone
                    Number
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      placeholder="Mobile number..."
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full px-5 py-3.5 bg-white border-2 border-slate-100 rounded-2xl text-base font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-indigo-50/10 transition-all placeholder:text-slate-300"
                    />
                    {isSearching && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <Search className="w-4 h-4 text-indigo-400 animate-pulse" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-indigo-500" /> Email
                    Address
                  </label>
                  <input
                    type="email"
                    placeholder="Email (optional)..."
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-5 py-3.5 bg-white border-2 border-slate-100 rounded-2xl text-base font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-indigo-50/10 transition-all placeholder:text-slate-300"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-indigo-500" /> Primary Guest
                  Name
                </label>
                <input
                  type="text"
                  placeholder="Enter full name..."
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full px-5 py-3.5 bg-white border-2 border-slate-100 rounded-2xl text-base font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-indigo-50/10 transition-all placeholder:text-slate-300"
                />
              </div>

              {foundGuest &&
                Array.isArray(foundGuest) &&
                foundGuest.length > 0 && (
                  <div className="space-y-3 animate-in zoom-in-95 duration-300">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">
                        {foundGuest.length} Guest
                        {foundGuest.length > 1 ? "s" : ""} Found
                      </p>
                      <button
                        onClick={() => setFoundGuest(null)}
                        className="text-[9px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest flex items-center gap-1"
                      >
                        <RotateCcw className="w-2.5 h-2.5" /> Clear
                      </button>
                    </div>
                    <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar">
                      {foundGuest.map((guest: any, idx: number) => (
                        <div
                          key={guest.id || idx}
                          className="p-4 bg-indigo-600 rounded-2xl text-white shadow-lg relative overflow-hidden group hover:bg-indigo-700 transition-all cursor-pointer"
                          onClick={() => applyGuestDetails(guest)}
                        >
                          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Sparkles className="w-12 h-12" />
                          </div>
                          <div className="relative z-10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                                <User className="w-5 h-5" />
                              </div>
                              <div>
                                <h3 className="text-base font-black truncate max-w-[180px]">
                                  {guest.name}
                                </h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <p className="text-[9px] font-bold opacity-70">
                                    {guest.idType}:{" "}
                                    {guest.idNumber
                                      ? `••••${guest.idNumber.slice(-4)}`
                                      : "Verified"}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="px-3 py-1.5 bg-white text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                              Select
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Bed className="w-3.5 h-3.5 text-indigo-500" /> Number of
                  Rooms
                </label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center bg-slate-50 rounded-2xl p-1 border border-slate-100">
                    <button
                      onClick={() => setRoomCount(Math.max(1, roomCount - 1))}
                      className="p-2 hover:bg-white rounded-xl shadow-sm transition-all text-slate-600 disabled:opacity-30"
                      disabled={roomCount <= 1}
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <span className="w-12 text-center text-2xl font-black text-slate-800">
                      {roomCount}
                    </span>
                    <button
                      onClick={() => setRoomCount(Math.min(10, roomCount + 1))}
                      className="p-2 hover:bg-white rounded-xl shadow-sm transition-all text-slate-600"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-[11px] font-bold text-slate-400 leading-tight">
                    Configurable in the
                    <br />
                    next step.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {roomDetails.length > 1 && (
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 transition-colors hover:bg-indigo-50">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={syncDatesAcrossRooms}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setSyncDatesAcrossRooms(on);
                      if (on) {
                        setRoomDetails((prev) => {
                          if (prev.length === 0) return prev;
                          const { checkIn, checkOut } = prev[0];
                          return prev.map((r) => ({
                            ...r,
                            checkIn,
                            checkOut,
                          }));
                        });
                      }
                    }}
                  />
                  <div>
                    <span className="text-sm font-black text-slate-800">
                      Same check-in &amp; check-out for all rooms
                    </span>
                    <p className="mt-1 text-[11px] font-bold leading-snug text-slate-500">
                      When enabled, changing dates on any room updates every
                      room. Turning it on copies room 1&apos;s dates to the
                      rest.
                    </p>
                  </div>
                </label>
              )}
              {roomDetails.map((room, idx) => (
                <div
                  key={room.tempId}
                  className="bg-slate-50 rounded-3xl p-6 border border-slate-200 space-y-4 animate-in slide-in-from-right-4 duration-300"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-6 h-6 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      Room Configuration
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Room Type
                        </label>
                        {(() => {
                          const avail = getRoomAvailability(
                            room.roomTypeId,
                            room.checkIn,
                            room.checkOut,
                            idx,
                          );
                          return (
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${avail <= 0 ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"}`}
                            >
                              {avail <= 0 ? "Sold Out" : `${avail} available`}
                            </span>
                          );
                        })()}
                      </div>
                      <select
                        value={room.roomTypeId}
                        onChange={(e) =>
                          handleUpdateRoom(idx, "roomTypeId", e.target.value)
                        }
                        className={`w-full px-4 py-3 bg-white border rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 ${getRoomAvailability(room.roomTypeId, room.checkIn, room.checkOut, idx) <= 0 ? "border-rose-300" : "border-slate-200"}`}
                      >
                        {roomTypes.map((rt) => (
                          <option key={rt.id} value={rt.id}>
                            {rt.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> In
                        </label>
                        <input
                          type="date"
                          value={room.checkIn}
                          onChange={(e) =>
                            handleUpdateRoom(idx, "checkIn", e.target.value)
                          }
                          className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Out
                        </label>
                        <input
                          type="date"
                          value={room.checkOut}
                          onChange={(e) =>
                            handleUpdateRoom(idx, "checkOut", e.target.value)
                          }
                          className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Assign Specific Room (Optional)
                      </label>
                      <select
                        value={room.roomNumber || ""}
                        onChange={(e) =>
                          handleUpdateRoom(idx, "roomNumber", e.target.value)
                        }
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-indigo-500"
                      >
                        <option value="">Auto-Assign (Random Available)</option>
                        {getAvailableRoomNumbers(
                          room.roomTypeId,
                          room.checkIn,
                          room.checkOut,
                          idx,
                        ).map((num) => (
                          <option key={num} value={num}>
                            Room {num}
                          </option>
                        ))}
                        {room.roomNumber &&
                          !getAvailableRoomNumbers(
                            room.roomTypeId,
                            room.checkIn,
                            room.checkOut,
                            idx,
                          ).includes(room.roomNumber) && (
                            <option value={room.roomNumber} disabled>
                              Room {room.roomNumber} (Occupied)
                            </option>
                          )}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Extra Adult
                      </label>
                      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-indigo-500">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="number"
                          min="0"
                          value={room.extraAdults}
                          onChange={(e) =>
                            handleUpdateRoom(
                              idx,
                              "extraAdults",
                              parseInt(e.target.value) || 0,
                            )
                          }
                          className="w-full bg-transparent text-sm font-bold text-slate-800 outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Extra Child
                      </label>
                      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-indigo-500">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="number"
                          min="0"
                          value={room.extraChildren}
                          onChange={(e) =>
                            handleUpdateRoom(
                              idx,
                              "extraChildren",
                              parseInt(e.target.value) || 0,
                            )
                          }
                          className="w-full bg-transparent text-sm font-bold text-slate-800 outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Extra Bed
                      </label>
                      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-indigo-500">
                        <Bed className="w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="number"
                          min="0"
                          value={room.extraBeds}
                          onChange={(e) =>
                            handleUpdateRoom(
                              idx,
                              "extraBeds",
                              parseInt(e.target.value) || 0,
                            )
                          }
                          className="w-full bg-transparent text-sm font-bold text-slate-800 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {(room.extraAdults > 0 ||
                    room.extraChildren > 0 ||
                    room.extraBeds > 0) && (
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {room.extraAdults > 0 && (
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                              Extra adult rate
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
                                ₹
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={room.extraAdultRatePerNight}
                                onChange={(e) =>
                                  handleUpdateRoom(
                                    idx,
                                    "extraAdultRatePerNight",
                                    Number(e.target.value) || 0,
                                  )
                                }
                                className="w-full pl-7 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-indigo-500"
                              />
                            </div>
                            <p className="text-[10px] font-bold text-slate-500">
                              Subtotal: ₹
                              {(
                                room.extraAdults *
                                room.extraAdultRatePerNight *
                                stayNightsBetween(
                                  room.checkIn,
                                  room.checkOut,
                                )
                              ).toLocaleString()}
                            </p>
                          </div>
                        )}
                        {room.extraChildren > 0 && (
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                              Extra child rate
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
                                ₹
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={room.extraChildRatePerNight}
                                onChange={(e) =>
                                  handleUpdateRoom(
                                    idx,
                                    "extraChildRatePerNight",
                                    Number(e.target.value) || 0,
                                  )
                                }
                                className="w-full pl-7 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-indigo-500"
                              />
                            </div>
                            <p className="text-[10px] font-bold text-slate-500">
                              Subtotal: ₹
                              {(
                                room.extraChildren *
                                room.extraChildRatePerNight *
                                stayNightsBetween(
                                  room.checkIn,
                                  room.checkOut,
                                )
                              ).toLocaleString()}
                            </p>
                          </div>
                        )}
                        {room.extraBeds > 0 && (
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                              Extra bed rate
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
                                ₹
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={room.extraBedChargePerNight}
                                onChange={(e) =>
                                  handleUpdateRoom(
                                    idx,
                                    "extraBedChargePerNight",
                                    Number(e.target.value) || 0,
                                  )
                                }
                                className="w-full pl-7 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-indigo-500"
                              />
                            </div>
                            <p className="text-[10px] font-bold text-slate-500">
                              Subtotal: ₹
                              {(
                                room.extraBeds *
                                room.extraBedChargePerNight *
                                stayNightsBetween(
                                  room.checkIn,
                                  room.checkOut,
                                )
                              ).toLocaleString()}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {source === "Direct" && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Room Rate (Per Night)
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                            ₹
                          </span>
                          <input
                            type="number"
                            min="0"
                              placeholder={String(getSuggestedNightlyRate(room))}
                            value={room.customRate ?? ""}
                            onChange={(e) =>
                              handleUpdateRoom(
                                idx,
                                "customRate",
                                e.target.value
                                  ? Number(e.target.value)
                                  : undefined,
                              )
                            }
                            className="w-full pl-8 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-indigo-500"
                          />
                        </div>
                        <p className="text-[9px] text-slate-400">
                          Suggested rate: ₹
                          {getSuggestedNightlyRate(room).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>

                  {getRoomAvailability(
                    room.roomTypeId,
                    room.checkIn,
                    room.checkOut,
                    idx,
                  ) <= 0 && (
                    <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span className="text-[10px] font-bold uppercase tracking-tight">
                        Selective Date/Type conflict: This room is unavailable
                        for the selected dates.
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {/* Action Buttons at the end of content */}
          <div className="mt-8 pt-8 border-t border-slate-100 flex items-center justify-between pb-4">
            <button
              onClick={step === 2 ? () => setStep(1) : onClose}
              className="px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
            >
              {step === 2 ? "Go Back" : "Cancel"}
            </button>

            {step === 1 ? (
              <button
                onClick={handleNext}
                disabled={!guestName.trim()}
                className="flex items-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl disabled:opacity-20"
              >
                Configure Rooms <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
              >
                Confirm All Bookings <CheckCircle2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
