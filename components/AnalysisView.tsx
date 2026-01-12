
import React from 'react';
import { BarChart3, PieChart, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, DollarSign, Activity, BedDouble } from 'lucide-react';

const AnalysisView: React.FC = () => {
  // Mock Data for Charts - Updated with channel breakdown for Revenue
  const revenueData = [
    { month: 'Jan', channels: { mmt: 112500, bcom: 202500, exp: 90000, dir: 45000 }, total: 450000 },
    { month: 'Feb', channels: { mmt: 130000, bcom: 234000, exp: 104000, dir: 52000 }, total: 520000 },
    { month: 'Mar', channels: { mmt: 120000, bcom: 216000, exp: 96000, dir: 48000 }, total: 480000 },
    { month: 'Apr', channels: { mmt: 152500, bcom: 274500, exp: 122000, dir: 61000 }, total: 610000 },
    { month: 'May', channels: { mmt: 147500, bcom: 265500, exp: 118000, dir: 59000 }, total: 590000 },
    { month: 'Jun', channels: { mmt: 187500, bcom: 337500, exp: 150000, dir: 75000 }, total: 750000 },
  ];
  const maxRev = Math.max(...revenueData.map(d => d.total));

  const channelData = [
    { name: 'Booking.com', value: 45, color: 'bg-blue-500' },
    { name: 'MakeMyTrip', value: 30, color: 'bg-red-500' },
    { name: 'Expedia', value: 15, color: 'bg-yellow-500' },
    { name: 'Direct', value: 10, color: 'bg-emerald-500' },
  ];

  const bookingsData = [
     { month: 'Jan', channels: { mmt: 40, bcom: 55, exp: 20, dir: 15 }, total: 130 },
     { month: 'Feb', channels: { mmt: 45, bcom: 60, exp: 22, dir: 18 }, total: 145 },
     { month: 'Mar', channels: { mmt: 42, bcom: 58, exp: 25, dir: 20 }, total: 145 },
     { month: 'Apr', channels: { mmt: 55, bcom: 70, exp: 30, dir: 25 }, total: 180 },
     { month: 'May', channels: { mmt: 50, bcom: 65, exp: 28, dir: 30 }, total: 173 },
     { month: 'Jun', channels: { mmt: 65, bcom: 85, exp: 35, dir: 40 }, total: 225 },
  ];
  const maxBookings = Math.max(...bookingsData.map(d => d.total));

  const roomTypeData = [
    { month: 'Jan', types: { deluxe: 65, double: 45, single: 20 }, total: 130 },
    { month: 'Feb', types: { deluxe: 75, double: 50, single: 20 }, total: 145 },
    { month: 'Mar', types: { deluxe: 70, double: 55, single: 20 }, total: 145 },
    { month: 'Apr', types: { deluxe: 90, double: 60, single: 30 }, total: 180 },
    { month: 'May', types: { deluxe: 85, double: 58, single: 30 }, total: 173 },
    { month: 'Jun', types: { deluxe: 110, double: 75, single: 40 }, total: 225 },
  ];
  const maxRoomBookings = Math.max(...roomTypeData.map(d => d.total));

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      <header>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Performance Analytics</h2>
        <p className="text-slate-500 mt-2">Deep dive into revenue, channel performance, and booking trends.</p>
      </header>

      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
           <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                 <DollarSign className="w-6 h-6" />
              </div>
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                <ArrowUpRight className="w-3 h-3" /> +12.5%
              </span>
           </div>
           <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Revenue (YTD)</p>
           <h3 className="text-3xl font-black text-slate-900 mt-1">₹34.8L</h3>
        </div>
         <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
           <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                 <Calendar className="w-6 h-6" />
              </div>
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                <ArrowUpRight className="w-3 h-3" /> +8.2%
              </span>
           </div>
           <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Bookings (YTD)</p>
           <h3 className="text-3xl font-black text-slate-900 mt-1">1,248</h3>
        </div>
         <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
           <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-fuchsia-50 text-fuchsia-600 rounded-2xl">
                 <TrendingUp className="w-6 h-6" />
              </div>
              <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-50 px-2 py-1 rounded-lg">
                <ArrowDownRight className="w-3 h-3" /> -1.2%
              </span>
           </div>
           <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Avg. Daily Rate</p>
           <h3 className="text-3xl font-black text-slate-900 mt-1">₹8,450</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Monthly Revenue Chart */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
           <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
             <div>
               <h3 className="font-bold text-slate-900 flex items-center gap-2">
                 <BarChart3 className="w-5 h-5 text-indigo-500" /> Monthly Revenue
               </h3>
               <p className="text-xs text-slate-400 mt-1">Revenue stacked by channel source</p>
             </div>
             <div className="flex gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest"><div className="w-2 h-2 bg-blue-500 rounded-full"></div> B.com</div>
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest"><div className="w-2 h-2 bg-red-500 rounded-full"></div> MMT</div>
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest"><div className="w-2 h-2 bg-yellow-500 rounded-full"></div> Exp</div>
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest"><div className="w-2 h-2 bg-emerald-500 rounded-full"></div> Dir</div>
             </div>
           </div>
           <div className="h-64 flex items-end justify-between gap-4">
              {revenueData.map((d) => (
                <div key={d.month} className="flex flex-col items-center gap-2 w-full group cursor-pointer h-full justify-end">
                  <span className="text-[10px] font-black text-slate-500">₹{(d.total/1000).toFixed(0)}k</span>
                  <div 
                    className="relative w-full bg-slate-50 rounded-xl overflow-hidden flex flex-col-reverse border border-slate-100 shadow-sm"
                    style={{ height: `${(d.total / maxRev) * 100}%` }}
                  >
                     <div style={{ height: `${(d.channels.mmt / d.total) * 100}%` }} className="bg-red-500 w-full hover:opacity-90 transition-opacity"></div>
                     <div style={{ height: `${(d.channels.bcom / d.total) * 100}%` }} className="bg-blue-500 w-full hover:opacity-90 transition-opacity"></div>
                     <div style={{ height: `${(d.channels.exp / d.total) * 100}%` }} className="bg-yellow-500 w-full hover:opacity-90 transition-opacity"></div>
                     <div style={{ height: `${(d.channels.dir / d.total) * 100}%` }} className="bg-emerald-500 w-full hover:opacity-90 transition-opacity"></div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{d.month}</span>
                </div>
              ))}
           </div>
        </div>

        {/* Revenue Share Pie */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
           <h3 className="font-bold text-slate-900 mb-8 flex items-center gap-2">
             <PieChart className="w-5 h-5 text-emerald-500" /> Revenue Share
           </h3>
           <div className="flex flex-col sm:flex-row items-center justify-center gap-10">
              <div 
                className="w-56 h-56 rounded-full shadow-[inset_0_0_20px_rgba(0,0,0,0.05)] relative shrink-0"
                style={{
                  background: `conic-gradient(#3b82f6 0% 45%, #ef4444 45% 75%, #eab308 75% 90%, #10b981 90% 100%)`
                }}
              >
                <div className="absolute inset-8 bg-white rounded-full flex items-center justify-center flex-col shadow-lg">
                   <span className="text-4xl font-black text-slate-800 tracking-tight">4</span>
                   <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Active Channels</span>
                </div>
              </div>
              <div className="space-y-4 w-full">
                {channelData.map(c => (
                  <div key={c.name} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${c.color} shadow-sm`}></div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-xs font-bold text-slate-700">{c.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold">{c.value}%</p>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${c.color}`} style={{width: `${c.value}%`}}></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Monthly Booking Count (By Channel) */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
           <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
             <div>
               <h3 className="font-bold text-slate-900 flex items-center gap-2">
                 <Activity className="w-5 h-5 text-fuchsia-500" /> Booking Count
               </h3>
               <p className="text-xs text-slate-400 mt-1">Total bookings by channel source</p>
             </div>
             <div className="flex gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest"><div className="w-2 h-2 bg-blue-500 rounded-full"></div> B.com</div>
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest"><div className="w-2 h-2 bg-red-500 rounded-full"></div> MMT</div>
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest"><div className="w-2 h-2 bg-yellow-500 rounded-full"></div> Exp</div>
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest"><div className="w-2 h-2 bg-emerald-500 rounded-full"></div> Dir</div>
             </div>
           </div>
           
           <div className="h-64 flex items-end justify-between gap-4">
              {bookingsData.map((d) => (
                <div key={d.month} className="flex flex-col items-center gap-2 w-full group cursor-pointer h-full justify-end">
                  <span className="text-[10px] font-black text-slate-400">{d.total}</span>
                  <div 
                    className="relative w-full bg-slate-50 rounded-xl overflow-hidden flex flex-col-reverse border border-slate-100 shadow-sm"
                    style={{ height: `${(d.total / maxBookings) * 100}%` }}
                  >
                     <div style={{ height: `${(d.channels.mmt / d.total) * 100}%` }} className="bg-red-500 w-full hover:opacity-90 transition-opacity"></div>
                     <div style={{ height: `${(d.channels.bcom / d.total) * 100}%` }} className="bg-blue-500 w-full hover:opacity-90 transition-opacity"></div>
                     <div style={{ height: `${(d.channels.exp / d.total) * 100}%` }} className="bg-yellow-500 w-full hover:opacity-90 transition-opacity"></div>
                     <div style={{ height: `${(d.channels.dir / d.total) * 100}%` }} className="bg-emerald-500 w-full hover:opacity-90 transition-opacity"></div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{d.month}</span>
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
               <p className="text-xs text-slate-400 mt-1">Bookings by category per month</p>
             </div>
             <div className="flex gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest"><div className="w-2 h-2 bg-indigo-500 rounded-full"></div> Dlx</div>
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest"><div className="w-2 h-2 bg-violet-500 rounded-full"></div> Dbl</div>
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest"><div className="w-2 h-2 bg-sky-500 rounded-full"></div> Sgl</div>
             </div>
           </div>

           <div className="h-64 flex items-end justify-between gap-4">
              {roomTypeData.map((d) => (
                <div key={d.month} className="flex flex-col items-center gap-2 w-full group cursor-pointer h-full justify-end">
                  <span className="text-[10px] font-black text-slate-400">{d.total}</span>
                  <div 
                    className="relative w-full bg-slate-50 rounded-xl overflow-hidden flex flex-col-reverse border border-slate-100 shadow-sm"
                    style={{ height: `${(d.total / maxRoomBookings) * 100}%` }}
                  >
                     <div style={{ height: `${(d.types.deluxe / d.total) * 100}%` }} className="bg-indigo-500 w-full hover:opacity-90 transition-opacity"></div>
                     <div style={{ height: `${(d.types.double / d.total) * 100}%` }} className="bg-violet-500 w-full hover:opacity-90 transition-opacity"></div>
                     <div style={{ height: `${(d.types.single / d.total) * 100}%` }} className="bg-sky-500 w-full hover:opacity-90 transition-opacity"></div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{d.month}</span>
                </div>
              ))}
           </div>
        </div>

      </div>
    </div>
  );
};

export default AnalysisView;
