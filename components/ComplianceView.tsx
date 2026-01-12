
import React, { useState, useMemo } from 'react';
import { 
  ShieldAlert, ShieldCheck, Printer, Search, 
  User, Users, Globe, FileText, AlertCircle,
  Clock, CheckCircle2, ChevronRight, Filter,
  Download, History, XCircle, Plane
} from 'lucide-react';
import { Booking, SyncEvent, GuestDetails } from '../types';

interface ComplianceViewProps {
  syncEvents: SyncEvent[];
  setSyncEvents: React.Dispatch<React.SetStateAction<SyncEvent[]>>;
}

const ComplianceView: React.FC<ComplianceViewProps> = ({ syncEvents, setSyncEvents }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'flagged' | 'foreign'>('all');

  const allBookings = useMemo(() => {
    return syncEvents.filter(e => e.type === 'booking') as Booking[];
  }, [syncEvents]);

  const auditResults = useMemo(() => {
    const now = Date.now();
    const last24h = 24 * 60 * 60 * 1000;
    
    return allBookings.map(b => {
      const isNew = (now - b.timestamp) < last24h;
      const missingID = !b.guestDetails?.idNumber;
      
      const isForeigner = b.guestDetails?.nationality?.toLowerCase() !== 'indian';
      
      // Enhanced Form C Check: Verify ALL mandatory fields, not just the flag
      const formCIncomplete = isForeigner && (
          !b.guestDetails?.passportNumber || 
          !b.guestDetails?.passportExpiry ||
          !b.guestDetails?.visaNumber ||
          !b.guestDetails?.visaType ||
          !b.guestDetails?.arrivalPort || 
          !b.guestDetails?.arrivalDateIndia
      );
      
      const accessoryIssues = b.accessoryGuests?.some(g => !g.idNumber) || false;

      return {
        ...b,
        audit: {
          isNew,
          missingID,
          missingFormC: formCIncomplete,
          accessoryIssues,
          flagged: missingID || formCIncomplete || accessoryIssues
        }
      };
    });
  }, [allBookings]);

  // The Master Guest Register (Flattened view of all guests)
  const masterRegister = useMemo(() => {
    const entries: { 
      guestName: string; 
      nationality: string; 
      idNumber: string; 
      room: string; 
      type: 'Primary' | 'Co-Guest';
      bookingId: string;
      checkIn: string;
      isForeigner: boolean;
      passport?: string;
    }[] = [];

    auditResults.forEach(b => {
      // Add primary
      entries.push({
        guestName: b.guestName,
        nationality: b.guestDetails?.nationality || 'Indian',
        idNumber: b.guestDetails?.idNumber || 'PENDING',
        room: b.roomNumber || 'TBD',
        type: 'Primary',
        bookingId: b.id,
        checkIn: b.checkIn,
        isForeigner: b.guestDetails?.nationality?.toLowerCase() !== 'indian',
        passport: b.guestDetails?.passportNumber
      });

      // Add accessory
      b.accessoryGuests?.forEach(g => {
        entries.push({
          guestName: g.name || 'Unnamed',
          nationality: g.nationality || 'Indian',
          idNumber: g.idNumber || 'PENDING',
          room: b.roomNumber || 'TBD',
          type: 'Co-Guest',
          bookingId: b.id,
          checkIn: b.checkIn,
          isForeigner: g.nationality?.toLowerCase() !== 'indian',
          passport: g.passportNumber
        });
      });
    });

    return entries.filter(e => {
        const matchSearch = e.guestName.toLowerCase().includes(searchQuery.toLowerCase()) || e.room.includes(searchQuery);
        if (!matchSearch) return false;
        
        if (filterType === 'foreign') return e.isForeigner;
        if (filterType === 'flagged') return e.idNumber === 'PENDING';
        return true;
    }).sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  }, [auditResults, searchQuery, filterType]);

  const flaggedBookings = auditResults.filter(b => b.audit.flagged && b.audit.isNew);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-emerald-600" />
            Police Compliance Center
          </h2>
          <p className="text-slate-500 mt-1 font-medium">Automated Form C processing and Master Guest Register audit.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs rounded-xl transition-all shadow-sm">
             <Printer className="w-4 h-4" /> Print Registry
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 font-bold text-xs rounded-xl transition-all shadow-lg shadow-indigo-600/20">
             <Download className="w-4 h-4" /> Export Form C Batch
          </button>
        </div>
      </header>

      {/* Compliance Audit Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
           <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
              <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                 <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                       <FileText className="w-4 h-4 text-indigo-500" /> Master Guest Register
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-1">Unified view of all occupants (Primary & Accessory)</p>
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="relative">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                       <input 
                         type="text" 
                         placeholder="Search Register..."
                         value={searchQuery}
                         onChange={e => setSearchQuery(e.target.value)}
                         className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-indigo-500"
                       />
                    </div>
                    <select 
                      value={filterType}
                      onChange={e => setFilterType(e.target.value as any)}
                      className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none"
                    >
                       <option value="all">All Guests</option>
                       <option value="flagged">Missing ID</option>
                       <option value="foreign">Foreigners</option>
                    </select>
                 </div>
              </div>
              <div className="flex-1 overflow-auto custom-scrollbar">
                 <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/50 sticky top-0 z-10">
                       <tr>
                          <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Occupant Name</th>
                          <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Nationality</th>
                          <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">ID Status</th>
                          <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Room</th>
                          <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Check-In</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {masterRegister.map((e, idx) => (
                         <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                            <td className="p-4">
                               <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                                     <User className="w-4 h-4" />
                                  </div>
                                  <div>
                                     <p className="text-xs font-bold text-slate-800">{e.guestName}</p>
                                     <p className="text-[8px] font-black uppercase text-slate-400">{e.type}</p>
                                  </div>
                               </div>
                            </td>
                            <td className="p-4">
                               <span className={`text-[10px] font-bold ${e.isForeigner ? 'text-amber-600' : 'text-slate-500'}`}>
                                  {e.nationality}
                               </span>
                            </td>
                            <td className="p-4">
                               <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${e.idNumber === 'PENDING' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                  {e.idNumber}
                               </span>
                            </td>
                            <td className="p-4">
                               <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">#{e.room}</span>
                            </td>
                            <td className="p-4">
                               <span className="text-[10px] font-bold text-slate-500">{e.checkIn}</span>
                            </td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>

        <div className="space-y-6">
           {/* Compliance Audit Section */}
           <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                 <ShieldAlert className="w-32 h-32" />
              </div>
              <h3 className="text-lg font-black tracking-tight uppercase mb-6 flex items-center gap-2">
                 <AlertCircle className="w-5 h-5 text-amber-400" /> Compliance Audit (24h)
              </h3>
              
              <div className="space-y-4">
                 {flaggedBookings.length > 0 ? (
                    flaggedBookings.map(b => (
                       <div key={b.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3 hover:bg-white/10 transition-all">
                          <div className="flex justify-between items-start">
                             <div>
                                <p className="text-xs font-bold">{b.guestName}</p>
                                <p className="text-[9px] text-slate-400 uppercase font-black">Room {b.roomNumber || 'Unassigned'} • {b.source}</p>
                             </div>
                             <span className="text-[8px] px-1.5 py-0.5 bg-red-500 text-white rounded font-black uppercase">Critical</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                             {b.audit.missingID && (
                               <div className="flex items-center gap-1.5 text-[8px] font-black uppercase text-red-400 bg-red-400/10 px-2 py-1 rounded border border-red-400/20">
                                  <XCircle className="w-3 h-3" /> Missing ID Scan
                               </div>
                             )}
                             {b.audit.missingFormC && (
                               <div className="flex items-center gap-1.5 text-[8px] font-black uppercase text-amber-400 bg-amber-400/10 px-2 py-1 rounded border border-amber-400/20">
                                  <Globe className="w-3 h-3" /> Form C Data Incomplete
                               </div>
                             )}
                             {b.audit.accessoryIssues && (
                               <div className="flex items-center gap-1.5 text-[8px] font-black uppercase text-rose-400 bg-rose-400/10 px-2 py-1 rounded border border-rose-400/20">
                                  <Users className="w-3 h-3" /> Co-Guest ID Req
                               </div>
                             )}
                          </div>
                       </div>
                    ))
                 ) : (
                    <div className="text-center py-12 text-slate-500">
                       <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
                       <p className="text-sm font-bold">Audit Clean</p>
                       <p className="text-[10px] uppercase font-black mt-1">All new arrivals compliant</p>
                    </div>
                 )}
              </div>
           </div>

           <div className="bg-white border border-slate-200 rounded-[2rem] p-6 space-y-6">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                 <History className="w-4 h-4" /> Reporting Stats
              </h4>
              <div className="space-y-4">
                 <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500">Total Foreign Arrivals (MTD)</span>
                    <span className="text-sm font-black text-slate-800">{allBookings.filter(b => b.guestDetails?.nationality?.toLowerCase() !== 'indian').length}</span>
                 </div>
                 <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className="bg-indigo-600 h-1.5 rounded-full w-2/3"></div>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500">Form C Batch Submission</span>
                    <span className="text-sm font-black text-emerald-600">On Time</span>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ComplianceView;
