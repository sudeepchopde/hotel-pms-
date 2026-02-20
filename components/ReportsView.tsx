import React, { useState, useMemo, useEffect } from "react";
import {
  FileSpreadsheet,
  Download,
  Filter,
  Search,
  Calendar,
  ChevronDown,
  CheckSquare,
  Square,
  Printer,
  FileText,
  ShieldAlert,
  AlertTriangle,
  BedDouble,
  Clock,
  Loader2,
} from "lucide-react";
import { Booking, RoomType } from "../types";
import { API_BASE_URL } from "../api";
import { formatDate } from "../utils";

const CHANNELS = ["All", "Booking.com", "MMT", "Expedia", "Direct"];

const ReportsView: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<string[]>(["All"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isChannelMenuOpen, setIsChannelMenuOpen] = useState(false);
  const [activeQuickFilter, setActiveQuickFilter] = useState<
    "past30" | "upcoming90" | null
  >(null);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const upcomingCount = useMemo(() => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 90);
    const futureStr = futureDate.toISOString().split("T")[0];

    return bookings.filter((b) => b.checkIn >= today && b.checkIn <= futureStr)
      .length;
  }, [bookings, today]);

  const handleQuickFilter = (type: "past30" | "upcoming90") => {
    const start = new Date();
    const end = new Date();

    if (type === "past30") {
      start.setDate(start.getDate() - 30);
      setStartDate(start.toISOString().split("T")[0]);
      setEndDate(today);
      setActiveQuickFilter("past30");
    } else {
      end.setDate(end.getDate() + 90);
      setStartDate(today);
      setEndDate(end.toISOString().split("T")[0]);
      setActiveQuickFilter("upcoming90");
    }
  };

  // Fetch Data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [bookingsRes, roomTypesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/bookings`),
          fetch(`${API_BASE_URL}/room-types`),
        ]);
        const bData = await bookingsRes.json();
        const rData = await roomTypesRes.json();
        setBookings(bData);
        setRoomTypes(rData);
      } catch (error) {
        console.error("Failed to load report data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Room Name Mapping from fetched room types
  const roomNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    roomTypes.forEach((rt) => {
      map[rt.id] = rt.name;
    });
    return map;
  }, [roomTypes]);

  // Filter Logic
  const filteredData = useMemo(() => {
    return bookings.filter((booking) => {
      // Date Range Filter
      if (startDate && booking.checkIn < startDate) return false;
      if (endDate && booking.checkOut > endDate) return false;

      // Channel Filter
      if (
        !selectedChannels.includes("All") &&
        !selectedChannels.includes(booking.source)
      )
        return false;

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
  }, [bookings, startDate, endDate, selectedChannels, searchQuery]);

  const toggleChannel = (channel: string) => {
    if (channel === "All") {
      setSelectedChannels(["All"]);
    } else {
      let newChannels = selectedChannels.filter((c) => c !== "All");
      if (selectedChannels.includes(channel)) {
        newChannels = newChannels.filter((c) => c !== channel);
      } else {
        newChannels = [...newChannels, channel];
      }
      if (newChannels.length === 0) newChannels = ["All"];
      setSelectedChannels(newChannels);
    }
  };

  const getDuration = (checkIn: string, checkOut: string) => {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
  };

  const getPaidAmount = (b: Booking) => {
    if (!b.payments) return 0;
    return b.payments.reduce(
      (sum, p) => (p.status === "Completed" ? sum + (p.amount || 0) : sum),
      0,
    );
  };

  const handleDownloadCSV = () => {
    const headers = [
      "ID,Guest Name,Room Type,Channel,Check-in,Check-out,Duration (Nights),Bill Amount,Paid Amount,Status,Reason",
    ];
    const rows = filteredData.map((b) => {
      const duration = getDuration(b.checkIn, b.checkOut);
      const roomName = roomNameMap[b.roomTypeId] || b.roomTypeId;
      const paid = getPaidAmount(b);
      return `${b.id},"${b.guestName}","${roomName}",${b.source},${b.checkIn},${b.checkOut},${duration},${b.amount},${paid},${b.status},${b.rejectionReason || ""}`;
    });
    const csvContent =
      "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `bookings_list_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPDF = () => {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    if (selectedChannels.length > 0) {
      params.append("channels", selectedChannels.join(","));
    }

    const url = `${API_BASE_URL}/reports/bookings?${params.toString()}`;
    window.open(url, "_blank");
  };

  const totalRevenue = useMemo(() => {
    return filteredData.reduce((sum, b) => {
      return sum + getPaidAmount(b);
    }, 0);
  }, [filteredData]);

  // Removed internal formatDate function and using the imported utility instead.

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
        <p className="text-slate-400 font-bold animate-pulse">
          Loading real-time records...
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            Bookings
          </h2>
          <p className="text-slate-500 mt-2">
            Generate detailed transaction logs and revenue statements.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 font-bold text-xs rounded-xl transition-all shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Download
            CSV
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
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleQuickFilter("past30")}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all border ${
              activeQuickFilter === "past30"
                ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200"
                : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
            }`}
          >
            Past 30 Days
          </button>
          <button
            onClick={() => handleQuickFilter("upcoming90")}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all border ${
              activeQuickFilter === "upcoming90"
                ? "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-200"
                : "bg-white text-slate-600 border-slate-200 hover:border-orange-300 hover:bg-slate-50"
            }`}
          >
            Upcoming 90 Days ({upcomingCount})
          </button>

          <div className="h-4 w-px bg-slate-200 mx-2 hidden md:block" />

          <div className="flex flex-col sm:flex-row gap-4 items-center flex-1 min-w-[300px]">
            <div className="relative w-full">
              <label className="absolute -top-2 left-3 bg-white px-1 text-[10px] font-bold text-slate-400">
                From
              </label>
              <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl w-full hover:border-indigo-300 transition-colors">
                <Calendar className="w-4 h-4 text-indigo-500" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setActiveQuickFilter(null);
                  }}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none w-full"
                />
              </div>
            </div>

            <div className="relative w-full">
              <label className="absolute -top-2 left-3 bg-white px-1 text-[10px] font-bold text-slate-400">
                To
              </label>
              <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl w-full hover:border-indigo-300 transition-colors">
                <Calendar className="w-4 h-4 text-indigo-500" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setActiveQuickFilter(null);
                  }}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none w-full"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative z-20">
            <button
              onClick={() => setIsChannelMenuOpen(!isChannelMenuOpen)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-indigo-500" />
                <span className="truncate">
                  {selectedChannels.includes("All")
                    ? "All Channels"
                    : `${selectedChannels.length} Selected`}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isChannelMenuOpen && (
              <div className="absolute top-full mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-xl p-2 flex flex-col gap-1">
                {CHANNELS.map((channel) => (
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

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus-within:border-indigo-400 transition-all shadow-sm">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search Guest Name or Booking ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 outline-none w-full placeholder:text-slate-400"
              />
            </div>
            <button className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 flex items-center gap-2 shrink-0">
              <Search className="w-4 h-4" />
              Search
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stat */}
      <div className="flex justify-end">
        <div className="bg-indigo-50 border border-indigo-100 px-6 py-3 rounded-2xl flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
            Total Collections (Period)
          </span>
          <span className="text-xl font-black text-indigo-900">
            ₹{totalRevenue.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {[
                  "ID",
                  "Guest Name",
                  "Room Type",
                  "Channel",
                  "Check-in",
                  "Check-out",
                  "Duration",
                  "Bill Amount",
                  "Paid",
                  "Status",
                ].map((h) => (
                  <th
                    key={h}
                    className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredData.length > 0 ? (
                filteredData.map((booking) => {
                  const duration = getDuration(
                    booking.checkIn,
                    booking.checkOut,
                  );
                  const paidAmount = getPaidAmount(booking);
                  return (
                    <tr
                      key={booking.id}
                      className="hover:bg-slate-50/50 transition-colors group"
                    >
                      <td className="p-5 text-xs font-bold text-slate-500 font-mono">
                        {booking.id}
                      </td>
                      <td className="p-5 text-sm font-bold text-slate-900">
                        {booking.guestName}
                      </td>

                      {/* Room Type Column */}
                      <td className="p-5">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-indigo-50 text-indigo-500 rounded-lg">
                            <BedDouble className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs font-bold text-slate-600">
                            {roomNameMap[booking.roomTypeId] ||
                              booking.roomTypeId}
                          </span>
                        </div>
                      </td>

                      <td className="p-5">
                        <span
                          className={`
                        inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide border
                        ${
                          booking.source === "Booking.com"
                            ? "bg-blue-50 text-blue-600 border-blue-100"
                            : booking.source === "MMT"
                              ? "bg-red-50 text-red-600 border-red-100"
                              : booking.source === "Expedia"
                                ? "bg-yellow-50 text-yellow-600 border-yellow-100"
                                : "bg-emerald-50 text-emerald-600 border-emerald-100"
                        }
                      `}
                        >
                          {booking.source}
                        </span>
                      </td>
                      <td className="p-5 text-xs font-medium text-slate-600">
                        {formatDate(booking.checkIn)}
                      </td>
                      <td className="p-5 text-xs font-medium text-slate-600">
                        {formatDate(booking.checkOut)}
                      </td>

                      {/* Duration Column */}
                      <td className="p-5">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span className="text-xs font-bold text-slate-700">
                            {duration} Nights
                          </span>
                        </div>
                      </td>

                      <td className="p-5 text-sm font-bold text-slate-900">
                        {booking.status === "Rejected" ||
                        booking.status === "Cancelled" ? (
                          <span className="text-slate-300 font-normal line-through">
                            ₹{booking.amount?.toLocaleString()}
                          </span>
                        ) : (
                          `₹${booking.amount?.toLocaleString()}`
                        )}
                      </td>

                      {/* Paid Amount Column */}
                      <td className="p-5 text-sm font-bold text-emerald-600">
                        ₹{paidAmount.toLocaleString()}
                      </td>

                      <td className="p-5">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`
                          flex items-center gap-1.5 w-fit
                          ${
                            booking.status === "Confirmed" ||
                            booking.status === "CheckedIn" ||
                            booking.status === "CheckedOut"
                              ? "text-emerald-600"
                              : booking.status === "Cancelled"
                                ? "text-slate-400"
                                : "text-red-600"
                          }
                        `}
                          >
                            {booking.status === "Rejected" ? (
                              <ShieldAlert className="w-3.5 h-3.5" />
                            ) : (
                              <div
                                className={`w-1.5 h-1.5 rounded-full ${
                                  booking.status === "Confirmed" ||
                                  booking.status === "CheckedIn" ||
                                  booking.status === "CheckedOut"
                                    ? "bg-emerald-500"
                                    : booking.status === "Cancelled"
                                      ? "bg-slate-400"
                                      : "bg-red-500"
                                }`}
                              />
                            )}
                            <span className="text-[10px] font-black uppercase tracking-widest">
                              {booking.status}
                            </span>
                          </span>

                          {booking.status === "Rejected" &&
                            booking.rejectionReason && (
                              <div className="flex items-center gap-1 text-[9px] font-bold text-red-400 bg-red-50 px-2 py-1 rounded-md w-fit">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                {booking.rejectionReason}
                              </div>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400">
                    <p className="text-sm font-bold">
                      No bookings found matching filters.
                    </p>
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
