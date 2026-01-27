
import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus, Trash2, Edit3, ShieldAlert, CheckCircle2,
  IndianRupee, Users, Bed, Info, X, Save,
  Lock, Check, AlertTriangle, History, Hash, Sofa,
  QrCode, Printer, Download, Terminal, ExternalLink, Globe,
  Settings2, Smartphone, Building2, RotateCcw, Link as LinkIcon, ArrowRight
} from 'lucide-react';
import { RoomType, SyncEvent, PropertySettings, Booking } from '../types';
import { updatePropertySettings, createRoomType, updateRoomType, deleteRoomType } from '../api';

interface PropertySetupPageProps {
  roomTypes: RoomType[];
  setRoomTypes: React.Dispatch<React.SetStateAction<RoomType[]>>;
  syncEvents: SyncEvent[];
  propertySettings: PropertySettings | null;
  setPropertySettings: React.Dispatch<React.SetStateAction<PropertySettings | null>>;
}

const PYTHON_SCRIPT = `
import qrcode
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
import os

def generate_hotel_qrs(room_list):
    os.makedirs('temp_qrs', exist_ok=True)
    c = canvas.Canvas("Hotel_Room_QRs.pdf", pagesize=A4)
    width, height = A4
    margin = 1 * cm
    grid_w = (width - 2*margin) / 3
    grid_h = (height - 2*margin) / 3
    
    for i, room_id in enumerate(room_list):
        if i > 0 and i % 9 == 0: c.showPage()
        row = (i % 9) // 3
        col = (i % 9) % 3
        x = margin + col * grid_w
        y = height - margin - (row + 1) * grid_h
        
        url = f"https://hotelsatsangi.com/order?room={room_id}"
        img = qrcode.make(url)
        qr_path = f"temp_qrs/room_{room_id}.png"
        img.save(qr_path)
        
        qr_size = grid_w * 0.8
        c.drawImage(qr_path, x + (grid_w - qr_size)/2, y + (grid_h - qr_size)/2 + 1*cm, width=qr_size, height=qr_size)
        c.setFont("Helvetica-Bold", 14)
        c.drawCentredString(x + grid_w/2, y + 1*cm, f"ROOM {room_id}")
        c.setFont("Helvetica", 8)
        c.drawCentredString(x + grid_w/2, y + 0.5*cm, "Scan to Order Room Service")
    c.save()

if __name__ == "__main__":
    generate_hotel_qrs(["101", "102", "103", "104", "105"])
`;

const PropertySetupPage: React.FC<PropertySetupPageProps> = ({
  roomTypes,
  setRoomTypes,
  syncEvents,
  propertySettings,
  setPropertySettings
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<{ name: string, count: number } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showQRPreview, setShowQRPreview] = useState(false);
  const [showCodeSnippet, setShowCodeSnippet] = useState(false);
  const [activeTab, setActiveTab] = useState<'inventory' | 'profile' | 'integrations'>('profile');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingRoom, setIsSavingRoom] = useState(false);
  const [profileFormData, setProfileFormData] = useState<PropertySettings>({
    name: '',
    address: '',
    phone: '',
    email: '',
    gstNumber: '',
    gstRate: 12.0,
    foodGstRate: 5.0,
    otherGstRate: 18.0,
    geminiApiKey: ''
  });

  useEffect(() => {
    if (propertySettings) {
      setProfileFormData(propertySettings);
    }
  }, [propertySettings]);

  // Local testing IP/Domain override
  const [testBaseUrl, setTestBaseUrl] = useState(window.location.origin);

  const [formData, setFormData] = useState<Partial<RoomType>>({
    name: '',
    totalCapacity: 1,
    basePrice: 1000,
    baseOccupancy: 2,
    amenities: [],
    roomNumbers: ['101'],
    extraBedCharge: 500
  });

  const resetForm = () => {
    setFormData({
      name: '',
      totalCapacity: 1,
      basePrice: 1000,
      baseOccupancy: 2,
      amenities: [],
      roomNumbers: ['101'],
      extraBedCharge: 500
    });
    setIsAdding(false);
    setEditingId(null);
    setValidationError(null);
  };

  const handleSave = async () => {
    if (!formData.name) return;
    // Check for active/future bookings in rooms being removed
    if (editingId && formData.roomNumbers) {
      const originalRT = roomTypes.find(rt => rt.id === editingId);
      if (originalRT && originalRT.roomNumbers) {
        const removed = originalRT.roomNumbers.filter(num => !formData.roomNumbers!.includes(num));
        if (removed.length > 0) {
          const todayStr = new Date().toISOString().split('T')[0];
          const affectedBookings = syncEvents.filter(e =>
            e.type === 'booking' &&
            ['Confirmed', 'CheckedIn'].includes(e.status) &&
            removed.includes(e.roomNumber || '') &&
            e.checkOut >= todayStr
          ) as Booking[];

          if (affectedBookings.length > 0) {
            const affectedRooms = Array.from(new Set(affectedBookings.map(b => b.roomNumber))).join(', ');
            setValidationError(`Cannot modify/remove room(s) ${affectedRooms} because they have active or future bookings. Please cancel or relocate these bookings first.`);
            setIsSavingRoom(false);
            return;
          }
        }
      }
    }

    if (formData.roomNumbers) {
      const normalizedNumbers = formData.roomNumbers.map(n => n.trim());
      const uniqueNumbers = new Set(normalizedNumbers);
      if (uniqueNumbers.size !== normalizedNumbers.length) {
        const duplicates = normalizedNumbers.filter((item, index) => normalizedNumbers.indexOf(item) !== index);
        setValidationError(`Duplicate identifiers detected: ${Array.from(new Set(duplicates)).join(', ')}.`);
        return;
      }
      if (normalizedNumbers.some(n => n === '')) {
        setValidationError("Room identifiers cannot be empty.");
        return;
      }
      const otherRoomNumbers = new Set<string>();
      roomTypes.forEach(rt => {
        if (rt.id !== editingId && rt.roomNumbers) {
          rt.roomNumbers.forEach(num => otherRoomNumbers.add(num.trim()));
        }
      });
      const globalConflicts = normalizedNumbers.filter(num => otherRoomNumbers.has(num));
      if (globalConflicts.length > 0) {
        setValidationError(`Conflict: Room(s) ${Array.from(new Set(globalConflicts)).join(', ')} already exist.`);
        return;
      }
    }

    setIsSavingRoom(true);
    try {
      if (editingId) {
        const updated = await updateRoomType(editingId, { ...formData, id: editingId } as RoomType);
        setRoomTypes(prev => prev.map(rt => rt.id === editingId ? updated : rt));
      } else {
        const newRoomData: RoomType = {
          ...formData,
          id: `rt-${Date.now()}`,
          floorPrice: Math.round((formData.basePrice || 1000) * 0.7),
          ceilingPrice: Math.round((formData.basePrice || 1000) * 2.0),
        } as RoomType;
        const created = await createRoomType(newRoomData);
        setRoomTypes(prev => [...prev, created]);
      }
      resetForm();
    } catch (err) {
      console.error("Failed to save room category", err);
      setValidationError("Failed to save room category. Please check your connection.");
    } finally {
      setIsSavingRoom(false);
    }
  };

  const handleProfileSave = async () => {
    setIsSavingProfile(true);
    try {
      const updated = await updatePropertySettings(profileFormData);
      setPropertySettings(updated);
      alert("Property settings saved successfully!");
    } catch (err) {
      console.error("Failed to save property profile", err);
      alert("Failed to save settings. Please try again.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const startEdit = (rt: RoomType) => {
    const roomNumbers = rt.roomNumbers && rt.roomNumbers.length === rt.totalCapacity
      ? rt.roomNumbers
      : Array.from({ length: rt.totalCapacity }, (_, i) => `${101 + i}`);
    setFormData({ ...rt, roomNumbers });
    setEditingId(rt.id);
    setIsAdding(true);
    setValidationError(null);
  };

  const handleDelete = async (id: string, name: string) => {
    const today = new Date().toISOString().split('T')[0];
    const futureBookings = syncEvents.filter(event =>
      event.type === 'booking' &&
      event.roomTypeId === id &&
      ['Confirmed', 'CheckedIn'].includes(event.status) &&
      event.checkOut >= today
    );
    if (futureBookings.length > 0) {
      setDeleteWarning({ name, count: futureBookings.length });
    } else {
      if (confirm(`Are you sure you want to delete the ${name} category?`)) {
        try {
          await deleteRoomType(id);
          setRoomTypes(prev => prev.filter(rt => rt.id !== id));
        } catch (err: any) {
          console.error("Failed to delete room category", err);
          alert(err.message || "Failed to delete room category");
        }
      }
    }
  };

  const handleCapacityChange = (newCapacity: number) => {
    const safeCapacity = Math.max(1, newCapacity);
    const currentRooms = formData.roomNumbers || [];
    let newRooms = [...currentRooms];
    if (safeCapacity > currentRooms.length) {
      for (let i = currentRooms.length; i < safeCapacity; i++) {
        newRooms.push(`${100 + i + 1}`);
      }
    } else if (safeCapacity < currentRooms.length) {
      newRooms = newRooms.slice(0, safeCapacity);
    }
    setFormData({ ...formData, totalCapacity: safeCapacity, roomNumbers: newRooms });
  };

  const allRooms = useMemo(() => {
    return Array.from(new Set(roomTypes.flatMap(rt => rt.roomNumbers || []))).sort();
  }, [roomTypes]);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500 pb-24">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Property Setup</h2>
          <div className="flex gap-4 mt-2">
            <button
              onClick={() => setActiveTab('profile')}
              className={`text-[11px] font-black uppercase tracking-[0.2em] pb-2 border-b-2 transition-all ${activeTab === 'profile' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              Property Profile
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`text-[11px] font-black uppercase tracking-[0.2em] pb-2 border-b-2 transition-all ${activeTab === 'inventory' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              Room Inventory
            </button>
            <button
              onClick={() => setActiveTab('integrations')}
              className={`text-[11px] font-black uppercase tracking-[0.2em] pb-2 border-b-2 transition-all ${activeTab === 'integrations' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              Integrations
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          {(activeTab === 'inventory') && (
            <>
              <button
                onClick={() => setShowQRPreview(true)}
                className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-slate-100 text-slate-700 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm"
              >
                <QrCode className="w-4 h-4" /> Print QR Labels
              </button>
              <button
                onClick={() => { resetForm(); setIsAdding(true); }}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-100"
              >
                <Plus className="w-4 h-4" /> Add Room Category
              </button>
            </>
          )}
          {(activeTab === 'profile' || activeTab === 'integrations') && (
            <button
              onClick={handleProfileSave}
              disabled={isSavingProfile}
              className={`flex items-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all ${isSavingProfile ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isSavingProfile ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              {isSavingProfile ? 'Saving...' : 'Save Config'}
            </button>
          )}
        </div>
      </header>

      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="lg:col-span-2 space-y-8">
            <section className="bg-white rounded-[2.5rem] border border-slate-100 p-10 shadow-sm space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Public Identity</h3>
                  <p className="text-xs text-slate-500 font-medium">This information appears on bills, receipts, and government forms.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Property Name</label>
                  <input
                    type="text"
                    value={profileFormData.name}
                    onChange={e => setProfileFormData({ ...profileFormData, name: e.target.value })}
                    placeholder="e.g. Grand Palace Hotel"
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-base font-bold text-slate-900 focus:border-indigo-500 focus:bg-white outline-none transition-all"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Business Address</label>
                  <textarea
                    value={profileFormData.address}
                    onChange={e => setProfileFormData({ ...profileFormData, address: e.target.value })}
                    placeholder="Full postal address..."
                    rows={3}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-900 focus:border-indigo-500 focus:bg-white outline-none transition-all resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Contact Phone</label>
                  <input
                    type="text"
                    value={profileFormData.phone || ''}
                    onChange={e => setProfileFormData({ ...profileFormData, phone: e.target.value })}
                    placeholder="+91 XXXXX XXXXX"
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-900 focus:border-indigo-500 focus:bg-white outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Official Email</label>
                  <input
                    type="email"
                    value={profileFormData.email || ''}
                    onChange={e => setProfileFormData({ ...profileFormData, email: e.target.value })}
                    placeholder="contact@property.com"
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-900 focus:border-indigo-500 focus:bg-white outline-none transition-all"
                  />
                </div>
              </div>
            </section>

            <section className="bg-white rounded-[2.5rem] border border-slate-100 p-10 shadow-sm space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                  <IndianRupee className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Taxation & Invoicing</h3>
                  <p className="text-xs text-slate-500 font-medium">Configure GST settings for automated tax calculation.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">GST Registration Number</label>
                  <input
                    type="text"
                    value={profileFormData.gstNumber || ''}
                    onChange={e => setProfileFormData({ ...profileFormData, gstNumber: e.target.value })}
                    placeholder="e.g. 29ABCDE1234F1Z5"
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-900 focus:border-indigo-500 focus:bg-white outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Default GST Rate (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={profileFormData.gstRate}
                      onChange={e => setProfileFormData({ ...profileFormData, gstRate: Number(e.target.value) })}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black text-emerald-700 focus:border-emerald-500 focus:bg-white outline-none transition-all"
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 font-black">%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Food GST Rate (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={profileFormData.foodGstRate || 5.0}
                      onChange={e => setProfileFormData({ ...profileFormData, foodGstRate: Number(e.target.value) })}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black text-orange-700 focus:border-orange-500 focus:bg-white outline-none transition-all"
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 font-black">%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Other Services GST (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={profileFormData.otherGstRate || 18.0}
                      onChange={e => setProfileFormData({ ...profileFormData, otherGstRate: Number(e.target.value) })}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black text-blue-700 focus:border-blue-500 focus:bg-white outline-none transition-all"
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 font-black">%</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-[2.5rem] border border-slate-100 p-10 shadow-sm space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Deployment & Access</h3>
                  <p className="text-xs text-slate-500 font-medium">Configure how guests will access your PMS from their devices.</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                  <div className="flex items-center gap-3">
                    <ExternalLink className="w-5 h-5 text-indigo-600" />
                    <h5 className="font-black text-xs uppercase tracking-widest text-slate-700">Public Base URL</h5>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Set the address that guests' phones will use to access the system (e.g., your local IP for WiFi access or a custom domain).
                  </p>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Server Access URL</label>
                    <div className="relative group">
                      <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                      <input
                        type="text"
                        value={profileFormData.publicBaseUrl || ''}
                        onChange={e => setProfileFormData({ ...profileFormData, publicBaseUrl: e.target.value })}
                        placeholder="http://192.168.1.XX:3000"
                        className="w-full pl-12 pr-5 py-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-900 focus:border-indigo-500 outline-none transition-all shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="flex items-start gap-3 mt-4">
                    <div className="p-2 bg-white rounded-xl border border-slate-200">
                      <Terminal className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="text-[10px] text-slate-500 leading-relaxed font-medium">
                      If running on a hotel network, use your server's **Local IP address**. If using a domain like `hotel.com`, enter that here. This URL will be used in all generated QR codes.
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-6">Live Invoice Preview</h4>
              <div className="space-y-4 font-mono text-[10px] text-slate-300">
                <div className="border-b border-white/10 pb-4">
                  <p className="font-black text-white text-xs mb-1 uppercase tracking-tight">{profileFormData.name || 'Your Property Name'}</p>
                  <p className="leading-relaxed opacity-60">{profileFormData.address || 'Address not set'}</p>
                  <p className="mt-1 opacity-60">GSTIN: {profileFormData.gstNumber || 'Not provided'}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between"><span>Room Charges (2n)</span><span>₹9,000.00</span></div>
                  <div className="flex justify-between"><span>Food & Bev</span><span>₹1,250.00</span></div>
                  <div className="flex justify-between text-[8px] text-indigo-300 font-bold">
                    <span>GST - Room ({profileFormData.gstRate}%)</span>
                    <span>₹{((9000 * profileFormData.gstRate) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-[8px] text-orange-300 font-bold">
                    <span>GST - Food ({profileFormData.foodGstRate || 5}%)</span>
                    <span>₹{((1250 * (profileFormData.foodGstRate || 5)) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
                <div className="border-t border-white/20 pt-4 flex justify-between text-white font-black text-sm">
                  <span>GRAND TOTAL</span>
                  <span>₹{((9000 * (1 + profileFormData.gstRate / 100)) + (1250 * (1 + (profileFormData.foodGstRate || 5) / 100))).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div className="mt-8 p-4 bg-white/5 rounded-xl border border-white/10">
                <p className="text-[9px] text-slate-400 leading-relaxed italic">Changes to these settings will follow through to all generated PDFs and reports instantly.</p>
              </div>
            </div>

            <div className="bg-indigo-50 border-2 border-indigo-100 rounded-[2rem] p-8 space-y-4">
              <div className="flex items-center gap-3 text-indigo-600">
                <ExternalLink className="w-5 h-5" />
                <h5 className="font-black text-xs uppercase tracking-widest">Compliance Help</h5>
              </div>
              <p className="text-xs text-indigo-900/70 leading-relaxed font-medium">
                Ensure your GST details match your GST portal records precisely to avoid reconciliation errors in GSTR-1 filings.
              </p>
              <button className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2 hover:gap-3 transition-all">
                Learn more about GST rules <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {
        activeTab === 'integrations' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="lg:col-span-2 space-y-8">
              <section className="bg-white rounded-[2.5rem] border border-slate-100 p-10 shadow-sm space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                    <Globe className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">AI & OCR Engine</h3>
                    <p className="text-xs text-slate-500 font-medium">Powering ID scanning and automated guest registration.</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                    <div className="flex items-center gap-3">
                      <ShieldAlert className="w-5 h-5 text-indigo-600" />
                      <h5 className="font-black text-xs uppercase tracking-widest text-slate-700">Google Gemini API Configuration</h5>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      This software uses Google's Gemini AI to scan guest IDs with elite accuracy.
                      Each property should have its own API key to ensure privacy and stay within free-tier limits.
                    </p>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Gemini API Key</label>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input
                          type="password"
                          value={profileFormData.geminiApiKey || ''}
                          onChange={e => setProfileFormData({ ...profileFormData, geminiApiKey: e.target.value })}
                          placeholder="Paste your API key here..."
                          className="w-full pl-12 pr-5 py-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-900 focus:border-indigo-500 outline-none transition-all shadow-sm"
                        />
                      </div>
                    </div>

                    <div className="flex items-start gap-3 mt-4">
                      <div className="p-2 bg-white rounded-xl border border-slate-200">
                        <Info className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="text-[10px] text-slate-500 leading-relaxed font-medium">
                        Don't have a key? <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-indigo-600 font-bold hover:underline">Get a free key from Google AI Studio</a>.
                        Standard usage is free for up to 1,500 scans/day.
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Razorpay Payment Gateway Section */}
              <section className="bg-white rounded-[2.5rem] border border-slate-100 p-10 shadow-sm space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                    <IndianRupee className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Payment Gateway</h3>
                    <p className="text-xs text-slate-500 font-medium">Accept online payments via Razorpay (UPI, Cards, Netbanking, Wallets).</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 space-y-4">
                    <div className="flex items-center gap-3">
                      <ShieldAlert className="w-5 h-5 text-emerald-600" />
                      <h5 className="font-black text-xs uppercase tracking-widest text-slate-700">Razorpay API Configuration</h5>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Enable online payment collection at the front desk. Guests can scan a QR or click a link to pay instantly.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Razorpay Key ID</label>
                        <div className="relative group">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                          <input
                            type="text"
                            value={profileFormData.razorpayKeyId || ''}
                            onChange={e => setProfileFormData({ ...profileFormData, razorpayKeyId: e.target.value })}
                            placeholder="rzp_live_xxxxxxxxxxxxx"
                            className="w-full pl-12 pr-5 py-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-900 focus:border-emerald-500 outline-none transition-all shadow-sm"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Razorpay Key Secret</label>
                        <div className="relative group">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                          <input
                            type="password"
                            value={profileFormData.razorpayKeySecret || ''}
                            onChange={e => setProfileFormData({ ...profileFormData, razorpayKeySecret: e.target.value })}
                            placeholder="••••••••••••••••"
                            className="w-full pl-12 pr-5 py-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-900 focus:border-emerald-500 outline-none transition-all shadow-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 mt-4">
                      <div className="p-2 bg-white rounded-xl border border-emerald-200">
                        <Info className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div className="text-[10px] text-slate-500 leading-relaxed font-medium">
                        Don't have an account? <a href="https://dashboard.razorpay.com/signup" target="_blank" rel="noreferrer" className="text-emerald-600 font-bold hover:underline">Sign up for Razorpay Business</a>.
                        Go to Settings → API Keys to generate your credentials.
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <div className="bg-indigo-900 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden">
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-300 mb-6">Integration Status</h4>
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${profileFormData.geminiApiKey ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-white/10'}`}>
                      {profileFormData.geminiApiKey ? <Check className="w-5 h-5 text-white" /> : <Settings2 className="w-5 h-5 text-white/50" />}
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest">OCR Engine</p>
                      <p className="text-[10px] text-indigo-200/70">{profileFormData.geminiApiKey ? 'Connected & Secure' : 'API Key Missing'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${profileFormData.razorpayKeyId && profileFormData.razorpayKeySecret ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-white/10'}`}>
                      {profileFormData.razorpayKeyId && profileFormData.razorpayKeySecret ? <Check className="w-5 h-5 text-white" /> : <IndianRupee className="w-5 h-5 text-white/50" />}
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest">Payment Gateway</p>
                      <p className="text-[10px] text-indigo-200/70">{profileFormData.razorpayKeyId && profileFormData.razorpayKeySecret ? 'Razorpay Connected' : 'Credentials Missing'}</p>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/10">
                    <p className="text-[10px] leading-relaxed text-indigo-100/60 italic">
                      "This model allows you to scale without overhead. Your customers manage their own credentials, keeping your liability and costs at zero."
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {
        activeTab === 'inventory' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {isAdding && (
              <div className="bg-white rounded-[2.5rem] border-2 border-indigo-100 p-8 shadow-2xl animate-in slide-in-from-top-4 duration-300">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold text-slate-800 tracking-tight">{editingId ? 'Edit Room Type' : 'Configure New Room Type'}</h3>
                  <button onClick={resetForm} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Room Category Name</label>
                      <input
                        type="text" value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Presidential Suite"
                        className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Total Inventory</label>
                        <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus-within:border-indigo-500 transition-all">
                          <Bed className="w-4 h-4 text-slate-400" />
                          <input type="number" value={formData.totalCapacity} onChange={e => handleCapacityChange(Number(e.target.value))} className="w-full bg-transparent font-bold text-slate-900 outline-none" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Base Occupancy</label>
                        <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus-within:border-indigo-500 transition-all">
                          <Users className="w-4 h-4 text-slate-400" />
                          <input type="number" value={formData.baseOccupancy} onChange={e => setFormData({ ...formData, baseOccupancy: Number(e.target.value) })} className="w-full bg-transparent font-bold text-slate-900 outline-none" />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Nightly Rate (INR)</label>
                        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border-2 border-emerald-100 rounded-2xl group focus-within:border-emerald-500 transition-all">
                          <IndianRupee className="w-4 h-4 text-emerald-600" />
                          <input type="number" value={formData.basePrice} onChange={e => setFormData({ ...formData, basePrice: Number(e.target.value) })} className="w-full bg-transparent font-bold text-emerald-700 outline-none" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Extra Bed Charge (INR)</label>
                        <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 border-2 border-indigo-100 rounded-2xl group focus-within:border-indigo-500 transition-all">
                          <Sofa className="w-4 h-4 text-indigo-600" />
                          <input type="number" value={formData.extraBedCharge} onChange={e => setFormData({ ...formData, extraBedCharge: Number(e.target.value) })} className="w-full bg-transparent font-bold text-indigo-700 outline-none" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4 pt-2 border-t border-slate-100">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Room Unit Identifiers</label>
                      <div className="grid grid-cols-4 gap-3 max-h-48 overflow-y-auto p-1">
                        {formData.roomNumbers?.map((num, idx) => (
                          <div key={idx} className="relative">
                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-3 h-3" />
                            <input type="text" value={num} onChange={(e) => {
                              const newRooms = [...(formData.roomNumbers || [])];
                              newRooms[idx] = e.target.value;
                              setFormData({ ...formData, roomNumbers: newRooms });
                              if (validationError) setValidationError(null);
                            }}
                              className={`w-full pl-8 pr-2 py-2.5 bg-slate-50 border-2 rounded-xl text-xs font-bold text-slate-700 outline-none ${validationError && formData.roomNumbers?.indexOf(num) !== formData.roomNumbers?.lastIndexOf(num) ? 'border-red-200' : 'border-slate-100 focus:border-indigo-500'}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col h-full">
                    {validationError && (
                      <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 mb-6">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        <p className="text-xs font-bold">{validationError}</p>
                      </div>
                    )}
                    <div className="mt-auto">
                      <button
                        onClick={handleSave}
                        disabled={isSavingRoom}
                        className={`w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-black transition-all flex items-center justify-center gap-3 ${isSavingRoom ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {isSavingRoom ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                        {isSavingRoom ? 'Saving...' : (editingId ? 'Update Inventory' : 'Finalize Room Type')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showQRPreview && (
              <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-8 overflow-y-auto">
                <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20 flex flex-col max-h-[90vh]">
                  <header className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">Bulk Room QR Generation</h3>
                      <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                        <Printer className="w-4 h-4" /> Arranged in 3x3 grid for A4 paper print.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setShowCodeSnippet(!showCodeSnippet)} className="flex items-center gap-2 px-5 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-xs">
                        <Terminal className="w-4 h-4" /> Python Tool
                      </button>
                      <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl">
                        <Download className="w-4 h-4" /> Download PDF
                      </button>
                      <button onClick={() => { setShowQRPreview(false); setShowCodeSnippet(false); }} className="p-3 hover:bg-slate-100 rounded-full text-slate-400"><X className="w-6 h-6" /></button>
                    </div>
                  </header>

                  <div className="flex-1 overflow-y-auto p-12 bg-slate-50">
                    {showCodeSnippet ? (
                      <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 animate-in fade-in duration-300">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-indigo-400 font-bold text-xs uppercase tracking-widest">bulk_qr_gen.py (Standalone Utility)</h4>
                          <button onClick={() => navigator.clipboard.writeText(PYTHON_SCRIPT)} className="text-[10px] bg-slate-800 text-slate-400 px-3 py-1 rounded-lg hover:text-white transition-colors">Copy to Clipboard</button>
                        </div>
                        <pre className="text-indigo-300/80 font-mono text-[11px] overflow-x-auto p-4 bg-black/30 rounded-xl">
                          {PYTHON_SCRIPT}
                        </pre>
                      </div>
                    ) : (
                      <div className="space-y-10">
                        <div className="bg-white border-2 border-indigo-100 p-8 rounded-[2.5rem] shadow-sm space-y-6">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex gap-4">
                              <div className="p-3 bg-indigo-50 rounded-2xl h-fit text-indigo-600">
                                <Smartphone className="w-6 h-6" />
                              </div>
                              <div>
                                <h4 className="font-black text-slate-900 flex items-center gap-2 uppercase tracking-wider text-sm">
                                  Local Network Mobile Testing
                                </h4>
                                <p className="text-xs text-slate-500 leading-relaxed mt-1 max-w-lg">
                                  If you are testing on your local network, your phone cannot reach "localhost".
                                  Enter your computer's <strong>Local IP address</strong> below (e.g., http://192.168.1.15:5173).
                                </p>
                              </div>
                            </div>

                            <div className="flex-1 max-w-sm">
                              <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] ml-1">Override Base URL</label>
                                <div className="relative flex items-center">
                                  <div className="absolute left-3 p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
                                    <Settings2 className="w-3 h-3" />
                                  </div>
                                  <input
                                    type="text"
                                    value={testBaseUrl}
                                    onChange={(e) => setTestBaseUrl(e.target.value)}
                                    placeholder="http://192.168.1.XX:5173"
                                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-indigo-100 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-sm"
                                  />
                                  {testBaseUrl !== window.location.origin && (
                                    <button
                                      onClick={() => setTestBaseUrl(window.location.origin)}
                                      className="absolute right-3 p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                                      title="Reset to default"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                            <Info className="w-4 h-4 text-amber-500 shrink-0" />
                            <p className="text-[10px] font-bold text-amber-700 leading-tight">
                              Ensure your phone is on the <strong>same Wi-Fi network</strong> as your computer.
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-8 max-w-4xl mx-auto print:grid print:gap-4">
                          {allRooms.map((room) => {
                            const baseUrl = profileFormData.publicBaseUrl || testBaseUrl || window.location.origin;
                            const qrValue = `${baseUrl}/?room=${room}`;
                            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrValue)}`;

                            return (
                              <div key={room} className="bg-white aspect-square border-2 border-slate-100 rounded-[2.5rem] flex flex-col items-center justify-center p-8 shadow-sm hover:border-indigo-400 transition-all group relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                  <Globe className="w-16 h-16 text-indigo-600" />
                                </div>
                                <div className="w-40 h-40 bg-white rounded-2xl mb-4 flex items-center justify-center relative group-hover:scale-110 transition-transform duration-500">
                                  <img src={qrUrl} alt={`QR Code for Room ${room}`} className="w-full h-full object-contain" />
                                  <div className="absolute inset-0 flex items-center justify-center bg-white/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    <span className="text-[10px] font-black text-slate-900 bg-white px-3 py-1 rounded-full shadow-lg uppercase flex items-center gap-1.5">
                                      <LinkIcon className="w-3 h-3" /> Connect Room {room}
                                    </span>
                                  </div>
                                </div>
                                <h4 className="text-2xl font-black text-slate-900 tabular-nums tracking-tighter">ROOM {room}</h4>
                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1">Scan to Order Menu</p>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 px-2 flex items-center gap-2">
                <History className="w-4 h-4" /> Current Room Type Schema
              </h3>
              {roomTypes.map(rt => (
                <div key={rt.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all group">
                  <div className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                        <Bed className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-slate-900 tracking-tight">{rt.name}</h4>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500"><Bed className="w-3 h-3" /> {rt.totalCapacity} Units</span>
                          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500"><Users className="w-3 h-3" /> Base {rt.baseOccupancy}</span>
                          <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">Rate: ₹{rt.basePrice.toLocaleString()}</span>
                          <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">Extra Bed: ₹{rt.extraBedCharge?.toLocaleString() || 0}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => startEdit(rt)} className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><Edit3 className="w-5 h-5" /></button>
                      <button onClick={() => handleDelete(rt.id, rt.name)} className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 className="w-5 h-5" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      }
    </div >
  );
};

export default PropertySetupPage;
