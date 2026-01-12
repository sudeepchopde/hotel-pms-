
import React, { useState, useRef, useMemo } from 'react';
import { 
  TrendingUp, Calendar, Plus, Trash2, 
  ShieldCheck, Zap, Info, IndianRupee, 
  Sparkles, ShieldAlert, CalendarClock,
  ArrowRight, AlertCircle, CalendarDays,
  CheckCircle2, ChevronDown, Edit
} from 'lucide-react';
import { RateRulesConfig, SpecialEvent } from '../types';

interface RateRulesPageProps {
  rules: RateRulesConfig;
  setRules: React.Dispatch<React.SetStateAction<RateRulesConfig>>;
}

/**
 * Enterprise-Grade Date Picker Component
 * Simplified to a compact calendar icon trigger.
 * Uses an invisible overlay input to ensure reliable native picker triggering across devices.
 */
const FormDatePicker = ({ 
  label, 
  value, 
  onChange, 
  min, 
  error 
}: { 
  label: string; 
  value?: string; 
  onChange: (val: string) => void; 
  min?: string;
  error?: boolean;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  
  const displayValue = useMemo(() => {
    if (!value) return null;
    return new Date(value).toLocaleDateString('en-GB', { 
      day: '2-digit', month: 'short', year: 'numeric' 
    });
  }, [value]);

  return (
    <div className="flex-1 space-y-1.5">
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 block">
        {label}
      </label>
      <div className="flex items-center gap-3">
        {/* 
           Wrapper uses 'group' to ensure hover effects on the button 
           trigger even when hovering the invisible input overlay.
        */}
        <div className="relative group">
          <button 
            type="button"
            className={`
              p-3.5 bg-white border-2 rounded-2xl transition-all flex items-center justify-center 
              group-hover:shadow-lg group-hover:shadow-indigo-500/5
              ${error ? 'border-red-200 text-red-500 bg-red-50/30' : 'border-slate-100 text-indigo-600 group-hover:border-indigo-400'}
            `}
            aria-label={`Open ${label} picker`}
          >
            <CalendarDays className="w-5 h-5" />
          </button>

          {/* 
            Overlay Input: 
            1. Covers the button completely.
            2. Opacity 0 makes it invisible but interactive.
            3. Clicking it triggers the native picker.
            4. We explicitly call showPicker() on click for consistent desktop behavior.
          */}
          <input 
            ref={inputRef}
            type="date"
            min={min}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            onClick={(e) => {
              try {
                if ('showPicker' in e.currentTarget) {
                    (e.currentTarget as any).showPicker();
                }
              } catch (err) {
                // Fallback is automatic focus, which is fine
              }
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
        </div>

        {value && (
          <span className="text-sm font-black text-slate-900 animate-in fade-in slide-in-from-left-2">
            {displayValue}
          </span>
        )}
      </div>
    </div>
  );
};

const RateRulesPage: React.FC<RateRulesPageProps> = ({ rules, setRules }) => {
  // --- Form State Management ---
  // modifierValue here represents the user-friendly value (e.g. 20 for 20% or 500 for ₹500)
  const [formState, setFormState] = useState<Partial<SpecialEvent>>({
    name: '',
    startDate: '',
    endDate: '',
    modifierType: 'percentage',
    modifierValue: 10
  });
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});

  // --- Logic Handlers ---
  const toggleWeeklyDay = (dayValue: number) => {
    setRules(prev => {
      const activeDays = prev.weeklyRules.activeDays;
      const isCurrentlyActive = activeDays.includes(dayValue);
      return {
        ...prev,
        weeklyRules: {
          ...prev.weeklyRules,
          activeDays: isCurrentlyActive 
            ? activeDays.filter(d => d !== dayValue) 
            : [...activeDays, dayValue]
        }
      };
    });
  };

  const handleAddOverride = () => {
    // Basic validation
    const errors: Record<string, boolean> = {};
    if (!formState.name) errors.name = true;
    if (!formState.startDate) errors.startDate = true;
    if (!formState.endDate) errors.endDate = true;

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    // Convert UI percentage (e.g. 20) to engine multiplier (e.g. 1.2)
    const engineValue = formState.modifierType === 'percentage' 
      ? 1 + (Number(formState.modifierValue) / 100) 
      : Number(formState.modifierValue);

    const newEvent: SpecialEvent = {
      id: `ev-${crypto.randomUUID()}`,
      name: formState.name!,
      startDate: formState.startDate!,
      endDate: formState.endDate!,
      modifierType: formState.modifierType as any,
      modifierValue: engineValue
    };

    setRules(prev => ({
      ...prev,
      specialEvents: [...prev.specialEvents, newEvent]
    }));

    // State Reset
    setFormState({
      name: '',
      startDate: '',
      endDate: '',
      modifierType: 'percentage',
      modifierValue: 10
    });
    setFormErrors({});
  };

  const removeOverride = (id: string) => {
    setRules(prev => ({
      ...prev,
      specialEvents: prev.specialEvents.filter(e => e.id !== id)
    }));
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-12 animate-in fade-in duration-700 pb-32">
      {/* Strategic Header */}
      <header className="space-y-1">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600/70">Yield Management</span>
        </div>
        <h2 className="text-4xl font-black text-slate-900 tracking-tight">Strategy Center</h2>
        <h3 className="text-slate-500 font-medium">Coordinate automated price movements across your global distribution network.</h3>
      </header>

      {/* 1. Recurring Weekly Strategy */}
      <section className="bg-white rounded-[2.5rem] p-8 border-2 border-slate-100 shadow-sm transition-all hover:border-slate-200 space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
              <Zap className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Weekly Baseline</h3>
                <span className="px-2.5 py-1 bg-slate-100 text-slate-500 text-[9px] font-black rounded-lg border border-slate-200 uppercase tracking-widest">Priority: Standard</span>
              </div>
              <p className="text-sm text-slate-500 font-medium mt-0.5">Automated weekend or weekday recurring modifiers.</p>
            </div>
          </div>
          <button 
            onClick={() => setRules(prev => ({ ...prev, weeklyRules: { ...prev.weeklyRules, isActive: !prev.weeklyRules.isActive } }))}
            className={`px-8 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-xl ${
              rules.weeklyRules.isActive 
                ? 'bg-emerald-500 text-white shadow-emerald-500/20 hover:bg-emerald-600' 
                : 'bg-slate-200 text-slate-500 shadow-slate-200/20 hover:bg-slate-300'
            }`}
          >
            {rules.weeklyRules.isActive ? 'Active' : 'Disabled'}
          </button>
        </div>

        {rules.weeklyRules.isActive && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-in slide-in-from-top-4 duration-500">
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">Recurring Days</label>
                <div className="flex flex-wrap gap-2.5">
                  {[
                    { label: 'S', value: 0 }, { label: 'M', value: 1 }, { label: 'T', value: 2 },
                    { label: 'W', value: 3 }, { label: 'T', value: 4 }, { label: 'F', value: 5 }, { label: 'S', value: 6 }
                  ].map(day => (
                    <button
                      key={day.value}
                      onClick={() => toggleWeeklyDay(day.value)}
                      className={`
                        w-12 h-12 rounded-xl font-black text-sm transition-all flex items-center justify-center border-2
                        ${rules.weeklyRules.activeDays.includes(day.value)
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20 scale-105' 
                          : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200 hover:text-indigo-600'}
                      `}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6 pt-2">
                <div className="flex p-1 bg-slate-100 rounded-2xl w-fit border border-slate-200">
                  <button 
                    onClick={() => setRules(prev => ({ ...prev, weeklyRules: { ...prev.weeklyRules, modifierType: 'percentage' } }))}
                    className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${rules.weeklyRules.modifierType === 'percentage' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                  >
                    Percentage (%)
                  </button>
                  <button 
                    onClick={() => setRules(prev => ({ ...prev, weeklyRules: { ...prev.weeklyRules, modifierType: 'fixed' } }))}
                    className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${rules.weeklyRules.modifierType === 'fixed' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                  >
                    Fixed (₹)
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rate Increase</span>
                    
                    <div className="flex items-center gap-1 bg-white border-2 border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all w-32 justify-end shadow-sm">
                      <span className="text-sm font-black text-indigo-300 select-none">
                        {rules.weeklyRules.modifierType === 'percentage' ? '+' : '+₹'}
                      </span>
                      <input 
                        type="number" 
                        value={rules.weeklyRules.modifierType === 'percentage' 
                          ? Math.round((rules.weeklyRules.modifierValue - 1) * 100)
                          : rules.weeklyRules.modifierValue
                        }
                        onChange={(e) => {
                          const rawVal = e.target.value;
                          const val = rawVal === '' ? 0 : parseFloat(rawVal);
                          
                          if (rules.weeklyRules.modifierType === 'percentage') {
                            const percentage = Math.max(0, Math.min(100, val));
                            setRules(prev => ({ 
                              ...prev, 
                              weeklyRules: { 
                                ...prev.weeklyRules, 
                                modifierValue: 1 + (percentage / 100)
                              } 
                            }));
                          } else {
                            const fixedVal = Math.max(0, Math.min(10000, val));
                            setRules(prev => ({ 
                              ...prev, 
                              weeklyRules: { 
                                ...prev.weeklyRules, 
                                modifierValue: fixedVal
                              } 
                            }));
                          }
                        }}
                        className="w-full text-right font-black text-lg text-indigo-600 outline-none bg-transparent"
                      />
                      {rules.weeklyRules.modifierType === 'percentage' && (
                        <span className="text-sm font-black text-indigo-300 select-none">%</span>
                      )}
                    </div>
                  </div>
                  <input 
                    type="range" 
                    min={rules.weeklyRules.modifierType === 'percentage' ? "1" : "0"} 
                    max={rules.weeklyRules.modifierType === 'percentage' ? "2.0" : "10000"} 
                    step={rules.weeklyRules.modifierType === 'percentage' ? "0.05" : "100"} 
                    value={rules.weeklyRules.modifierValue}
                    onChange={(e) => setRules(prev => ({ ...prev, weeklyRules: { ...prev.weeklyRules, modifierValue: parseFloat(e.target.value) } }))}
                    className="w-full h-2.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 border border-slate-200"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-[2rem] p-8 border border-slate-200/50 flex flex-col justify-center text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Weekly Impact (Sample)</p>
              <div className="space-y-1">
                <span className="text-slate-400 text-sm line-through decoration-red-300 decoration-2">₹10,000</span>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-4xl font-black text-slate-900 tracking-tight">
                    ₹{Math.round(rules.weeklyRules.modifierType === 'percentage' 
                      ? 10000 * rules.weeklyRules.modifierValue 
                      : 10000 + rules.weeklyRules.modifierValue).toLocaleString()}
                  </span>
                  <div className="p-1 bg-emerald-100 rounded-full">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 2. Festival & Event Overrides (Refactored Section) */}
      <section className="bg-white rounded-[2.5rem] p-8 border-2 border-slate-100 shadow-sm transition-all hover:border-slate-200 space-y-10">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-fuchsia-50 text-fuchsia-600 rounded-2xl flex items-center justify-center shadow-sm">
            <CalendarClock className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">High Priority Overrides</h3>
              <span className="px-2.5 py-1 bg-fuchsia-600 text-white text-[9px] font-black rounded-lg shadow-sm border border-fuchsia-700 uppercase tracking-widest animate-pulse">Critical: Active</span>
            </div>
            <p className="text-sm text-slate-500 font-medium mt-0.5">Festival blocks that automatically supersede your weekly baseline.</p>
          </div>
        </div>

        {/* Existing Overrides Registry */}
        <div className="space-y-4">
          {rules.specialEvents.map(event => (
            <div 
              key={event.id} 
              className="group flex items-center justify-between p-6 bg-slate-50 hover:bg-white border-2 border-slate-100 hover:border-fuchsia-200 rounded-[2rem] transition-all hover:shadow-xl hover:-translate-y-0.5 border-l-[6px] border-l-fuchsia-500"
            >
              <div className="flex items-center gap-8">
                <div className="flex flex-col items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase mb-1 leading-none">{new Date(event.startDate).toLocaleDateString(undefined, {month: 'short'})}</span>
                  <span className="text-2xl font-black text-fuchsia-600 leading-none">{new Date(event.startDate).getDate()}</span>
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-xl tracking-tight leading-tight">{event.name}</h4>
                  <p className="text-xs text-slate-500 font-bold mt-1 flex items-center gap-2">
                    <Calendar className="w-3 h-3 text-slate-300" />
                    {event.startDate} <ArrowRight className="w-3 h-3" /> {event.endDate}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Override Value</p>
                  <p className="font-black text-slate-900 text-2xl tracking-tight">
                    {event.modifierType === 'percentage' 
                      ? (() => {
                          const val = Math.round((event.modifierValue - 1) * 100);
                          return `${val > 0 ? '+' : ''}${val}%${val < 0 ? ' discount' : ''}`;
                        })()
                      : `+₹${event.modifierValue.toLocaleString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                       setFormState({
                         name: event.name,
                         startDate: event.startDate,
                         endDate: event.endDate,
                         modifierType: event.modifierType,
                         modifierValue: event.modifierType === 'percentage' 
                           ? Math.round((event.modifierValue - 1) * 100) 
                           : event.modifierValue
                       });
                       removeOverride(event.id);
                    }}
                    className="p-3.5 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-2xl transition-all"
                    aria-label="Edit Override"
                  >
                    <Edit className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={() => removeOverride(event.id)}
                    className="p-3.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                    aria-label="Remove Override"
                  >
                    <Trash2 className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* New Strategy Builder Form */}
          <div className="p-10 bg-indigo-50/40 border-2 border-indigo-100/50 rounded-[2.5rem] shadow-sm space-y-10 animate-in fade-in zoom-in-95 duration-500 mt-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-[0.2em] text-indigo-900/70 block">Strategy Builder</span>
                <span className="text-sm font-bold text-slate-600">Configure a temporary price surge or seasonal block.</span>
              </div>
            </div>

            <div className="flex flex-col gap-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {/* Event Descriptive Label */}
                <div className="space-y-1.5 flex-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 block">Event Name</label>
                  <div className={`flex items-center gap-3 px-4 py-3.5 bg-white border-2 rounded-2xl transition-all ${formErrors.name ? 'border-red-200 ring-2 ring-red-100' : 'border-slate-100 focus-within:border-indigo-500'}`}>
                    <Sparkles className="w-4 h-4 text-slate-300" />
                    <input 
                      placeholder="e.g. Diwali Peak"
                      value={formState.name}
                      onChange={e => setFormState({...formState, name: e.target.value})}
                      className="w-full bg-transparent text-sm font-bold text-slate-900 outline-none placeholder:text-slate-300"
                    />
                  </div>
                </div>
                
                {/* Date Selection Components - Simplified to Icons */}
                <FormDatePicker 
                  label="Start Date" 
                  value={formState.startDate} 
                  onChange={(val) => setFormState({...formState, startDate: val})}
                  error={formErrors.startDate}
                />

                <FormDatePicker 
                  label="End Date" 
                  value={formState.endDate} 
                  min={formState.startDate}
                  onChange={(val) => setFormState({...formState, endDate: val})}
                  error={formErrors.endDate}
                />

                {/* Adjustment Value Input Group */}
                <div className="space-y-1.5 flex-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 block">Adjustment</label>
                  <div className="flex gap-2">
                    <select 
                      value={formState.modifierType}
                      onChange={e => {
                        const nextType = e.target.value as any;
                        setFormState({
                          ...formState, 
                          modifierType: nextType,
                          modifierValue: nextType === 'percentage' ? 10 : 500
                        });
                      }}
                      className="px-3 py-3.5 bg-white border-2 border-slate-100 rounded-2xl text-[10px] font-black text-slate-900 outline-none cursor-pointer hover:border-indigo-400 transition-all appearance-none text-center min-w-[50px]"
                    >
                      <option value="percentage">%</option>
                      <option value="fixed">₹</option>
                    </select>
                    <div className="flex-1 flex items-center gap-3 px-4 py-3.5 bg-white border-2 border-slate-100 rounded-2xl transition-all focus-within:border-indigo-500">
                      <input 
                        type="number"
                        value={formState.modifierValue}
                        onChange={e => setFormState({...formState, modifierValue: Number(e.target.value)})}
                        className="w-full bg-transparent text-sm font-bold text-slate-900 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-indigo-100/50">
                <div className="flex items-center gap-2 text-[10px] text-indigo-700/60 font-bold uppercase tracking-widest">
                  <span className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center text-[8px]">i</span>
                  Rates clamp automatically within safety guardrails
                </div>
                <button 
                  onClick={handleAddOverride}
                  className="px-12 py-4.5 bg-indigo-600 text-white rounded-[1.25rem] font-black text-xs uppercase tracking-[0.25em] hover:bg-indigo-700 transition-all flex items-center gap-4 shadow-2xl shadow-indigo-600/30 active:scale-[0.97]"
                >
                  Save Strategy Override
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Safety Guardrails Section */}
      <section className="bg-amber-50/50 border-2 border-amber-100 rounded-[2.5rem] p-10 flex flex-col md:flex-row gap-10">
        <div className="p-8 bg-amber-100 text-amber-700 rounded-[2rem] shrink-0 h-fit shadow-inner">
          <ShieldAlert className="w-12 h-12" />
        </div>
        <div className="space-y-6 flex-1">
          <div>
            <h3 className="text-2xl font-black text-amber-900 tracking-tight">Revenue Safety Guardrails</h3>
            <p className="text-sm text-amber-800 font-medium leading-relaxed max-w-2xl mt-1">
              Safety guardrails act as an unbreakable ceiling and floor for all dynamic logic. No automation can push rates outside these defined zones, protecting you from pricing errors.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-[2rem] border-2 border-amber-200/40 shadow-sm group hover:border-amber-400 transition-all">
              <p className="text-[11px] font-black text-amber-500/80 uppercase tracking-widest mb-1.5">Unbreakable Floor (Min)</p>
              <div className="flex items-end gap-1.5">
                <span className="text-sm font-black text-slate-400 mb-1">₹</span>
                <p className="text-3xl font-black text-slate-800 tracking-tight">4,500</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border-2 border-amber-200/40 shadow-sm group hover:border-amber-400 transition-all">
              <p className="text-[11px] font-black text-amber-500/80 uppercase tracking-widest mb-1.5">Unbreakable Ceiling (Max)</p>
              <div className="flex items-end gap-1.5">
                <span className="text-sm font-black text-slate-400 mb-1">₹</span>
                <p className="text-3xl font-black text-slate-800 tracking-tight">45,000</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Strategy Priority Documentation */}
      <section className="bg-slate-900 rounded-[3rem] p-10 flex flex-col md:flex-row gap-10 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-[0.03]">
           <Zap className="w-64 h-64" />
        </div>
        <div className="p-8 bg-slate-800 text-indigo-400 rounded-[2.5rem] shrink-0 h-fit shadow-2xl">
          <Info className="w-12 h-12" />
        </div>
        <div className="space-y-6 flex-1 z-10">
          <div>
            <h3 className="text-2xl font-black text-white tracking-tight">Yield Hierarchy Architecture</h3>
            <p className="text-sm text-slate-400 leading-relaxed font-medium mt-1">
              SyncGuard uses an atomic priority engine to resolve rate conflicts. Higher priority levels silently override lower logic blocks.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white/10 p-5 rounded-3xl border-2 border-emerald-500/30 shadow-sm relative overflow-hidden">
              <div className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[8px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-widest">Master</div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[11px] font-black">0</div>
                <p className="text-[11px] font-black text-white uppercase tracking-widest">Manual Override</p>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">Top Priority. Manual entries in the Grid bypass all automated logic for granular precision.</p>
            </div>
            <div className="bg-fuchsia-500/10 p-5 rounded-3xl border-2 border-fuchsia-500/20 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-6 h-6 rounded-full bg-fuchsia-600 flex items-center justify-center text-white text-[11px] font-black">1</div>
                <p className="text-[11px] font-black text-white uppercase tracking-widest">Festival Rules</p>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">High Priority. Overrides weekly baseline rules for specific date ranges (e.g. Christmas, Diwali).</p>
            </div>
            <div className="bg-white/5 p-5 rounded-3xl border-2 border-white/5 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[11px] font-black">2</div>
                <p className="text-[11px] font-black text-white uppercase tracking-widest">Weekly Baseline</p>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">Normal Priority. Standard recurring modifiers for demand peaks like weekends.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default RateRulesPage;
