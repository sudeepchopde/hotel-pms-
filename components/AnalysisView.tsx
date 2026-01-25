
import React, { useEffect, useState, useMemo } from 'react';
import { BarChart3, PieChart, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, DollarSign, Activity, BedDouble, Loader2 } from 'lucide-react';

interface StatsData {
  summary: {
    totalRevenueYTD: number;
    totalBookingsYTD: number;
    avgDailyRate: number;
    revenueGrowth: number;
    bookingsGrowth: number;
    adrGrowth: number;
  };
  revenueShare: Array<{ name: string; value: number; color: string; hex: string }>;
  trends: {
    daily: Array<{ label: string; channels: any; total: number }>;
    weekly: Array<{ label: string; channels: any; total: number }>;
    monthly: Array<{ label: string; channels: any; total: number }>;
  };
  popularity: {
    roomTypes: Array<{ name: string; value: number }>;
    bookingTrend: Array<{ label: string; channels: any; total: number }>;
  };
}

const AnalysisView: React.FC = () => {
  // State for controls
  const [timeFilter, setTimeFilter] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [sharePeriod, setSharePeriod] = useState<'1m' | '6m' | '1y'>('1y');
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch performance data
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:8000/api/statistics');
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error("Failed to fetch statistics:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  // Derived Trend data based on filter
  const chartData = useMemo(() => {
    if (!stats) return [];
    return stats.trends[timeFilter] || [];
  }, [stats, timeFilter]);

  const maxVal = useMemo(() => {
    if (chartData.length === 0) return 0;
    if (sourceFilter === 'all') return Math.max(...chartData.map(d => d.total));
    return Math.max(...chartData.map(d => d.channels[sourceFilter] || 0));
  }, [chartData, sourceFilter]);

  // Derived Share data (Since backend currently returns YTD, we use that for all periods in demo, 
  // but in real app we could pass params to /api/statistics)
  const normalizedChannelData = useMemo(() => {
    if (!stats) return [];
    return stats.revenueShare;
  }, [stats]);

  // Derived room popularity data
  const roomTypeData = useMemo(() => {
    if (!stats) return [];
    return stats.popularity.roomTypes;
  }, [stats]);

  const bookingsTrend = useMemo(() => {
    if (!stats) return [];
    return stats.popularity.bookingTrend;
  }, [stats]);

  const maxBookings = useMemo(() =>
    bookingsTrend.length > 0 ? Math.max(...bookingsTrend.map(d => d.total)) : 10
    , [bookingsTrend]);

  const maxRoomPopularity = useMemo(() =>
    roomTypeData.length > 0 ? Math.max(...roomTypeData.map(d => d.value)) : 10
    , [roomTypeData]);

  // Robust Pie Chart Gradient
  const pieGradient = useMemo(() => {
    if (!stats || stats.revenueShare.length === 0) return '#f1f5f9';
    let currentPos = 0;
    const parts = stats.revenueShare.map(c => {
      const start = currentPos;
      currentPos += c.value;
      return `${c.hex} ${start}% ${currentPos}%`;
    });
    return `conic-gradient(${parts.join(', ')})`;
  }, [stats]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
        <p className="text-slate-400 font-bold animate-pulse">Processing real-time analytics...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100">
          Failed to load analytics. Please check backend connection.
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      <header>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Performance Analytics</h2>
        <p className="text-slate-500 mt-2">Deep dive into revenue, channel performance, and booking trends.</p>
      </header>

      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <DollarSign className="w-6 h-6" />
            </div>
            <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg ${stats.summary.revenueGrowth >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-500 bg-red-50'}`}>
              {stats.summary.revenueGrowth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(stats.summary.revenueGrowth)}%
            </span>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Revenue (YTD)</p>
          <h3 className="text-3xl font-black text-slate-900 mt-1">₹{(stats.summary.totalRevenueYTD / 100000).toFixed(1)}L</h3>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Calendar className="w-6 h-6" />
            </div>
            <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg ${stats.summary.bookingsGrowth >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-500 bg-red-50'}`}>
              {stats.summary.bookingsGrowth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(stats.summary.bookingsGrowth)}%
            </span>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Bookings (YTD)</p>
          <h3 className="text-3xl font-black text-slate-900 mt-1">{stats.summary.totalBookingsYTD.toLocaleString()}</h3>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-fuchsia-50 text-fuchsia-600 rounded-2xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg ${stats.summary.adrGrowth >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-500 bg-red-50'}`}>
              {stats.summary.adrGrowth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(stats.summary.adrGrowth)}%
            </span>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Avg. Daily Rate</p>
          <h3 className="text-3xl font-black text-slate-900 mt-1">₹{stats.summary.avgDailyRate.toLocaleString()}</h3>
        </div>
      </div>

      {/* NEW Interactive Revenue Chart - Full width */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col min-h-[480px]">
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-500" /> Revenue Trends
              </h3>
              <p className="text-xs text-slate-400 mt-1">Revenue analysis by source and time</p>
            </div>

            {/* Controls */}
            <div className="flex gap-2">
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600 outline-none"
              >
                <option value="all">All Sources</option>
                <option value="bcom">Booking.com</option>
                <option value="mmt">MakeMyTrip</option>
                <option value="exp">Expedia</option>
                <option value="dir">Direct</option>
              </select>

              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as any)}
                className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600 outline-none"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>

          {sourceFilter === 'all' && (
            <div className="flex gap-4 border-t border-slate-50 pt-4 overflow-x-auto pb-2">
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest cursor-default whitespace-nowrap"><div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#ef4444' }}></div> MMT</div>
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest cursor-default whitespace-nowrap"><div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#3b82f6' }}></div> B.com</div>
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest cursor-default whitespace-nowrap"><div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#eab308' }}></div> Exp</div>
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest cursor-default whitespace-nowrap"><div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#10b981' }}></div> Dir</div>
            </div>
          )}
        </div>

        <div className="h-72 flex items-end justify-between gap-1 md:gap-4 mt-auto px-2">
          {chartData.map((d, i) => {
            const total = sourceFilter === 'all' ? d.total : (d.channels[sourceFilter] || 0);
            const heightPercent = maxVal > 0 ? (total / maxVal) * 100 : 0;

            return (
              <div key={i} className="flex flex-col items-center gap-2 w-full group cursor-pointer h-full justify-end">
                <span className="text-[9px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-slate-800 text-white px-1.5 py-0.5 rounded shadow-sm z-10">
                  ₹{(total / 1000).toFixed(0)}k
                </span>
                <div
                  className="w-full bg-slate-50 rounded-t-lg overflow-hidden flex flex-col-reverse shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] border-x border-t border-slate-100 transition-all duration-300 group-hover:bg-slate-100"
                  style={{ height: `${Math.max(heightPercent, 3)}%`, minHeight: '4px' }}
                >
                  {sourceFilter === 'all' ? (
                    <>
                      <div style={{ height: `${(d.channels.dir / d.total) * 100}%`, backgroundColor: '#10b981' }} className="w-full"></div>
                      <div style={{ height: `${(d.channels.exp / d.total) * 100}%`, backgroundColor: '#eab308' }} className="w-full"></div>
                      <div style={{ height: `${(d.channels.bcom / d.total) * 100}%`, backgroundColor: '#3b82f6' }} className="w-full"></div>
                      <div style={{ height: `${(d.channels.mmt / d.total) * 100}%`, backgroundColor: '#ef4444' }} className="w-full"></div>
                    </>
                  ) : (
                    <div
                      className="w-full h-full"
                      style={{
                        backgroundColor: sourceFilter === 'bcom' ? '#3b82f6' :
                          sourceFilter === 'mmt' ? '#ef4444' :
                            sourceFilter === 'exp' ? '#eab308' : '#10b981'
                      }}
                    ></div>
                  )}
                </div>
                <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-tighter truncate w-full text-center mt-1">
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Revenue Share */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-emerald-500" /> Revenue Share
          </h3>
          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
            {(['1m', '6m', '1y'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setSharePeriod(p)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${sharePeriod === p
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
                  }`}
              >
                {p === '1m' ? '1 Month' : p === '6m' ? '6 Months' : '1 Year'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col lg:flex-row items-center justify-around gap-12">
          <div className="relative shrink-0">
            <div
              className="w-48 h-48 sm:w-56 sm:h-56 rounded-full shadow-2xl relative transition-all duration-1000"
              style={{ background: pieGradient }}
            >
              <div className="absolute inset-10 bg-white rounded-full flex items-center justify-center flex-col shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)]">
                <span className="text-4xl font-black text-slate-800 tracking-tight">4</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">Active<br />Channels</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6 w-full max-w-xl px-4">
            {stats.revenueShare.map(c => (
              <div key={c.name} className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center px-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${c.color} shadow-sm`}></div>
                    <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">{c.name}</p>
                  </div>
                  <p className="text-[11px] font-black text-slate-900">{c.value}%</p>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner">
                  <div className={`h-full rounded-full ${c.color} transition-all duration-1000`} style={{ width: `${c.value}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Monthly Booking Count */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-fuchsia-500" /> Booking Count
              </h3>
              <p className="text-xs text-slate-400 mt-1">Total bookings by frequency</p>
            </div>
          </div>

          <div className="h-64 flex items-end justify-between gap-4 px-2">
            {bookingsTrend.map((d) => (
              <div key={d.label} className="flex flex-col items-center gap-2 w-full group cursor-pointer h-full justify-end">
                <span className="text-[10px] font-black text-slate-400 group-hover:text-slate-900 transition-colors">{d.total}</span>
                <div
                  className="w-full bg-indigo-500/10 hover:bg-indigo-500/20 rounded-xl overflow-hidden flex flex-col-reverse border border-indigo-100 shadow-sm transition-all"
                  style={{ height: `${(d.total / maxBookings) * 100}%`, minHeight: '4px' }}
                >
                  <div className="bg-indigo-500 w-full h-full opacity-80 group-hover:opacity-100 transition-all"></div>
                </div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate w-full text-center">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Room Type Popularity */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <BedDouble className="w-5 h-5 text-indigo-500" /> Room Type Popularity
              </h3>
              <p className="text-xs text-slate-400 mt-1">Bookings by category</p>
            </div>
          </div>

          <div className="h-64 flex items-end justify-between gap-4 px-2">
            {roomTypeData.map((rt) => (
              <div key={rt.name} className="flex flex-col items-center gap-2 w-full group cursor-pointer h-full justify-end">
                <span className="text-[10px] font-black text-slate-400 group-hover:text-slate-900 transition-colors">{rt.value}</span>
                <div
                  className="w-full bg-slate-50 rounded-xl overflow-hidden flex flex-col-reverse border border-slate-100 shadow-sm transition-all"
                  style={{ height: `${(rt.value / maxRoomPopularity) * 100}%`, minHeight: '4px' }}
                >
                  <div className="bg-fuchsia-500 w-full h-full opacity-80 group-hover:opacity-100 transition-all"></div>
                </div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate w-full text-center">{rt.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisView;
