
import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, Download, Filter, Search, Calendar, 
  ChevronDown, CheckSquare, Square, Printer, FileText,
  ShieldAlert, AlertTriangle, BedDouble, Clock
} from 'lucide-react';
import { Booking } from '../types';

// Room Name Mapping
const ROOM_NAMES: Record<string, string> = {
  'rt-1': 'Deluxe Room (AC)',
  'rt-2': 'Double Bed Room',
  'rt-3': 'Single Bed Room',
  'rt-4': 'Dormitory'
};

// Mock Data Generator for Reports
const generateMockBookings = (): Booking[] => {
  const sources: Booking['source'][] = ['MMT', 'Booking.com', 'Expedia', 'Direct'];
  const statuses: Booking['status'][] = ['Confirmed', 'Confirmed', 'Confirmed', 'Cancelled', 'Rejected'];
  const rejectionReasons = ['Inventory Collision', 'Price Below Floor', 'Payment Gateway Fail', 'Min Stay Violation'];
  const roomTypeIds = ['rt-1', 'rt-2', 'rt-3', 'rt-4'];
  
  return Array.from({ length: 50 }).map((_, i) => {
    const checkInDate = new Date();
    checkInDate.setDate(checkInDate.getDate() - Math.floor(Math.random() * 60)); // Past 60 days
    const stayDuration = Math.floor(Math.random() * 5) + 1;
    const checkOutDate = new Date(checkInDate);
    checkOutDate.setDate(checkInDate.getDate() + stayDuration);

    const amount = (Math.floor(Math.random() * 150) + 50) * 100 * stayDuration;
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    const booking: Booking = {
      id: `b-${1000 + i}`,
      roomTypeId: roomTypeIds[Math.floor(Math.random() * roomTypeIds.length)],
      guestName: `Guest User ${i + 1}`,
      source: sources[Math.floor(Math.random() * sources.length)],
      status: status,
      timestamp: Date.now(),
      checkIn: checkInDate.toISOString().split('T')[0],
      checkOut: checkOutDate.toISOString().split('T')[0],
      amount: amount
    };

    if (status === 'Rejected') {
      booking.rejectionReason = rejectionReasons[Math.floor(Math.random() * rejectionReasons.length)];
      booking.amount = 0; // Rejected bookings shouldn't recognize revenue
    }

    return booking;
  });
};

const MOCK_DATA = generateMockBookings();
const CHANNELS = ['All', 'Booking.com', 'MMT', 'Expedia', 'Direct'];

const ReportsView: React.FC = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['All']);
  const [searchQuery, setSearchQuery] = useState('');
  const [isChannelMenuOpen, setIsChannelMenuOpen] = useState(false);

  // Filter Logic
  const filteredData = useMemo(() => {
    return MOCK_DATA.filter(booking => {
      // Date Range Filter
      if (startDate && booking.checkIn < startDate) return false;
      if (endDate && booking.checkOut > endDate) return false;

      // Channel Filter
      if (!selectedChannels.includes('All') && !selectedChannels.includes(booking.source)) return false;

      // Search Filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          booking.guestName.toLowerCase().includes(query) ||
          booking.id.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [startDate, endDate, selectedChannels, searchQuery]);

  const toggleChannel = (channel: string) => {
    if (channel === 'All') {
      setSelectedChannels(['All']);
    } else {
      let newChannels = selectedChannels.filter(c => c !== 'All');
      if (selectedChannels.includes(channel)) {
        newChannels = newChannels.filter(c => c !== channel);
      } else {
        newChannels = [...newChannels, channel];
      }
      if (newChannels.length === 0) newChannels = ['All'];
      setSelectedChannels(newChannels);
    }
  };

  const getDuration = (checkIn: string, checkOut: string) => {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  };

  const handleDownloadCSV = () => {
    const headers = ['ID,Guest Name,Room Type,Channel,Check-in,Check-out,Duration (Nights),Amount,Status,Reason'];
    const rows = filteredData.map(b => {
       const duration = getDuration(b.checkIn, b.checkOut);
       const roomName = ROOM_NAMES[b.roomTypeId] || b.roomTypeId;
       return `${b.id},"${b.guestName}","${roomName}",${b.source},${b.checkIn},${b.checkOut},${duration},${b.amount},${b.status},${b.rejectionReason || ''}`;
    });
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `bookings_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPDF = () => {
    // Simulation of Backend API Call
    alert(`Generating PDF Report via /api/reports/bookings...\n\nFilters:\nStart: ${startDate || 'Any'}\nEnd: ${endDate || 'Any'}\nChannels: ${selectedChannels.join(', ')}`);
  };

  const totalRevenue = filteredData.reduce((sum, b) => {
    // Only include confirmed bookings in revenue calculation
    if (b.status === 'Confirmed') {
      return sum + (b.amount || 0);
    }
    return sum;
  }, 0);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Booking Reports</h2>
          <p className="text-slate-500 mt-2">Generate detailed transaction logs and revenue statements.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 font-bold text-xs rounded-xl transition-all shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Download CSV
          </button>
          <button 
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs rounded-xl transition-all shadow-lg shadow-slate-900/10"
          >
            <FileText className="w-4 h-4" /> Download PDF
          </button>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl flex-1 w-full md:w-auto">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input 
            type="date" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-700 outline-none w-full"
            placeholder="Start Date"
          />
          <span className="text-slate-300">-</span>
          <input 
            type="date" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-700 outline-none w-full"
          />
        </div>

        <div className="relative w-full md:w-64 z-20">
          <button 
            onClick={() => setIsChannelMenuOpen(!isChannelMenuOpen)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-indigo-500" />
              <span className="truncate">
                {selectedChannels.includes('All') ? 'All Channels' : `${selectedChannels.length} Selected`}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {isChannelMenuOpen && (
            <div className="absolute top-full mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-xl p-2 flex flex-col gap-1">
              {CHANNELS.map(channel => (
                <button
                  key={channel}
                  onClick={() => toggleChannel(channel)}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-700 w-full text-left"
                >
                  {selectedChannels.includes(channel) ? (
                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-300" />
                  )}
                  {channel}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl flex-[2] w-full md:w-auto">
          <Search className="w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search Guest Name or Booking ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-700 outline-none w-full placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Summary Stat */}
      <div className="flex justify-end">
        <div className="bg-indigo-50 border border-indigo-100 px-6 py-3 rounded-2xl flex items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Total Revenue (Period)</span>
            <span className="text-xl font-black text-indigo-900">₹{totalRevenue.toLocaleString()}</span>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['ID', 'Guest Name', 'Room Type', 'Channel', 'Check-in', 'Check-out', 'Duration', 'Amount', 'Status'].map((h) => (
                  <th key={h} className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredData.length > 0 ? (
                filteredData.map((booking) => {
                  const duration = getDuration(booking.checkIn, booking.checkOut);
                  return (
                  <tr key={booking.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-5 text-xs font-bold text-slate-500 font-mono">{booking.id}</td>
                    <td className="p-5 text-sm font-bold text-slate-900">{booking.guestName}</td>
                    
                    {/* Room Type Column */}
                    <td className="p-5">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-50 text-indigo-500 rounded-lg">
                          <BedDouble className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-bold text-slate-600">
                          {ROOM_NAMES[booking.roomTypeId] || booking.roomTypeId}
                        </span>
                      </div>
                    </td>

                    <td className="p-5">
                      <span className={`
                        inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide border
                        ${booking.source === 'Booking.com' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                          booking.source === 'MMT' ? 'bg-red-50 text-red-600 border-red-100' :
                          booking.source === 'Expedia' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                          'bg-emerald-50 text-emerald-600 border-emerald-100'}
                      `}>
                        {booking.source}
                      </span>
                    </td>
                    <td className="p-5 text-xs font-medium text-slate-600">{booking.checkIn}</td>
                    <td className="p-5 text-xs font-medium text-slate-600">{booking.checkOut}</td>
                    
                    {/* Duration Column */}
                    <td className="p-5">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span className="text-xs font-bold text-slate-700">{duration} Nights</span>
                      </div>
                    </td>

                    <td className="p-5 text-sm font-bold text-slate-900">
                      {booking.status === 'Rejected' || booking.status === 'Cancelled' ? (
                        <span className="text-slate-300 font-normal line-through">₹{booking.amount?.toLocaleString()}</span>
                      ) : (
                        `₹${booking.amount?.toLocaleString()}`
                      )}
                    </td>
                    <td className="p-5">
                      <div className="flex flex-col gap-1">
                        <span className={`
                          flex items-center gap-1.5 w-fit
                          ${booking.status === 'Confirmed' ? 'text-emerald-600' : 
                            booking.status === 'Cancelled' ? 'text-slate-400' : 'text-red-600'}
                        `}>
                          {booking.status === 'Rejected' ? <ShieldAlert className="w-3.5 h-3.5" /> : (
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              booking.status === 'Confirmed' ? 'bg-emerald-500' : 
                              booking.status === 'Cancelled' ? 'bg-slate-400' : 'bg-red-500'
                            }`} />
                          )}
                          <span className="text-[10px] font-black uppercase tracking-widest">{booking.status}</span>
                        </span>
                        
                        {booking.status === 'Rejected' && booking.rejectionReason && (
                          <div className="flex items-center gap-1 text-[9px] font-bold text-red-400 bg-red-50 px-2 py-1 rounded-md w-fit">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            {booking.rejectionReason}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )})
              ) : (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400">
                    <p className="text-sm font-bold">No bookings found matching filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportsView;
