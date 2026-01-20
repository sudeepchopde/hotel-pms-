
import React, { useState, useMemo, useEffect } from 'react';
import {
  Users, Search, Filter, Mail, Smartphone,
  MapPin, Calendar, FileBadge, ChevronDown,
  MoreVertical, CheckCircle2, XCircle, AlertCircle,
  User, CreditCard, ShieldCheck, Star, ShieldAlert,
  Bed, Hash, Clock, Plus
} from 'lucide-react';
import { Booking, RoomType, SyncEvent } from '../types';
import GuestProfilePage from './GuestProfilePage';
import { updateBooking } from '../api';

interface GuestsViewProps {
  syncEvents: SyncEvent[];
  setSyncEvents: React.Dispatch<React.SetStateAction<SyncEvent[]>>;
  roomTypes: RoomType[];
  // Fix: Added missing onUpdateExtraBeds prop to interface to match usage in App.tsx
  onUpdateExtraBeds?: (bookingId: string, count: number) => void;
}

// Status Color Mappings (Matching user request and existing styles)
const STATUS_OPTIONS = [
  { value: 'Confirmed', label: 'Confirmed', bg: 'bg-blue-500/90', text: 'text-white' },
  { value: 'Cancelled', label: 'Cancelled', bg: 'bg-red-500/90', text: 'text-white' },
  { value: 'CheckedIn', label: 'Checked In', bg: 'bg-emerald-500/90', text: 'text-white' },
  { value: 'CheckedOut', label: 'Checked Out', bg: 'bg-gray-400/90', text: 'text-white' },
  { value: 'Rejected', label: 'Warning/Unpaid', bg: 'bg-amber-500/90', text: 'text-white' }
];

const GuestsView: React.FC<GuestsViewProps> = ({ syncEvents, setSyncEvents, roomTypes, onUpdateExtraBeds }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const INITIAL_FILTERS = {
    status: [] as string[],
    roomTypeId: [] as string[],
    source: [] as string[],
    isVIP: null as boolean | null,
    nationality: 'All' as 'All' | 'Indian' | 'Foreigner',
    isSettled: null as boolean | null,
    startDate: '',
    endDate: ''
  };

  const [filters, setFilters] = useState(INITIAL_FILTERS);

  const guestList = useMemo(() => {
    return (syncEvents.filter(e => e.type === 'booking') as Booking[])
      .sort((a, b) => b.timestamp - a.timestamp); // Sort by date booked descending
  }, [syncEvents]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status.length > 0) count++;
    if (filters.roomTypeId.length > 0) count++;
    if (filters.source.length > 0) count++;
    if (filters.isVIP !== null) count++;
    if (filters.nationality !== 'All') count++;
    if (filters.isSettled !== null) count++;
    if (filters.startDate || filters.endDate) count++;
    return count;
  }, [filters]);

  const filteredGuests = useMemo(() => {
    return guestList.filter(g => {
      // Search logic
      const query = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || (
        g.guestName.toLowerCase().includes(query) ||
        g.guestDetails?.email?.toLowerCase().includes(query) ||
        g.guestDetails?.phoneNumber?.includes(query) ||
        g.id.includes(query) ||
        g.roomNumber?.toLowerCase().includes(query)
      );

      if (!matchesSearch) return false;

      // Filter logic
      if (filters.status.length > 0 && !filters.status.includes(g.status)) return false;
      if (filters.roomTypeId.length > 0 && !filters.roomTypeId.includes(g.roomTypeId)) return false;
      if (filters.source.length > 0 && !filters.source.includes(g.source)) return false;
      if (filters.isVIP !== null && g.isVIP !== filters.isVIP) return false;
      if (filters.isSettled !== null && g.isSettled !== filters.isSettled) return false;

      if (filters.nationality === 'Indian') {
        const nat = (g.guestDetails?.nationality || 'Indian').toLowerCase();
        if (nat !== 'indian') return false;
      } else if (filters.nationality === 'Foreigner') {
        const nat = (g.guestDetails?.nationality || 'Indian').toLowerCase();
        if (nat === 'indian') return false;
      }

      // Date Range Filter logic
      if (filters.startDate && g.checkIn < filters.startDate) return false;
      if (filters.endDate && g.checkOut > filters.endDate) return false;

      return true;
    });
  }, [guestList, searchQuery, filters]);

  // Sync selectedBooking state with syncEvents when external updates happen
  useEffect(() => {
    if (selectedBooking) {
      const updated = syncEvents.find(e => e.id === selectedBooking.id && e.type === 'booking') as Booking;
      if (updated && updated.timestamp !== selectedBooking.timestamp) {
        setSelectedBooking(updated);
      }
    }
  }, [syncEvents, selectedBooking?.id]);

  const updateGuestStatus = async (bookingId: string, newStatus: string) => {
    const booking = syncEvents.find(e => e.id === bookingId && e.type === 'booking') as Booking | undefined;
    if (!booking) return;

    const updated = { ...booking, status: newStatus as any, timestamp: Date.now() };

    setSyncEvents(prev => prev.map(e => e.id === bookingId && e.type === 'booking' ? { ...updated, type: 'booking' } as SyncEvent : e));
    if (selectedBooking?.id === bookingId) setSelectedBooking(updated);
    setActiveMenu(null);

    try {
      await updateBooking(updated);
    } catch (err) {
      console.error("Failed to persist status update in GuestsView", err);
    }
  };

  const toggleVIP = async (bookingId: string) => {
    const booking = syncEvents.find(e => e.id === bookingId && e.type === 'booking') as Booking | undefined;
    if (!booking) return;

    const updated = { ...booking, isVIP: !booking.isVIP, timestamp: Date.now() };

    setSyncEvents(prev => prev.map(e => e.id === bookingId && e.type === 'booking' ? { ...updated, type: 'booking' } as SyncEvent : e));
    if (selectedBooking?.id === bookingId) setSelectedBooking(updated);

    try {
      await updateBooking(updated);
    } catch (err) {
      console.error("Failed to persist VIP toggle in GuestsView", err);
    }
  };

  const handleUpdateExtraBedsFromProfile = (bookingId: string, count: number) => {
    onUpdateExtraBeds?.(bookingId, count);
  };

  const getStatusDisplay = (status: string) => {
    // Standardizing "Rejected" to "Warning/Unpaid" for display per user request
    if (status === 'Rejected') return 'Warning/Unpaid';
    if (status === 'CheckedIn') return 'Checked In';
    if (status === 'CheckedOut') return 'Checked Out';
    return status;
  };

  const getStatusStyles = (status: string) => {
    const opt = STATUS_OPTIONS.find(o => o.value === status) || STATUS_OPTIONS[0];
    return `${opt.bg} ${opt.text}`;
  };

  const getRoomTypeName = (id: string) => {
    return roomTypes.find(rt => rt.id === id)?.name || 'Standard';
  };

  const handleCheckInRequest = (booking: Booking) => {
    updateGuestStatus(booking.id, 'CheckedIn');
    setSelectedBooking(null);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      {selectedBooking && (
        <GuestProfilePage
          booking={selectedBooking}
          roomTypes={roomTypes}
          onClose={() => setSelectedBooking(null)}
          onUpdateStatus={updateGuestStatus}
          onToggleVIP={toggleVIP}
          onCheckIn={handleCheckInRequest}
          // Fix: Passing wrapped onUpdateExtraBeds to GuestProfilePage
          onUpdateExtraBeds={handleUpdateExtraBedsFromProfile}
        />
      )}

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-600" />
            Guest Database
          </h2>
          <p className="text-slate-500 mt-1 font-medium">Full historical archive with room-specific attribution and accessory guest details.</p>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto relative">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, email, or room #"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-800 focus:border-indigo-500 transition-all outline-none shadow-sm"
            />
          </div>
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`p-3 bg-white border-2 rounded-2xl transition-all shadow-sm relative ${activeFilterCount > 0 ? 'border-indigo-500 text-indigo-600 bg-indigo-50' : 'border-slate-100 text-slate-500 hover:bg-slate-50'}`}
          >
            <Filter className="w-5 h-5 focus:outline-none" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-md animate-in zoom-in">
                {activeFilterCount}
              </span>
            )}
          </button>

          {isFilterOpen && (
            <div className="absolute right-0 top-full mt-4 w-[380px] bg-white rounded-[2rem] shadow-2xl border border-slate-100 z-[100] p-6 animate-in slide-in-from-top-4 duration-300">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Global Filters</h4>
                <button
                  onClick={() => setFilters(INITIAL_FILTERS)}
                  className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest transition-colors"
                >
                  Clear All
                </button>
              </div>

              <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {/* Status Filter */}
                <div className="space-y-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Booking Status</span>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          const next = filters.status.includes(opt.value)
                            ? filters.status.filter(s => s !== opt.value)
                            : [...filters.status, opt.value];
                          setFilters({ ...filters, status: next });
                        }}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${filters.status.includes(opt.value) ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white border-slate-100 text-slate-500 hover:border-indigo-200'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Room Category Filter */}
                <div className="space-y-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Room Category</span>
                  <div className="flex flex-wrap gap-2">
                    {roomTypes.map(rt => (
                      <button
                        key={rt.id}
                        onClick={() => {
                          const next = filters.roomTypeId.includes(rt.id)
                            ? filters.roomTypeId.filter(id => id !== rt.id)
                            : [...filters.roomTypeId, rt.id];
                          setFilters({ ...filters, roomTypeId: next });
                        }}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${filters.roomTypeId.includes(rt.id) ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white border-slate-100 text-slate-500 hover:border-indigo-200'}`}
                      >
                        {rt.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Booking Source */}
                <div className="space-y-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Booking Source</span>
                  <div className="flex flex-wrap gap-2">
                    {['Direct', 'MMT', 'Booking.com', 'Expedia'].map(src => (
                      <button
                        key={src}
                        onClick={() => {
                          const next = filters.source.includes(src)
                            ? filters.source.filter(s => s !== src)
                            : [...filters.source, src];
                          setFilters({ ...filters, source: next });
                        }}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${filters.source.includes(src) ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white border-slate-100 text-slate-500 hover:border-indigo-200'}`}
                      >
                        {src}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* VIP Status */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">VIP Status</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setFilters({ ...filters, isVIP: filters.isVIP === true ? null : true })}
                        className={`flex-1 py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${filters.isVIP === true ? 'bg-violet-600 border-violet-600 text-white shadow-lg shadow-violet-200' : 'bg-white border-slate-100 text-slate-500 hover:border-violet-200'}`}
                      >
                        <Star className={`w-5 h-5 ${filters.isVIP === true ? 'fill-white' : ''}`} />
                        <span className="text-[9px] font-black uppercase tracking-widest">VIP Only</span>
                      </button>
                    </div>
                  </div>

                  {/* Payment Status */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Folio Status</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setFilters({ ...filters, isSettled: filters.isSettled === true ? null : true })}
                        className={`flex-1 py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${filters.isSettled === true ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-white border-slate-100 text-slate-500 hover:border-emerald-200'}`}
                      >
                        <CreditCard className="w-5 h-5" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Settled</span>
                      </button>
                      <button
                        onClick={() => setFilters({ ...filters, isSettled: filters.isSettled === false ? null : false })}
                        className={`flex-1 py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${filters.isSettled === false ? 'bg-rose-600 border-rose-600 text-white shadow-lg shadow-rose-200' : 'bg-white border-slate-100 text-slate-500 hover:border-rose-200'}`}
                      >
                        <ShieldAlert className="w-5 h-5" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Due</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Nationality */}
                <div className="space-y-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Nationality</span>
                  <div className="flex p-1 bg-slate-50 rounded-2xl">
                    {['All', 'Indian', 'Foreigner'].map(nat => (
                      <button
                        key={nat}
                        onClick={() => setFilters({ ...filters, nationality: nat as any })}
                        className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filters.nationality === nat ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {nat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date Range Filter */}
                <div className="space-y-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Stay Period Range</span>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider ml-1">From Arrival</label>
                      <input
                        type="date"
                        value={filters.startDate}
                        onChange={e => setFilters({ ...filters, startDate: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl text-[10px] font-black text-slate-800 outline-none focus:border-indigo-400 shadow-inner"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider ml-1">To Departure</label>
                      <input
                        type="date"
                        value={filters.endDate}
                        onChange={e => setFilters({ ...filters, endDate: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl text-[10px] font-black text-slate-800 outline-none focus:border-indigo-400 shadow-inner"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 flex gap-4">
                <button
                  onClick={() => setIsFilterOpen(false)}
                  className="flex-1 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black transition-all shadow-xl"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Verified Profiles', value: guestList.length, icon: ShieldCheck, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Room Occupancy', value: guestList.filter(g => g.status === 'CheckedIn').length, icon: Bed, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Pending Payments', value: guestList.filter(g => g.status === 'Rejected').length, icon: ShieldAlert, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'VIP Guests', value: guestList.filter(g => g.isVIP).length, icon: Star, color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm flex items-center gap-4">
            <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <h3 className="text-2xl font-black text-slate-900">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Guest Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Guest Info</th>
                <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Room Allocation</th>
                <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact & Identification</th>
                <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Stay Period</th>
                <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredGuests.length > 0 ? (
                filteredGuests.map((guest) => (
                  <tr key={guest.id} className="hover:bg-slate-50/30 transition-colors group cursor-pointer" onClick={() => setSelectedBooking(guest)}>
                    <td className="p-5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 shrink-0 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors relative">
                          <User className="w-6 h-6" />
                          {guest.isVIP && <div className="absolute -top-1 -right-1 bg-violet-500 p-1 rounded-full border-2 border-white shadow-sm"><Star className="w-2 h-2 text-white fill-white" /></div>}
                        </div>
                        <div>
                          <p className="font-black text-slate-900 text-sm">{guest.guestName}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 flex items-center gap-1.5">
                            <Users className="w-3 h-3" /> {guest.pax || 2} Pax • {guest.source}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded shadow-sm">#{guest.roomNumber || '???'}</span>
                          <span className="text-[10px] font-bold text-slate-700 truncate max-w-[100px]">{getRoomTypeName(guest.roomTypeId)}</span>
                        </div>
                        {guest.extraBeds && (
                          <div className="text-[9px] font-black text-amber-500 uppercase flex items-center gap-1">
                            <Plus className="w-2.5 h-2.5" /> Extra Bed
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                          <FileBadge className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{guest.guestDetails?.idNumber || 'No ID Ref'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                          <Smartphone className="w-3 h-3" />
                          <span>{guest.guestDetails?.phoneNumber || 'N/A'}</span>
                        </div>
                        {guest.accessoryGuests && guest.accessoryGuests.length > 0 && (
                          <div className="text-[9px] font-bold text-indigo-400 italic">
                            +{guest.accessoryGuests.length} co-residents
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-5">
                      <div className="space-y-1">
                        <p className="text-[11px] font-black text-slate-800 flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-emerald-500" /> {guest.checkIn}
                        </p>
                        <p className="text-[11px] font-black text-slate-800 flex items-center gap-1.5 pl-4 opacity-50">
                          {guest.checkOut}
                        </p>
                      </div>
                    </td>
                    <td className="p-5">
                      <div className="flex justify-center">
                        <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all ${getStatusStyles(guest.status)}`}>
                          {getStatusDisplay(guest.status)}
                        </span>
                      </div>
                    </td>
                    <td className="p-5 text-center">
                      <button className="p-3 bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-2xl transition-all">
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-4 text-slate-400">
                      <div className="p-5 bg-slate-50 rounded-full">
                        <Users className="w-10 h-10" />
                      </div>
                      <p className="font-bold">No guest records found.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Data Policy Footer */}
      <div className="bg-indigo-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <ShieldCheck className="w-48 h-48" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="p-5 bg-white/10 rounded-3xl backdrop-blur-md border border-white/20">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black tracking-tight uppercase">Strategic Profile Sync</h3>
            <p className="text-indigo-100/80 text-sm max-w-2xl leading-relaxed">
              Booking attribution is tracked down to the individual room level. Accessory guest identifiers and special requirements are indexed for police reporting compliance and operational personalization.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestsView;
