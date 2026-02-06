import React, { useState, useMemo } from 'react';
import {
    Brush, CheckCircle, AlertCircle, Clock,
    Search, Filter, Calendar, PenTool, AlertTriangle,
    MoreVertical, CheckSquare, XCircle, RotateCcw
} from 'lucide-react';
import { RoomType, RoomStatus } from '../types';
import { updateRoomStatus } from '../api';

interface HousekeepingViewProps {
    roomTypes: RoomType[];
    roomStatuses: RoomStatus[];
    setRoomStatuses: React.Dispatch<React.SetStateAction<RoomStatus[]>>;
}

const STATUS_COLORS = {
    'Clean': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'Dirty': 'bg-rose-100 text-rose-800 border-rose-200',
    'Inspecting': 'bg-amber-100 text-amber-800 border-amber-200',
    'OutOfOrder': 'bg-slate-100 text-slate-800 border-slate-200',
};

const PRIORITY_COLORS = {
    'Low': 'bg-slate-100 text-slate-600',
    'Medium': 'bg-blue-100 text-blue-600',
    'High': 'bg-rose-100 text-rose-600',
};

const HousekeepingView: React.FC<HousekeepingViewProps> = ({ roomTypes, roomStatuses, setRoomStatuses }) => {
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Derive all rooms from room types
    const allRooms = useMemo(() => {
        const rooms: { id: string; type: string; typeId: string }[] = [];
        roomTypes.forEach(rt => {
            const nums = rt.roomNumbers || [];
            nums.forEach(num => {
                rooms.push({ id: num, type: rt.name, typeId: rt.id });
            });
        });
        return rooms;
    }, [roomTypes]);

    // Merge with statuses
    const roomData = useMemo(() => {
        return allRooms.map(r => {
            const status = roomStatuses.find(s => s.roomNumber === r.id) || {
                roomNumber: r.id,
                status: 'Clean',
                priority: 'Medium',
                notes: '',
                lastCleaned: '-'
            } as RoomStatus;
            return { ...r, ...status };
        });
    }, [allRooms, roomStatuses]);

    const filteredRooms = useMemo(() => {
        return roomData.filter(r => {
            if (filterStatus !== 'all' && r.status !== filterStatus) return false;
            if (searchQuery && !r.id.toLowerCase().includes(searchQuery.toLowerCase()) && !r.type.toLowerCase().includes(searchQuery.toLowerCase())) return false;
            return true;
        });
    }, [roomData, filterStatus, searchQuery]);

    const stats = useMemo(() => {
        const total = roomData.length;
        const clean = roomData.filter(r => r.status === 'Clean').length;
        const dirty = roomData.filter(r => r.status === 'Dirty').length;
        const inspecting = roomData.filter(r => r.status === 'Inspecting').length;
        const outOfOrder = roomData.filter(r => r.status === 'OutOfOrder').length;
        return { total, clean, dirty, inspecting, outOfOrder };
    }, [roomData]);

    const handleStatusChange = async (roomNumber: string, newStatus: RoomStatus['status']) => {
        setIsLoading(true);
        const current = roomStatuses.find(s => s.roomNumber === roomNumber) || { roomNumber, status: 'Clean', priority: 'Medium' } as RoomStatus;
        const updated: RoomStatus = {
            ...current,
            status: newStatus,
            lastCleaned: newStatus === 'Clean' ? new Date().toISOString() : current.lastCleaned
        };

        // Optimistic update
        setRoomStatuses(prev => {
            const exists = prev.find(s => s.roomNumber === roomNumber);
            if (exists) {
                return prev.map(s => s.roomNumber === roomNumber ? updated : s);
            }
            return [...prev, updated];
        });

        try {
            await updateRoomStatus(updated);
        } catch (error) {
            console.error("Failed to update status", error);
            // Revert if needed (omitted for brevity)
        } finally {
            setIsLoading(false);
        }
    };

    const handlePriorityChange = async (roomNumber: string, priority: RoomStatus['priority']) => {
        const current = roomStatuses.find(s => s.roomNumber === roomNumber) || { roomNumber, status: 'Clean', priority: 'Medium' } as RoomStatus;
        const updated: RoomStatus = { ...current, priority };

        // Optimistic
        setRoomStatuses(prev => {
            const exists = prev.find(s => s.roomNumber === roomNumber);
            if (exists) return prev.map(s => s.roomNumber === roomNumber ? updated : s);
            return [...prev, updated];
        });

        try { await updateRoomStatus(updated); } catch (e) { console.error(e); }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 pb-24 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <Brush className="w-8 h-8 text-indigo-600" />
                        Housekeeping
                    </h2>
                    <p className="text-slate-500 mt-1 font-medium">Manage room cleanliness and maintenance status.</p>
                </div>

                {/* Quick Stats */}
                <div className="flex gap-4">
                    <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 w-32">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><CheckCircle className="w-4 h-4" /></div>
                        <div><span className="block text-lg font-black text-slate-800 leading-none">{stats.clean}</span><span className="text-[10px] font-bold text-slate-400 uppercase">Clean</span></div>
                    </div>
                    <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 w-32">
                        <div className="p-2 bg-rose-100 text-rose-600 rounded-lg"><AlertCircle className="w-4 h-4" /></div>
                        <div><span className="block text-lg font-black text-slate-800 leading-none">{stats.dirty}</span><span className="text-[10px] font-bold text-slate-400 uppercase">Dirty</span></div>
                    </div>
                    <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 w-32">
                        <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><Clock className="w-4 h-4" /></div>
                        <div><span className="block text-lg font-black text-slate-800 leading-none">{stats.inspecting}</span><span className="text-[10px] font-bold text-slate-400 uppercase">Inspect</span></div>
                    </div>
                </div>
            </header>

            {/* Toolbar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                    {['all', 'Clean', 'Dirty', 'Inspecting', 'OutOfOrder'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${filterStatus === status ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {status === 'all' ? 'All Rooms' : status.replace(/([A-Z])/g, ' $1').trim()}
                        </button>
                    ))}
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search rooms..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none w-64 focus:border-indigo-500 transition-colors"
                    />
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredRooms.map(room => (
                    <div key={room.id} className={`bg-white rounded-2xl shadow-sm border p-5 transition-all hover:shadow-md ${STATUS_COLORS[room.status].replace('bg-', 'border-l-4 border-l-')}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{room.id}</h3>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{room.type}</span>
                            </div>
                            <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${STATUS_COLORS[room.status]}`}>
                                {room.status.replace(/([A-Z])/g, ' $1').trim()}
                            </div>
                        </div>

                        <div className="space-y-3 mb-6">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-500">Priority</span>
                                <div className="flex gap-1">
                                    {['Low', 'Medium', 'High'].map((p: any) => (
                                        <button
                                            key={p}
                                            onClick={() => handlePriorityChange(room.id, p)}
                                            className={`w-2 h-6 rounded-full transition-all ${room.priority === p ? 'bg-indigo-500 scale-110' : 'bg-slate-200 hover:bg-slate-300'}`}
                                            title={p}
                                        />
                                    ))}
                                    <span className={`ml-2 px-2 py-0.5 rounded text-[9px] font-black uppercase ${PRIORITY_COLORS[room.priority as keyof typeof PRIORITY_COLORS]}`}>{room.priority}</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-500">Last Cleaned</span>
                                <span className="font-mono text-slate-700">{room.lastCleaned ? new Date(room.lastCleaned).toLocaleDateString() : 'Never'}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-auto">
                            {room.status === 'Dirty' && (
                                <button onClick={() => handleStatusChange(room.id, 'Clean')} className="col-span-2 flex items-center justify-center gap-2 bg-emerald-600 text-white py-2 rounded-xl text-xs font-black uppercase hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200">
                                    <CheckSquare className="w-4 h-4" /> Mark Clean
                                </button>
                            )}
                            {room.status === 'Clean' && (
                                <>
                                    <button onClick={() => handleStatusChange(room.id, 'Dirty')} className="flex items-center justify-center gap-2 bg-slate-100 text-slate-600 py-2 rounded-xl text-xs font-black uppercase hover:bg-slate-200 transition-colors">
                                        <RotateCcw className="w-4 h-4" /> Dirty
                                    </button>
                                    <button onClick={() => handleStatusChange(room.id, 'Inspecting')} className="flex items-center justify-center gap-2 bg-amber-100 text-amber-700 py-2 rounded-xl text-xs font-black uppercase hover:bg-amber-200 transition-colors">
                                        <Search className="w-4 h-4" /> Inspect
                                    </button>
                                </>
                            )}
                            {room.status === 'Inspecting' && (
                                <>
                                    <button onClick={() => handleStatusChange(room.id, 'Clean')} className="flex items-center justify-center gap-2 bg-emerald-600 text-white py-2 rounded-xl text-xs font-black uppercase hover:bg-emerald-700 transition-colors">
                                        <CheckSquare className="w-4 h-4" /> Pass
                                    </button>
                                    <button onClick={() => handleStatusChange(room.id, 'Dirty')} className="flex items-center justify-center gap-2 bg-rose-100 text-rose-600 py-2 rounded-xl text-xs font-black uppercase hover:bg-rose-200 transition-colors">
                                        <XCircle className="w-4 h-4" /> Fail
                                    </button>
                                </>
                            )}

                            {room.status === 'OutOfOrder' ? (
                                <button onClick={() => handleStatusChange(room.id, 'Clean')} className="col-span-2 flex items-center justify-center gap-2 bg-slate-800 text-white py-2 rounded-xl text-xs font-black uppercase hover:bg-slate-900 transition-colors">
                                    <RotateCcw className="w-4 h-4" /> Restore to Service
                                </button>
                            ) : (
                                <button onClick={() => handleStatusChange(room.id, 'OutOfOrder')} className={`mt-2 col-span-2 flex items-center justify-center gap-2 py-1 rounded-lg text-[10px] font-bold uppercase text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors`}>
                                    Set Out Of Order
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default HousekeepingView;
