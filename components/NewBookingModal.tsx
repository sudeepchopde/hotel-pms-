
import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Minus, Calendar, Bed, User, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { RoomType, Booking, SyncEvent } from '../types';

interface NewBookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    roomTypes: RoomType[];
    syncEvents: SyncEvent[];
    onCreateBookings: (data: { guestName: string, rooms: Array<{ roomTypeId: string, checkIn: string, checkOut: string }> }) => void;
}

const NewBookingModal: React.FC<NewBookingModalProps> = ({ isOpen, onClose, roomTypes, syncEvents, onCreateBookings }) => {
    const [step, setStep] = useState(1);
    const [guestName, setGuestName] = useState('');
    const [roomCount, setRoomCount] = useState(1);
    const [roomDetails, setRoomDetails] = useState<Array<{ tempId: number, roomTypeId: string, checkIn: string, checkOut: string }>>([]);

    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setGuestName('');
            setRoomCount(1);
        }
    }, [isOpen]);

    const handleNext = () => {
        if (!guestName.trim()) return;

        // Initialize room details based on count
        const initialDetails = Array.from({ length: roomCount }, (_, i) => ({
            tempId: i,
            roomTypeId: roomTypes[0]?.id || '',
            checkIn: today,
            checkOut: tomorrow
        }));
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
                                    autoFocus
                                />
                            </div>

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
