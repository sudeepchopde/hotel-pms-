
import React, { useState, useMemo } from 'react';
import { Calendar, Info, Edit3, IndianRupee, Check, X, Tag, Zap, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { RoomType, InventoryItem } from '../types';

interface MasterCalendarProps {
  inventory: InventoryItem[];
  roomTypes: RoomType[];
  isSyncing: boolean;
  onUpdatePrice: (roomTypeId: string, newPrice: number) => void;
  onUpdateDailyPrice: (roomTypeId: string, date: string, newPrice: number) => void;
}

const MasterCalendar: React.FC<MasterCalendarProps> = ({ 
  inventory, 
  roomTypes, 
  isSyncing, 
  onUpdatePrice,
  onUpdateDailyPrice 
}) => {
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingDailyId, setEditingDailyId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<string>('');
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'year'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Get all unique dates from inventory
  const allDates: string[] = Array.from(new Set<string>(inventory.map(i => i.date))).sort();

  // Navigation Logic
  const handleNavigate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    const modifier = direction === 'next' ? 1 : -1;
    
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (modifier * 7));
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + modifier);
      // Reset to 1st of month to avoid skipping months with fewer days if current day is 31
      newDate.setDate(1); 
    } else {
      newDate.setFullYear(newDate.getFullYear() + modifier);
    }
    setCurrentDate(newDate);
  };

  const dateLabel = useMemo(() => {
    return currentDate.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  }, [currentDate]);

  // Filter based on view mode and currentDate
  const displayDates = useMemo(() => {
    return allDates.filter(dateStr => {
      const d = new Date(dateStr);
      // Normalize comparison times
      d.setHours(0,0,0,0);
      
      const start = new Date(currentDate);
      start.setHours(0,0,0,0);

      if (viewMode === 'week') {
        // Find start of the week (Sunday) for consistency or just use currentDate as anchor?
        // Using currentDate as anchor allows free scrolling. 
        // But for calendar feel, aligning to week might be better. 
        // Let's stick to 7 days from currentDate for simplicity in navigation.
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        return d >= start && d < end;
      }
      
      if (viewMode === 'month') {
        return d.getMonth() === start.getMonth() && d.getFullYear() === start.getFullYear();
      }
      
      if (viewMode === 'year') {
        return d.getFullYear() === start.getFullYear();
      }
      
      return false;
    });
  }, [allDates, viewMode, currentDate]);

  // Group dates by month for the calendar header
  const monthGroups = useMemo(() => {
    const groups: { id: string; label: string; year: string; count: number }[] = [];
    if (displayDates.length === 0) return groups;

    let currentMonth = '';
    let currentYear = '';
    let currentCount = 0;

    displayDates.forEach((date) => {
      const d = new Date(date);
      const m = d.toLocaleDateString('en-US', { month: 'long' });
      const y = d.getFullYear().toString();
      
      if (m !== currentMonth || y !== currentYear) {
        if (currentMonth) {
          groups.push({ id: `${currentMonth}-${currentYear}`, label: currentMonth, year: currentYear, count: currentCount });
        }
        currentMonth = m;
        currentYear = y;
        currentCount = 1;
      } else {
        currentCount++;
      }
    });
    // Push the last group
    if (currentMonth) {
        groups.push({ id: `${currentMonth}-${currentYear}`, label: currentMonth, year: currentYear, count: currentCount });
    }
    return groups;
  }, [displayDates]);

  const getStatusStyles = (count: number, total: number) => {
    if (count === 0) return 'border-red-200/60 bg-red-50 text-red-600';
    if (count <= 3) return 'border-amber-200/60 bg-amber-50 text-amber-600';
    return 'border-emerald-200/60 bg-emerald-50 text-emerald-600';
  };

  const startEdit = (rt: RoomType) => {
    setEditingPriceId(rt.id);
    setTempPrice(rt.basePrice.toString());
  };

  const startDailyEdit = (rtId: string, date: string, currentPrice: number) => {
    setEditingDailyId(`${rtId}-${date}`);
    setTempPrice(currentPrice.toString());
  };

  const savePrice = (id: string) => {
    const val = parseFloat(tempPrice);
    if (!isNaN(val)) onUpdatePrice(id, val);
    setEditingPriceId(null);
  };

  const saveDailyPrice = (rtId: string, date: string) => {
    const val = parseFloat(tempPrice);
    if (!isNaN(val)) onUpdateDailyPrice(rtId, date, val);
    setEditingDailyId(null);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col h-[600px] xl:h-[600px]">
      <div className="p-6 bg-slate-50 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500 p-2 rounded-xl shadow-lg shadow-indigo-200">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-black text-slate-900 tracking-tight">Master Yield Grid</h3>
            <p className="text-xs text-slate-500">Synchronized rate management and occupancy control</p>
          </div>
        </div>
        
        {/* Date Navigation */}
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-indigo-100 shadow-sm mx-auto xl:mx-0">
          <button 
            onClick={() => handleNavigate('prev')}
            className="p-2 hover:bg-indigo-50 text-indigo-400 hover:text-indigo-600 rounded-xl transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="px-4 py-1 min-w-[140px] text-center border-x border-slate-100">
            <span className="text-xs font-black text-slate-700 uppercase tracking-widest block">
              {dateLabel.split(' ')[0]}
            </span>
            <span className="text-[10px] font-bold text-slate-400">
              {dateLabel.split(' ')[1]}
            </span>
          </div>

          <button 
            onClick={() => handleNavigate('next')}
            className="p-2 hover:bg-indigo-50 text-indigo-400 hover:text-indigo-600 rounded-xl transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-4 justify-between xl:justify-end">
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'week' ? 'bg-slate-100 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'month' ? 'bg-slate-100 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('year')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'year' ? 'bg-slate-100 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Year
            </button>
          </div>

          <div className="h-8 w-px bg-slate-200 mx-2 hidden sm:block"></div>

          <div className="flex items-center gap-3">
            {['High', 'Med', 'Full'].map((label, idx) => (
              <div key={label} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <div className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-emerald-400' : idx === 1 ? 'bg-amber-400' : 'bg-red-400'}`}></div>
                <span className="hidden sm:inline">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-auto flex-1 relative custom-scrollbar">
        {displayDates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
             <div className="p-4 bg-slate-50 rounded-full">
               <Calendar className="w-8 h-8 text-slate-300" />
             </div>
             <p className="text-sm font-medium">No inventory data generated for this period.</p>
             <button 
                onClick={() => setCurrentDate(new Date())}
                className="text-xs font-bold text-indigo-600 hover:underline"
             >
               Return to Today
             </button>
          </div>
        ) : (
        <table className="w-full text-left border-collapse border-spacing-0">
          <thead className="sticky top-0 z-30 bg-white shadow-sm">
            {/* Month Header Row */}
            <tr className="bg-slate-50/95 backdrop-blur-sm border-b border-slate-200">
               <th className="sticky left-0 z-40 p-3 bg-slate-50 border-r border-slate-200 border-b border-slate-200 min-w-[260px]">
                  <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-right pr-2 pt-1">Timeline</div>
               </th>
               {monthGroups.map(group => (
                 <th 
                    key={group.id} 
                    colSpan={group.count} 
                    className="p-3 border-r border-slate-200 border-b border-slate-200 text-center bg-slate-50/50"
                 >
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{group.label}</span>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-200/50 px-1.5 py-0.5 rounded">{group.year}</span>
                    </div>
                 </th>
               ))}
            </tr>

            {/* Day Header Row */}
            <tr className="bg-white border-b border-slate-200 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)]">
               <th className="sticky left-0 z-40 p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-200 bg-white shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)]">
                  Room Type & Global Base Rate
               </th>
               {displayDates.map(date => {
                 const d = new Date(date);
                 const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                 const isToday = new Date().toDateString() === new Date().toDateString();
                 return (
                   <th key={date} className={`p-3 text-center min-w-[90px] border-r border-slate-100 ${isWeekend ? 'bg-slate-50/50' : ''}`}>
                     <div className="flex flex-col items-center gap-1.5">
                        <span className={`text-[9px] font-bold uppercase tracking-widest ${isWeekend ? 'text-rose-500' : 'text-slate-400'}`}>
                          {d.toLocaleDateString(undefined, { weekday: 'short' })}
                        </span>
                        <div className={`
                           w-8 h-8 flex items-center justify-center rounded-full text-sm font-black transition-all
                           ${isToday ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110' : 'text-slate-700 bg-slate-100'}
                        `}>
                          {d.getDate()}
                        </div>
                     </div>
                   </th>
                 );
               })}
            </tr>
          </thead>
          
          <tbody className="divide-y divide-slate-100">
            {roomTypes.map(rt => (
              <tr key={rt.id} className="group hover:bg-slate-50 transition-colors">
                <td className="sticky left-0 z-20 p-6 border-r border-slate-200 bg-white group-hover:bg-slate-50 transition-colors shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)]">
                  <div className="flex flex-col gap-1">
                    <p className="font-black text-slate-800 tracking-tight">{rt.name}</p>
                    <div className="flex items-center gap-2 h-8">
                      {editingPriceId === rt.id ? (
                        <div className="flex items-center gap-1 animate-in zoom-in duration-200">
                          <span className="text-xs font-bold text-slate-500">₹</span>
                          <input 
                            autoFocus
                            className="w-20 bg-white border border-indigo-300 rounded-lg px-2 py-1 text-sm font-bold text-slate-900 shadow-sm outline-none ring-2 ring-indigo-500/10"
                            value={tempPrice}
                            onChange={e => setTempPrice(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && savePrice(rt.id)}
                            onBlur={() => setTimeout(() => setEditingPriceId(null), 200)}
                          />
                          <button 
                            onMouseDown={(e) => { e.preventDefault(); savePrice(rt.id); }}
                            className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md transition-colors shadow-sm"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => startEdit(rt)}
                          className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50/50 border border-indigo-100/50 text-indigo-700 rounded-lg hover:bg-indigo-600 hover:text-white transition-all group/price"
                        >
                          <IndianRupee className="w-3 h-3" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Base: ₹{rt.basePrice}</span>
                          <Edit3 className="w-2.5 h-2.5 opacity-0 group-hover/price:opacity-100 transition-opacity" />
                        </button>
                      )}
                    </div>
                  </div>
                </td>
                {displayDates.map(date => {
                  const item = inventory.find(i => i.date === date && i.roomTypeId === rt.id);
                  const isWeekend = new Date(date).getDay() === 0 || new Date(date).getDay() === 6;
                  
                  if (!item) return <td key={date + rt.id} className={`border-r border-slate-100 min-w-[90px] ${isWeekend ? 'bg-slate-50/30' : ''}`}></td>;
                  const isDailyEditing = editingDailyId === `${rt.id}-${date}`;

                  return (
                    <td key={date + rt.id} className={`p-3 border-r border-slate-100 min-w-[90px] ${isWeekend ? 'bg-slate-50/30' : ''}`}>
                      <div className={`
                        relative h-20 w-full rounded-2xl border-2 flex flex-col items-center justify-center transition-all duration-300
                        ${getStatusStyles(item.availableCount, rt.totalCapacity)}
                        ${item.isLocked ? 'scale-95 opacity-50' : 'hover:scale-105 hover:shadow-md'}
                      `}>
                        {item.appliedRule && !isDailyEditing && (
                          <div className="absolute top-1 right-1">
                            {item.appliedRule === 'Weekly Strategy' ? (
                              <Zap className="w-2.5 h-2.5 text-indigo-400" />
                            ) : (
                              <Sparkles className="w-2.5 h-2.5 text-fuchsia-400" />
                            )}
                          </div>
                        )}

                        <span className="text-xl font-black leading-none mb-1">{item.availableCount}</span>
                        
                        <div className="relative">
                          {isDailyEditing ? (
                            <div className="flex items-center gap-1 animate-in zoom-in duration-150">
                              <input 
                                autoFocus
                                className="w-14 bg-white border border-indigo-300 rounded text-[10px] font-bold text-center outline-none ring-2 ring-indigo-500/10"
                                value={tempPrice}
                                onChange={e => setTempPrice(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && saveDailyPrice(rt.id, date)}
                                onBlur={() => setEditingDailyId(null)}
                              />
                            </div>
                          ) : (
                            <button 
                              onClick={() => startDailyEdit(rt.id, date, item.price)}
                              className={`
                                flex flex-col items-center gap-0.5 px-2 py-0.5 rounded-md text-[9px] font-black transition-colors
                                ${item.appliedRule ? 'bg-fuchsia-600 text-white shadow-sm' : 'bg-slate-200/50 text-slate-500 hover:bg-indigo-100 hover:text-indigo-700'}
                              `}
                            >
                              <span>₹{item.price}</span>
                              {item.appliedRule && <span className="text-[7px] uppercase tracking-tighter opacity-70 leading-none max-w-[50px] truncate">{item.appliedRule}</span>}
                            </button>
                          )}
                        </div>

                        <div className="absolute bottom-1.5 left-3 right-3 h-1 bg-slate-200/30 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${item.availableCount === 0 ? 'bg-red-400' : 'bg-emerald-400'}`}
                            style={{ width: `${(item.availableCount / rt.totalCapacity) * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
};

export default MasterCalendar;
