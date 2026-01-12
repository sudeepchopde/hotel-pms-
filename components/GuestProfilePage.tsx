
import React, { useState, useEffect } from 'react';
import { 
  X, User, Calendar, MapPin, Smartphone, Mail, FileBadge, 
  Bed, Users, Star, AlertCircle, CheckCircle2, CreditCard, 
  Clock, ShieldAlert, Plus, Trash2, Edit3, MessageSquare, ChevronDown,
  Hash, LogIn, FileText, ScanLine, Lock, Eye, Shield, FileImage, RotateCcw,
  Utensils, Coffee, Zap, Receipt, Globe, Plane, Briefcase, Sparkles, Sofa,
  Minus
} from 'lucide-react';
import { Booking, RoomType, SyncEvent, FolioItem, GuestDetails } from '../types';

interface GuestProfilePageProps {
  booking: Booking;
  roomTypes: RoomType[];
  onClose: () => void;
  onUpdateStatus: (bookingId: string, newStatus: string) => void;
  onToggleVIP?: (bookingId: string) => void;
  onCheckIn?: (booking: Booking, isAccessory?: boolean, accessoryIndex?: number) => void;
  onEditInventory?: () => void;
  onUpdateExtraBeds?: (bookingId: string, count: number) => void;
}

const STATUS_OPTIONS = [
  { value: 'Confirmed', label: 'Confirmed', bg: 'bg-blue-500', text: 'text-white' },
  { value: 'Cancelled', label: 'Cancelled', bg: 'bg-red-500', text: 'text-white' },
  { value: 'CheckedIn', label: 'Checked In', bg: 'bg-emerald-500', text: 'text-white' },
  { value: 'CheckedOut', label: 'Checked Out', bg: 'bg-gray-400', text: 'text-white' },
  { value: 'Rejected', label: 'Warning/Unpaid', bg: 'bg-amber-500', text: 'text-white' }
];

const CURRENT_USER_PERMISSION = 2; 
const MOCK_ID_IMAGE = "https://images.unsplash.com/photo-1548543604-a87c9909abec?q=80&w=2528&auto=format&fit=crop"; 

const GuestProfilePage: React.FC<GuestProfilePageProps> = ({ 
  booking, 
  roomTypes, 
  onClose, 
  onUpdateStatus, 
  onToggleVIP, 
  onCheckIn, 
  onEditInventory,
  onUpdateExtraBeds
}) => {
  const [isIdRevealed, setIsIdRevealed] = useState(false);
  const [activeSide, setActiveSide] = useState<'front' | 'back' | 'visa'>('front');
  const [isUpdatingBeds, setIsUpdatingBeds] = useState(false);
  
  const roomType = roomTypes.find(rt => rt.id === booking.roomTypeId);

  const getStatusStyles = (status: string) => {
    const opt = STATUS_OPTIONS.find(o => o.value === status) || STATUS_OPTIONS[0];
    return `${opt.bg} ${opt.text}`;
  };

  const handleRevealId = () => {
    if (CURRENT_USER_PERMISSION < 2) {
      alert("Access Denied: Permission Level 2 required to view unmasked PII.");
      return;
    }
    setIsIdRevealed(true);
  };

  const handleExtraBedsChange = (delta: number) => {
    const current = booking.extraBeds || 0;
    const next = Math.max(0, current + delta);
    
    // Visual feedback for activation
    setIsUpdatingBeds(true);
    onUpdateExtraBeds?.(booking.id, next);
    setTimeout(() => setIsUpdatingBeds(false), 200);
  };

  const folioTotal = (booking.folio || []).reduce((sum, item) => sum + item.amount, 0);
  const grandTotal = (booking.amount || 0) + folioTotal;

  const details = booking.guestDetails;
  const isForeigner = (details?.nationality || 'Indian').toLowerCase() !== 'indian';

  const frontSrc = details?.idImage || MOCK_ID_IMAGE;
  const backSrc = details?.idImageBack;
  const visaSrc = details?.visaPage;
  
  const currentImageSrc = activeSide === 'front' ? frontSrc : activeSide === 'back' ? (backSrc || frontSrc) : (visaSrc || frontSrc);

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-50 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-slate-500" />
          </button>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Guest Profile & Booking Manager</h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest tabular-nums">
              ID: #{booking.id.split('-')[1]?.slice(0, 8)} • {booking.source} Channel
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative group">
            <button className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all ${getStatusStyles(booking.status)}`}>
              {booking.status === 'Rejected' ? 'Warning/Unpaid' : booking.status === 'CheckedIn' ? 'In-House' : booking.status}
              <ChevronDown className="w-4 h-4" />
            </button>
            <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[101] p-2">
               {STATUS_OPTIONS.map((opt) => (
                 <button
                   key={opt.value}
                   onClick={() => onUpdateStatus(booking.id, opt.value)}
                   className="w-full text-left p-3 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors"
                 >
                   <div className={`w-3 h-3 rounded-full ${opt.bg}`}></div>
                   <span className="text-xs font-bold text-slate-700">{opt.label === 'Rejected' ? 'Warning/Unpaid' : opt.label}</span>
                 </button>
               ))}
            </div>
          </div>

          {onCheckIn && (
             <button 
              onClick={() => onCheckIn(booking, false)}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg flex items-center gap-2"
             >
               <ScanLine className="w-4 h-4" /> 
               Scan ID
             </button>
          )}

          <button className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Reg Card
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 pb-24">
          
          <div className="lg:col-span-2 space-y-8">
            <section className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
              <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-600 shadow-inner relative overflow-hidden">
                    <User className="w-10 h-10" />
                    {booking.isVIP && (
                      <div className="absolute top-0 right-0 bg-violet-500 p-1 rounded-bl-lg">
                        <Star className="w-3 h-3 text-white fill-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900">{booking.guestName}</h3>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Primary Resident
                        </span>
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100 uppercase tracking-widest">
                          {details?.nationality || 'Indian'}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => onToggleVIP?.(booking.id)}
                      className={`p-3 rounded-2xl transition-all shadow-sm border ${
                        booking.isVIP 
                        ? 'bg-violet-100 border-violet-200 text-violet-600' 
                        : 'bg-slate-50 border-slate-100 text-slate-300 hover:text-violet-400 hover:border-violet-100'
                      }`}
                    >
                      <Star className={`w-6 h-6 ${booking.isVIP ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                </div>
                <button 
                  onClick={() => onCheckIn?.(booking, false)}
                  className="p-2.5 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                >
                  <Edit3 className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="flex items-center gap-4 group">
                    <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors"><Smartphone className="w-5 h-5" /></div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mobile Number</p>
                      <p className="text-sm font-bold text-slate-700 tabular-nums">{details?.phoneNumber || 'Not Provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 group">
                    <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors"><Mail className="w-5 h-5" /></div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Address</p>
                      <p className="text-sm font-bold text-slate-700 truncate max-w-[200px]">{details?.email || 'Not Provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 group">
                    <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors"><Calendar className="w-5 h-5" /></div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date of Birth</p>
                      <p className="text-sm font-bold text-slate-700 tabular-nums">{details?.dob || 'Not Disclosed'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 group">
                    <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors"><User className="w-5 h-5" /></div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gender</p>
                      <p className="text-sm font-bold text-slate-700">{details?.gender || 'Not Disclosed'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 group">
                    <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors"><MapPin className="w-5 h-5" /></div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Residential Address</p>
                      <p className="text-xs font-bold text-slate-600 leading-relaxed max-w-[240px]">{details?.address || 'Awaiting manual verification or OCR extraction.'}</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div className="flex items-center gap-4 group">
                    <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors"><FileBadge className="w-5 h-5" /></div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{details?.idType || 'Identification'}</p>
                      <p className="text-sm font-bold text-slate-700 tabular-nums">{details?.idNumber || 'Awaiting Verification'}</p>
                    </div>
                  </div>
                  
                  <div className="relative w-full h-64 bg-slate-900 rounded-2xl overflow-hidden shadow-md group/id">
                    <img 
                      src={currentImageSrc} 
                      alt="Scanned ID" 
                      className={`w-full h-full object-cover transition-all duration-700 ${isIdRevealed ? 'blur-0 opacity-100' : 'blur-xl opacity-60'}`}
                    />
                    
                    {!isIdRevealed ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 backdrop-blur-sm z-10 space-y-3">
                        <Lock className="w-8 h-8 text-slate-300" />
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">PII Masked</p>
                        <button onClick={handleRevealId} className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-[10px] font-black text-white uppercase tracking-widest">View ID</button>
                      </div>
                    ) : (
                      <div className="absolute top-3 left-3 right-3 flex gap-2 z-20">
                         <button onClick={() => setActiveSide('front')} className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase transition-all ${activeSide === 'front' ? 'bg-white text-indigo-600' : 'bg-black/40 text-white/70 hover:bg-black/60'}`}>Front</button>
                         <button onClick={() => setActiveSide('back')} className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase transition-all ${activeSide === 'back' ? 'bg-white text-indigo-600' : 'bg-black/40 text-white/70 hover:bg-black/60'}`}>Back</button>
                         {isForeigner && <button onClick={() => setActiveSide('visa')} className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase transition-all ${activeSide === 'visa' ? 'bg-white text-indigo-600' : 'bg-black/40 text-white/70 hover:bg-black/60'}`}>Visa</button>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* CO-GUESTS (ACCESSORY GUESTS) */}
            <section className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
               <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3">
                     <Users className="w-5 h-5 text-indigo-500" />
                     Accessory Guests
                  </h3>
                  <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {(booking.accessoryGuests?.length || 0)} Co-residents
                  </span>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {booking.accessoryGuests && booking.accessoryGuests.map((guest, idx) => (
                     <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-indigo-100 transition-all group flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-colors shadow-sm">
                              <User className="w-5 h-5" />
                           </div>
                           <div>
                              <p className="text-sm font-bold text-slate-800">{guest.name}</p>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{guest.idType}: {guest.idNumber || 'PENDING'}</p>
                           </div>
                        </div>
                        <button onClick={() => onCheckIn?.(booking, true, idx)} className="p-2 text-slate-300 hover:text-indigo-500 hover:bg-white rounded-lg transition-all opacity-0 group-hover:opacity-100"><Edit3 className="w-4 h-4" /></button>
                     </div>
                  ))}
                  <button onClick={() => onCheckIn?.(booking, true)} className="p-4 border-2 border-dashed border-slate-100 rounded-2xl flex items-center justify-center gap-2 text-slate-400 hover:border-indigo-200 hover:text-indigo-500 transition-all">
                     <Plus className="w-4 h-4" />
                     <span className="text-xs font-bold uppercase tracking-widest">Add Co-Guest</span>
                  </button>
               </div>
            </section>

            {/* INTERNATIONAL REGISTRATION DATA (FORM C) */}
            {isForeigner && (
               <section className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
                  <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3 mb-8">
                     <Globe className="w-5 h-5 text-amber-500" />
                     International Compliance (Form C)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                     <div className="space-y-8">
                        <div className="flex gap-4">
                           <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl shadow-sm border border-amber-100 h-fit"><FileBadge className="w-5 h-5" /></div>
                           <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Passport Details</p>
                              <p className="text-sm font-bold text-slate-700">{details?.passportNumber || 'N/A'}</p>
                              <div className="grid grid-cols-2 gap-4 mt-2">
                                <div>
                                  <p className="text-[8px] font-black text-slate-400 uppercase">Expiry</p>
                                  <p className="text-[10px] font-bold text-slate-600">{details?.passportExpiry || 'N/A'}</p>
                                </div>
                                <div>
                                  <p className="text-[8px] font-black text-slate-400 uppercase">Issue Date</p>
                                  <p className="text-[10px] font-bold text-slate-600">{details?.passportIssueDate || 'N/A'}</p>
                                </div>
                                <div className="col-span-2">
                                  <p className="text-[8px] font-black text-slate-400 uppercase">Place of Issue</p>
                                  <p className="text-[10px] font-bold text-slate-600">{details?.passportPlaceIssue || 'N/A'}</p>
                                </div>
                              </div>
                           </div>
                        </div>
                        <div className="flex gap-4">
                           <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shadow-sm border border-blue-100 h-fit"><Shield className="w-5 h-5" /></div>
                           <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Visa Details ({details?.visaType || 'N/A'})</p>
                              <p className="text-sm font-bold text-slate-700">{details?.visaNumber || 'N/A'}</p>
                              <div className="grid grid-cols-2 gap-4 mt-2">
                                <div>
                                  <p className="text-[8px] font-black text-slate-400 uppercase">Expiry</p>
                                  <p className="text-[10px] font-bold text-slate-600">{details?.visaExpiry || 'N/A'}</p>
                                </div>
                                <div>
                                  <p className="text-[8px] font-black text-slate-400 uppercase">Issue Date</p>
                                  <p className="text-[10px] font-bold text-slate-600">{details?.visaIssueDate || 'N/A'}</p>
                                </div>
                                <div className="col-span-2">
                                  <p className="text-[8px] font-black text-slate-400 uppercase">Place of Issue</p>
                                  <p className="text-[10px] font-bold text-slate-600">{details?.visaPlaceIssue || 'N/A'}</p>
                                </div>
                              </div>
                           </div>
                        </div>
                     </div>
                     <div className="space-y-8">
                        <div className="flex gap-4">
                           <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shadow-sm border border-emerald-100 h-fit"><Plane className="w-5 h-5" /></div>
                           <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Arrival Data</p>
                              <p className="text-sm font-bold text-slate-700">From {details?.arrivedFrom || 'N/A'}</p>
                              <div className="grid grid-cols-2 gap-4 mt-2">
                                <div>
                                  <p className="text-[8px] font-black text-slate-400 uppercase">Date In India</p>
                                  <p className="text-[10px] font-bold text-slate-600">{details?.arrivalDateIndia || 'N/A'}</p>
                                </div>
                                <div>
                                  <p className="text-[8px] font-black text-slate-400 uppercase">Arrival Port</p>
                                  <p className="text-[10px] font-bold text-slate-600">{details?.arrivalPort || 'N/A'}</p>
                                </div>
                              </div>
                           </div>
                        </div>
                        <div className="flex gap-4">
                           <div className="p-2.5 bg-slate-50 text-slate-600 rounded-xl shadow-sm border border-slate-100 h-fit"><Briefcase className="w-5 h-5" /></div>
                           <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Stay Objectives</p>
                              <p className="text-sm font-bold text-slate-700">{details?.purposeOfVisit || 'Tourism'}</p>
                              <div className="grid grid-cols-1 gap-2 mt-2">
                                <div>
                                  <p className="text-[8px] font-black text-slate-400 uppercase">Next Destination</p>
                                  <p className="text-[10px] font-bold text-slate-600">{details?.nextDestination || 'Not Declared'}</p>
                                </div>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
               </section>
            )}

            {/* AUTOMATED FOLIO LOGS */}
            <section className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
               <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <Utensils className="w-5 h-5 text-indigo-500" />
                    Transaction Ledger
                  </h3>
                  <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-100 rounded-full text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    {booking.folio?.length || 0} Entries
                  </div>
               </div>

               <div className="space-y-3">
                  {booking.folio && booking.folio.length > 0 ? (
                    booking.folio.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-indigo-100 transition-all group">
                         <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-xl border shadow-sm ${item.category === 'F&B' ? 'bg-orange-50 border-orange-100 text-orange-600' : item.category === 'Room' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
                               {item.category === 'F&B' ? <Coffee className="w-4 h-4" /> : item.category === 'Room' ? <Bed className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                            </div>
                            <div>
                               <p className="text-sm font-bold text-slate-800">{item.description}</p>
                               <p className="text-[9px] font-black text-slate-400 uppercase tabular-nums">{new Date(item.timestamp).toLocaleString()}</p>
                            </div>
                         </div>
                         <div className="text-right">
                            <p className="text-sm font-black text-slate-900 tabular-nums">₹{item.amount.toLocaleString()}</p>
                            <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Posted</p>
                         </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-[2rem] bg-slate-50/50">
                       <Receipt className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                       <p className="text-xs font-bold text-slate-400">No additional charges found for this folio.</p>
                    </div>
                  )}
               </div>
            </section>
          </div>

          <div className="space-y-8">
            <section className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Clock className="w-32 h-32" />
              </div>
              <div className="flex items-center justify-between mb-8 relative z-10">
                 <h3 className="text-lg font-black tracking-tight uppercase">Folio Status</h3>
                 <span className="px-3 py-1 bg-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest border border-white/10 tabular-nums">
                    {Math.ceil((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 3600 * 24))} Nights
                 </span>
              </div>
              
              <div className="space-y-8 relative z-10">
                <div className="flex gap-5">
                  <div className="p-3.5 bg-white/10 rounded-2xl shrink-0 border border-white/5"><Calendar className="w-6 h-6 text-indigo-300" /></div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stay Period</p>
                    <p className="text-lg font-black tabular-nums">{new Date(booking.checkIn).toLocaleDateString()} - {new Date(booking.checkOut).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              <div className="mt-10 pt-8 border-t border-white/10 space-y-4 relative z-10">
                <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                   <span>Room Base</span>
                   <span className="text-white">₹{(booking.amount || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                   <span>Add-ons / F&B</span>
                   <span className="text-indigo-400">+ ₹{folioTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-white/5">
                   <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Net Outstanding</p>
                      <p className="text-3xl font-black text-emerald-400 tabular-nums">₹{grandTotal.toLocaleString()}</p>
                   </div>
                   <div className="flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                      <span className="text-[9px] font-black text-emerald-400 uppercase">Settled</span>
                   </div>
                </div>
              </div>
            </section>

            {/* SPECIAL REQUESTS */}
            <section className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
               <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3 mb-6">
                 <MessageSquare className="w-5 h-5 text-violet-500" />
                 Guest Requests
               </h3>
               <div className="p-5 bg-violet-50/50 border border-violet-100 rounded-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                     <Sparkles className="w-8 h-8 text-violet-600" />
                  </div>
                  <p className="text-sm font-bold text-slate-700 leading-relaxed italic">
                    {booking.specialRequests || 'No special requirements shared.'}
                  </p>
               </div>
            </section>

            {/* EXTRA BED MANAGEMENT */}
            <section className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
               <div className="flex items-center justify-between mb-6">
                 <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3">
                   <Sofa className="w-5 h-5 text-indigo-500" />
                   Extra Bedding
                 </h3>
                 <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">
                   ₹{roomType?.extraBedCharge || 0} / bed
                 </span>
               </div>
               
               <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
                       <Bed className="w-5 h-5" />
                    </div>
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stay Units</p>
                       <p className={`text-sm font-bold text-slate-800 transition-all duration-200 ${isUpdatingBeds ? 'scale-110 text-indigo-600' : 'scale-100'}`}>
                         {booking.extraBeds || 0} Beds Added
                       </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 bg-white rounded-xl p-1 shadow-sm border border-slate-200">
                     <button 
                        onClick={() => handleExtraBedsChange(-1)}
                        className="p-2 text-slate-400 hover:text-red-500 transition-all active:scale-75"
                        aria-label="Decrease extra beds"
                      >
                       <Minus className="w-4 h-4" />
                     </button>
                     <span className="w-8 text-center text-sm font-black text-slate-700 tabular-nums">{booking.extraBeds || 0}</span>
                     <button 
                        onClick={() => handleExtraBedsChange(1)}
                        className="p-2 text-slate-400 hover:text-emerald-500 transition-all active:scale-75"
                        aria-label="Increase extra beds"
                      >
                       <Plus className="w-4 h-4" />
                     </button>
                  </div>
               </div>
            </section>

            <section className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 tracking-tight mb-6">Inventory Access</h3>
              <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                   <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl"><Bed className="w-6 h-6" /></div>
                   <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Assigned Unit</p>
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-black text-slate-800 tabular-nums">#{booking.roomNumber || 'AWAITING'}</p>
                        <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-bold text-slate-400 uppercase">
                          {roomType?.name || 'Category'}
                        </span>
                      </div>
                   </div>
                </div>
                <button 
                  onClick={onEditInventory}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl"
                >
                  Modify Assignment
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestProfilePage;
