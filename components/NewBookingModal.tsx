
import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Minus, Calendar, Bed, User, ArrowRight, CheckCircle2, AlertTriangle, Search, Smartphone, Mail, Sparkles, RotateCcw } from 'lucide-react';
import { RoomType, Booking, SyncEvent, GuestDetails } from '../types';
import { lookupGuest } from '../api';

interface NewBookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    roomTypes: RoomType[];
    syncEvents: SyncEvent[];
    onCreateBookings: (data: {
        guestName: string,
        phoneNumber?: string,
        email?: string,
        guestDetails?: Partial<GuestDetails>,
        rooms: Array<{ roomTypeId: string, checkIn: string, checkOut: string }>
    }) => void;
    prefill?: { checkIn: string; roomTypeId: string } | null;
}

const NewBookingModal: React.FC<NewBookingModalProps> = ({ isOpen, onClose, roomTypes, syncEvents, onCreateBookings, prefill }) => {
    const [step, setStep] = useState(1);
    const [guestName, setGuestName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [email, setEmail] = useState('');
    const [roomCount, setRoomCount] = useState(1);
    const [roomDetails, setRoomDetails] = useState<Array<{ tempId: number, roomTypeId: string, checkIn: string, checkOut: string }>>([]);
    const [foundGuest, setFoundGuest] = useState<any>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [guestDetails, setGuestDetails] = useState<Partial<GuestDetails> | null>(null);

    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setGuestName('');
            setPhoneNumber('');
            setEmail('');
            setRoomCount(1);
            setFoundGuest(null);
            setGuestDetails(null);
        }
    }, [isOpen]);

    const handlePhoneLookup = async () => {
        if (phoneNumber.length < 4) return; // Allow shorter phone numbers
        setIsSearching(true);
        try {
            const data = await lookupGuest(undefined, phoneNumber);
            // API now returns an array
            if (Array.isArray(data) && data.length > 0) {
                setFoundGuest(data);
            } else {
                setFoundGuest(null);
            }
        } catch (err) {
            console.error("Lookup failed", err);
        } finally {
            setIsSearching(false);
        }
    };

    const applyGuestDetails = (guest: any) => {
        if (!guest) return;
        setGuestName(guest.name || '');
        setPhoneNumber(guest.phone_number || phoneNumber);
        setEmail(guest.email || '');
        setGuestDetails({
            name: guest.name,
            phoneNumber: guest.phone_number || phoneNumber,
            email: guest.email,
            idType: guest.idType,
            idNumber: guest.idNumber,
            address: guest.address,
            dob: guest.dob,
            nationality: guest.nationality || 'Indian',
            gender: guest.gender || 'Male',
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
            visaPage: guest.visaPage
        });
        setFoundGuest(null);
    };

    const handleNext = () => {
        if (!guestName.trim()) return;

        // Initialize room details based on count
        const initialDetails = Array.from({ length: roomCount }, (_, i) => {
            const checkInDate = prefill?.checkIn || today;
            const nextDay = new Date(checkInDate);
            nextDay.setDate(nextDay.getDate() + 1);

            return {
                tempId: i,
                roomTypeId: prefill?.roomTypeId || roomTypes[0]?.id || '',
                checkIn: checkInDate,
                checkOut: nextDay.toISOString().split('T')[0]
            };
        });
        setRoomDetails(initialDetails);
        setStep(2);
    };

    const handleUpdateRoom = (index: number, field: string, value: any) => {
        setRoomDetails(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    };

    const getRoomAvailability = useMemo(() => {
        return (roomTypeId: string, checkIn: string, checkOut: string, excludeIdx: number = -1) => {
            const rt = roomTypes.find(t => t.id === roomTypeId);
            if (!rt) return 0;

            let minAvailable = rt.totalCapacity;

            // Timezone-safe date processing
            const parseDate = (s: string) => {
                const [y, m, d] = s.split('-').map(Number);
                return new Date(y, m - 1, d);
            };

            let curr = parseDate(checkIn);
            const end = parseDate(checkOut);

            if (isNaN(curr.getTime()) || isNaN(end.getTime()) || curr >= end) return 0;

            while (curr < end) {
                const year = curr.getFullYear();
                const month = String(curr.getMonth() + 1).padStart(2, '0');
                const day = String(curr.getDate()).padStart(2, '0');
                const dateStr = `${year}-${month}-${day}`;

                const occupied = syncEvents.filter(e =>
                    e.type === 'booking' &&
                    e.roomTypeId === roomTypeId &&
                    e.status !== 'Cancelled' &&
                    e.status !== 'Rejected' &&
                    e.status !== 'CheckedOut' &&
                    e.checkIn <= dateStr && e.checkOut > dateStr
                ).length;

                // Count others of same type in same modal
                const sameModalOccupied = roomDetails.filter((r, idx) =>
                    idx !== excludeIdx &&
                    r.roomTypeId === roomTypeId &&
                    r.checkIn <= dateStr && r.checkOut > dateStr
                ).length;

                minAvailable = Math.min(minAvailable, rt.totalCapacity - occupied - sameModalOccupied);
                curr.setDate(curr.getDate() + 1);
            }
            return minAvailable;
        };
    }, [roomTypes, syncEvents, roomDetails]);

    const handleSubmit = () => {
        // Final validation before submitting
        const hasAvailabilityIssues = roomDetails.some((room, idx) =>
            getRoomAvailability(room.roomTypeId, room.checkIn, room.checkOut, idx) <= 0
        );

        if (hasAvailabilityIssues) {
            alert("Some selected rooms are no longer available. Please check the configurations.");
            return;
        }

        onCreateBookings({
            guestName,
            phoneNumber,
            email,
            guestDetails: guestDetails || undefined,
            rooms: roomDetails.map(({ roomTypeId, checkIn, checkOut }) => ({ roomTypeId, checkIn, checkOut }))
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                {/* Header */}
                <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-xl shadow-indigo-200">
                            <Plus className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">New Reservation</h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Step {step} of 2</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {step === 1 ? (
                        <div className="space-y-8 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Smartphone className="w-4 h-4 text-indigo-500" /> Phone Number
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="tel"
                                            placeholder="Mobile number..."
                                            value={phoneNumber}
                                            onChange={e => setPhoneNumber(e.target.value)}
                                            onBlur={handlePhoneLookup}
                                            className="w-full px-6 py-4 bg-white border-2 border-slate-200 rounded-2xl text-lg font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-indigo-50/10 transition-all placeholder:text-slate-300"
                                        />
                                        {isSearching && (
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                                <Search className="w-5 h-5 text-indigo-400 animate-pulse" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Mail className="w-4 h-4 text-indigo-500" /> Email Address
                                    </label>
                                    <input
                                        type="email"
                                        placeholder="Email (optional)..."
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="w-full px-6 py-4 bg-white border-2 border-slate-200 rounded-2xl text-lg font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-indigo-50/10 transition-all placeholder:text-slate-300"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <User className="w-4 h-4 text-indigo-500" /> Primary Guest Name
                                </label>
                                <input
                                    type="text"
                                    placeholder="Enter full name..."
                                    value={guestName}
                                    onChange={e => setGuestName(e.target.value)}
                                    className="w-full px-6 py-4 bg-white border-2 border-slate-200 rounded-2xl text-lg font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-indigo-50/10 transition-all placeholder:text-slate-300"
                                />
                            </div>

                            {foundGuest && Array.isArray(foundGuest) && foundGuest.length > 0 && (
                                <div className="space-y-4 animate-in zoom-in-95 duration-300">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em]">
                                            {foundGuest.length} Guest{foundGuest.length > 1 ? 's' : ''} Found
                                        </p>
                                        <button
                                            onClick={() => setFoundGuest(null)}
                                            className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest flex items-center gap-1"
                                        >
                                            <RotateCcw className="w-3 h-3" /> Clear
                                        </button>
                                    </div>
                                    <div className="space-y-3 max-h-[240px] overflow-y-auto custom-scrollbar">
                                        {foundGuest.map((guest: any, idx: number) => (
                                            <div
                                                key={guest.id || idx}
                                                className="p-5 bg-indigo-600 rounded-2xl text-white shadow-xl relative overflow-hidden group hover:bg-indigo-700 transition-all cursor-pointer"
                                                onClick={() => applyGuestDetails(guest)}
                                            >
                                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                                    <Sparkles className="w-16 h-16" />
                                                </div>
                                                <div className="relative z-10 flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-md">
                                                            <User className="w-6 h-6" />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-lg font-black truncate max-w-[200px]">{guest.name}</h3>
                                                            <div className="flex items-center gap-3 mt-0.5">
                                                                <p className="text-[10px] font-bold opacity-70">
                                                                    {guest.idType}: {guest.idNumber ? `••••${guest.idNumber.slice(-4)}` : 'Verified'}
                                                                </p>
                                                                {guest.lastCheckIn && (
                                                                    <p className="text-[10px] font-bold opacity-50">
                                                                        Last: {guest.lastCheckIn}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="px-4 py-2 bg-white text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                                        Select
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Bed className="w-4 h-4 text-indigo-500" /> Number of Rooms
                                </label>
                                <div className="flex items-center gap-6">
                                    <div className="flex items-center bg-slate-100 rounded-2xl p-1.5 border border-slate-200">
                                        <button
                                            onClick={() => setRoomCount(Math.max(1, roomCount - 1))}
                                            className="p-3 hover:bg-white rounded-xl shadow-sm transition-all text-slate-600 disabled:opacity-30"
                                            disabled={roomCount <= 1}
                                        >
                                            <Minus className="w-6 h-6" />
                                        </button>
                                        <span className="w-16 text-center text-3xl font-black text-slate-800">{roomCount}</span>
                                        <button
                                            onClick={() => setRoomCount(Math.min(10, roomCount + 1))}
                                            className="p-3 hover:bg-white rounded-xl shadow-sm transition-all text-slate-600"
                                        >
                                            <Plus className="w-6 h-6" />
                                        </button>
                                    </div>
                                    <p className="text-sm font-medium text-slate-400 max-w-[200px]">You can configure individual types and dates in the next step.</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {roomDetails.map((room, idx) => (
                                <div key={room.tempId} className="bg-slate-50 rounded-3xl p-6 border border-slate-200 space-y-4 animate-in slide-in-from-right-4 duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                            <span className="w-6 h-6 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-[10px]">{idx + 1}</span>
                                            Room Configuration
                                        </h3>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Room Type</label>
                                                {(() => {
                                                    const avail = getRoomAvailability(room.roomTypeId, room.checkIn, room.checkOut, idx);
                                                    return (
                                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${avail <= 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                            {avail <= 0 ? 'Sold Out' : `${avail} available`}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                            <select
                                                value={room.roomTypeId}
                                                onChange={e => handleUpdateRoom(idx, 'roomTypeId', e.target.value)}
                                                className={`w-full px-4 py-3 bg-white border rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 ${getRoomAvailability(room.roomTypeId, room.checkIn, room.checkOut, idx) <= 0 ? 'border-rose-300' : 'border-slate-200'}`}
                                            >
                                                {roomTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
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
                                                    onChange={e => handleUpdateRoom(idx, 'checkIn', e.target.value)}
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
                                                    onChange={e => handleUpdateRoom(idx, 'checkOut', e.target.value)}
                                                    className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    {getRoomAvailability(room.roomTypeId, room.checkIn, room.checkOut, idx) <= 0 && (
                                        <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600">
                                            <AlertTriangle className="w-4 h-4 shrink-0" />
                                            <span className="text-[10px] font-bold uppercase tracking-tight">Selective Date/Type conflict: This room is unavailable for the selected dates.</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <button
                        onClick={step === 2 ? () => setStep(1) : onClose}
                        className="px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
                    >
                        {step === 2 ? 'Go Back' : 'Cancel'}
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
    );
};

export default NewBookingModal;
