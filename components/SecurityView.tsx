
import React, { useMemo } from 'react';
import { 
  ShieldAlert, ShieldCheck, Lock, Unlock, ZapOff, 
  RefreshCw, History, Shield, AlertCircle, MapPin,
  Clock, Hash, Power, UserX, UserCheck, Search
} from 'lucide-react';
import { VerificationAttempt, RoomSecurityStatus } from '../types';

interface SecurityViewProps {
  attempts: VerificationAttempt[];
  roomSecurity: RoomSecurityStatus[];
  onResetLock: (room: string) => void;
  onToggleQR: (room: string) => void;
}

const SecurityView: React.FC<SecurityViewProps> = ({ attempts, roomSecurity, onResetLock, onToggleQR }) => {
  const topOffenders = useMemo(() => {
    const counts: Record<string, number> = {};
    attempts.forEach(a => {
      if (a.status === 'FAIL') {
        counts[a.room_id] = (counts[a.room_id] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
  }, [attempts]);

  const totalThreats = attempts.filter(a => a.status === 'FAIL' || a.status === 'LOCKED').length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-red-600" />
            Security Center
          </h2>
          <p className="text-slate-500 mt-1 font-medium">Monitoring Guest Verification integrity and fraud prevention protocols.</p>
        </div>
        <div className="flex gap-3">
           <div className="bg-red-50 border border-red-100 px-4 py-2 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-[10px] font-black text-red-700 uppercase tracking-widest">{totalThreats} Blocked Events (24h)</span>
           </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Top Offenders / Risk Analysis */}
        <div className="space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
             <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-3">
               <UserX className="w-5 h-5 text-red-500" />
               High-Risk Units
             </h3>
             <div className="space-y-4">
               {topOffenders.length > 0 ? topOffenders.map(([room, count]) => {
                 const status = roomSecurity.find(rs => rs.room_id === room);
                 return (
                 <div key={room} className={`p-5 rounded-3xl border-2 transition-all flex items-center justify-between ${status?.isLocked ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                   <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${status?.isLocked ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                        {room}
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{count} Failures Today</p>
                        <p className="text-[10px] font-bold text-slate-400">Risk Level: {count > 5 ? 'CRITICAL' : 'ELEVATED'}</p>
                      </div>
                   </div>
                   <button 
                     onClick={() => onResetLock(room)}
                     className={`p-2 rounded-lg transition-all ${status?.isLocked ? 'bg-white text-red-600 hover:bg-red-600 hover:text-white shadow-sm' : 'text-slate-300 cursor-not-allowed'}`}
                     disabled={!status?.isLocked}
                   >
                     <Unlock className="w-4 h-4" />
                   </button>
                 </div>
               )}) : (
                 <div className="text-center py-12 text-slate-400">
                    <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
                    <p className="text-sm font-bold uppercase tracking-widest">No Active Threats</p>
                 </div>
               )}
             </div>
          </div>

          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
             <div className="absolute top-0 right-0 p-6 opacity-10">
               <Shield className="w-32 h-32" />
             </div>
             <h3 className="text-lg font-black uppercase tracking-tight mb-4 z-10 relative">System Safeguards</h3>
             <div className="space-y-6 z-10 relative">
               <div className="flex items-center gap-4">
                  <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg"><History className="w-4 h-4" /></div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Rate Limiting</p>
                    <p className="text-xs font-bold">3 attempts / 10 mins per IP</p>
                  </div>
               </div>
               <div className="flex items-center gap-4">
                  <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg"><MapPin className="w-4 h-4" /></div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase">IP Geo-Fencing</p>
                    <p className="text-xs font-bold">Active (Verified Local Subnet)</p>
                  </div>
               </div>
               <div className="flex items-center gap-4">
                  <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg"><Clock className="w-4 h-4" /></div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Session TTL</p>
                    <p className="text-xs font-bold">60 Minute Rolling Expiry</p>
                  </div>
               </div>
             </div>
          </div>
        </div>

        {/* Live Feed */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[650px]">
             <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-indigo-500" /> Security Event Stream
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1">Real-time log of guest verification transactions</p>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input type="text" placeholder="Filter stream..." className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none" />
                  </div>
                </div>
             </div>
             <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                   <thead className="bg-slate-50/50 sticky top-0 z-10">
                      <tr>
                        <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Timestamp</th>
                        <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Unit</th>
                        <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Input String</th>
                        <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                        <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Source IP</th>
                        <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Action</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                      {attempts.map((a) => (
                        <tr key={a.id} className="hover:bg-slate-50/50 transition-colors group">
                           <td className="p-4 text-[10px] font-bold text-slate-400 tabular-nums">
                             {new Date(a.created_at).toLocaleTimeString()}
                           </td>
                           <td className="p-4">
                             <span className="text-[11px] font-black text-slate-700">Room {a.room_id}</span>
                           </td>
                           <td className="p-4">
                             <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">{a.input_surname}</span>
                           </td>
                           <td className="p-4">
                             <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${
                               a.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                               a.status === 'LOCKED' ? 'bg-red-600 text-white border-red-700 animate-pulse' :
                               'bg-red-50 text-red-600 border-red-100'
                             }`}>
                               {a.status}
                             </span>
                           </td>
                           <td className="p-4 text-[10px] font-bold text-slate-500 tabular-nums">
                             {a.ip_address}
                           </td>
                           <td className="p-4 text-center">
                             <div className="flex items-center justify-center gap-2">
                               <button 
                                 onClick={() => onToggleQR(a.room_id)}
                                 className="p-2 bg-slate-100 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg transition-all"
                                 title="Disable QR for this room"
                               >
                                 <ZapOff className="w-3.5 h-3.5" />
                               </button>
                             </div>
                           </td>
                        </tr>
                      ))}
                      {attempts.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                             Waiting for telemetry data...
                          </td>
                        </tr>
                      )}
                   </tbody>
                </table>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityView;
