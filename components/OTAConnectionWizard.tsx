
import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, ChevronRight, Key, Globe, 
  Loader2, ExternalLink, ShieldCheck, 
  ArrowRight, Info, Building, ListTree, Rocket,
  X, AlertCircle, RefreshCw, Link as LinkIcon, ServerCrash,
  MapPin, Home, Star, Compass, Briefcase, Plane
} from 'lucide-react';
import { RoomType } from '../types';

interface ConnectionWizardProps {
  otaId: string; // New prop to identify the channel
  onClose: () => void;
  onSuccess: (key: string) => void;
  roomTypes: RoomType[];
}

type WizardStep = 'authorize' | 'mapping' | 'golive';

interface ExternalRoom {
  external_id: string;
  name: string;
  max_occupancy: number;
}

interface OtaConfig {
  name: string;
  color: string;
  bgColor: string;
  icon: React.ElementType;
  guideSteps: string[];
  inputs: {
    label: string;
    placeholder: string;
    key: 'propertyId' | 'apiToken' | 'baseRatePlanId';
    type?: string;
  }[];
  mockRooms: ExternalRoom[];
}

// Dynamic Configuration for each OTA
const OTA_CONFIGS: Record<string, OtaConfig> = {
  mmt: {
    name: 'MakeMyTrip',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    icon: Globe,
    guideSteps: [
      "Log in to your MMT Connect extranet portal.",
      "Navigate to 'Channel Manager' in the sidebar menu.",
      "Select 'SyncGuard PMS' from the provider list.",
      "Copy your Property ID and generate a new API Token."
    ],
    inputs: [
      { label: 'MMT Property ID', placeholder: 'e.g. MMT-123456', key: 'propertyId' },
      { label: 'API Token', placeholder: '••••••••••••', key: 'apiToken', type: 'password' },
      { label: 'Base Rate Plan ID', placeholder: 'e.g. RP-99', key: 'baseRatePlanId' }
    ],
    mockRooms: [
      { external_id: 'mmt_dlx_01', name: 'Super Deluxe King', max_occupancy: 2 },
      { external_id: 'mmt_ste_09', name: 'Presidential Suite', max_occupancy: 4 },
      { external_id: 'mmt_std_04', name: 'Budget Single', max_occupancy: 1 }
    ]
  },
  booking: {
    name: 'Booking.com',
    color: 'text-blue-800',
    bgColor: 'bg-blue-50',
    icon: Briefcase,
    guideSteps: [
      "Log in to admin.booking.com extranet.",
      "Go to Account > Connectivity Provider.",
      "Search for 'SyncGuard PMS' and click Connect.",
      "Copy your Legal Entity ID (LEID) or Hotel ID."
    ],
    inputs: [
      { label: 'Hotel ID', placeholder: 'e.g. 1234567', key: 'propertyId' },
      { label: 'Machine Account Key', placeholder: '••••••••••••', key: 'apiToken', type: 'password' }
    ],
    mockRooms: [
       { external_id: 'bcom_deluxe', name: 'Deluxe Double Room', max_occupancy: 2 },
       { external_id: 'bcom_suite', name: 'Executive Suite', max_occupancy: 3 },
       { external_id: 'bcom_twin', name: 'Standard Twin', max_occupancy: 2 }
    ]
  },
  expedia: {
    name: 'Expedia',
    color: 'text-amber-500',
    bgColor: 'bg-amber-50',
    icon: Plane,
    guideSteps: [
      "Log in to Expedia Partner Central (EPC).",
      "Navigate to Rooms and Rates > Connectivity Settings.",
      "Select 'SyncGuard PMS' from the system list.",
      "Authorize the connection to generate EQC credentials."
    ],
    inputs: [
      { label: 'Expedia Hotel ID', placeholder: 'e.g. 556677', key: 'propertyId' },
      { label: 'EQC Username/Token', placeholder: '••••••••••••', key: 'apiToken', type: 'password' }
    ],
    mockRooms: [
       { external_id: 'exp_std', name: 'Standard Room', max_occupancy: 2 },
       { external_id: 'exp_king', name: 'King Room with View', max_occupancy: 2 }
    ]
  },
  agoda: {
    name: 'Agoda',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    icon: MapPin,
    guideSteps: [
      "Login to Agoda YCS (Yield Control System).",
      "Go to Settings > Connectivity Provider.",
      "Search for 'SyncGuard' and click Enable.",
      "Copy the 'Hotel ID' and 'API Key' shown on screen."
    ],
    inputs: [
      { label: 'Agoda Hotel ID', placeholder: 'e.g. 987654', key: 'propertyId' },
      { label: 'YCS API Key', placeholder: '••••••••••••', key: 'apiToken', type: 'password' }
    ],
    mockRooms: [
      { external_id: 'ago_std_tw', name: 'Standard Twin Room', max_occupancy: 2 },
      { external_id: 'ago_fam_qn', name: 'Family Queen Studio', max_occupancy: 3 }
    ]
  },
  airbnb: {
    name: 'Airbnb',
    color: 'text-rose-500',
    bgColor: 'bg-rose-50',
    icon: Home,
    guideSteps: [
      "Go to Hosting Dashboard > Profile > Privacy & Sharing.",
      "Select 'Services' and Create New Token.",
      "Grant 'Availability' and 'Pricing' permissions.",
      "Paste the User ID and Token below."
    ],
    inputs: [
      { label: 'Host ID', placeholder: 'e.g. 55001122', key: 'propertyId' },
      { label: 'Personal Access Token', placeholder: 'shpat_••••••••', key: 'apiToken', type: 'password' }
    ],
    mockRooms: [
      { external_id: 'abnb_ent_home', name: 'Entire Villa - Oceanview', max_occupancy: 6 },
      { external_id: 'abnb_pvt_room', name: 'Private Room in Cottage', max_occupancy: 2 }
    ]
  },
  tripadvisor: {
    name: 'TripAdvisor',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    icon: Star,
    guideSteps: [
      "Access TripAdvisor Management Center.",
      "Click 'Connectivity' tab.",
      "Authorize 'SyncGuard' as your partner.",
      "Enter your Partner ID below."
    ],
    inputs: [
      { label: 'Partner ID', placeholder: 'e.g. TA-8822', key: 'propertyId' },
      { label: 'Shared Secret', placeholder: '••••••••••••', key: 'apiToken', type: 'password' }
    ],
    mockRooms: [
      { external_id: 'ta_kng_ste', name: 'King Suite with Balcony', max_occupancy: 2 }
    ]
  },
  hostelworld: {
    name: 'Hostelworld',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    icon: Compass,
    guideSteps: [
      "Login to Hostelworld Inbox.",
      "Go to Property Setup > Channel Manager.",
      "Generate XML Connection Password.",
      "Use your Hostel Number as Property ID."
    ],
    inputs: [
      { label: 'Hostel Number', placeholder: 'e.g. 112233', key: 'propertyId' },
      { label: 'XML Password', placeholder: '••••••••••••', key: 'apiToken', type: 'password' }
    ],
    mockRooms: [
      { external_id: 'hw_dm_8', name: '8 Bed Mixed Dorm', max_occupancy: 1 },
      { external_id: 'hw_dm_4_fem', name: '4 Bed Female Dorm', max_occupancy: 1 }
    ]
  }
};

const OTAConnectionWizard: React.FC<ConnectionWizardProps> = ({ otaId, onClose, onSuccess, roomTypes }) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('authorize');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  // Resolve Configuration
  const config = OTA_CONFIGS[otaId] || OTA_CONFIGS['mmt'];
  const ConfigIcon = config.icon;

  // Mapping State
  const [isFetchingRooms, setIsFetchingRooms] = useState(false);
  const [otaRooms, setOtaRooms] = useState<ExternalRoom[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Record<string, string>>({
    propertyId: '',
    apiToken: '',
    baseRatePlanId: ''
  });

  const [mapping, setMapping] = useState<Record<string, string>>({});

  const handleVerify = async () => {
    setIsVerifying(true);
    setVerificationStatus('idle');
    // Simulate API Handshake
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    if (formData.propertyId && formData.apiToken) {
      setVerificationStatus('success');
      setTimeout(() => setCurrentStep('mapping'), 800);
    } else {
      setVerificationStatus('error');
    }
    setIsVerifying(false);
  };

  const fetchOtaRooms = async () => {
    setIsFetchingRooms(true);
    setFetchError(null);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setOtaRooms(config.mockRooms);
    setIsFetchingRooms(false);
  };

  useEffect(() => {
    if (currentStep === 'mapping' && otaRooms.length === 0) {
      fetchOtaRooms();
    }
  }, [currentStep]);

  const handleMappingSubmit = () => {
    setCurrentStep('golive');
  };

  const handleFinish = () => {
    onSuccess(`${otaId}_live_${formData.propertyId.slice(-4)}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row h-[600px] animate-in zoom-in-95 duration-300">
        
        {/* Left Side: Progress & Guide */}
        <div className="md:w-72 bg-slate-50 border-r border-slate-200 p-8 flex flex-col">
          <div className="flex items-center gap-3 mb-10">
            <div className={`p-2 rounded-xl ${config.bgColor} ${config.color}`}>
              <ConfigIcon className="w-6 h-6" />
            </div>
            <h3 className="font-black text-slate-900 tracking-tight leading-tight">{config.name}</h3>
          </div>

          <nav className="space-y-6 flex-1">
            {[
              { id: 'authorize', label: 'Authorize', icon: Key },
              { id: 'mapping', label: 'Map Rooms', icon: ListTree },
              { id: 'golive', label: 'Go Live', icon: Rocket },
            ].map((s, i) => {
              const active = currentStep === s.id;
              const done = (currentStep === 'mapping' && i === 0) || (currentStep === 'golive' && i < 2);
              return (
                <div key={s.id} className={`flex items-center gap-4 transition-all ${active ? 'opacity-100 scale-105' : 'opacity-40'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                    done ? 'bg-emerald-500 text-white' : active ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className={`text-sm font-black uppercase tracking-widest ${active ? 'text-indigo-600' : 'text-slate-500'}`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </nav>

          <div className="mt-auto bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
            <p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2 mb-2">
              <ShieldCheck className="w-3 h-3" /> Security Note
            </p>
            <p className="text-[10px] text-indigo-600/70 leading-relaxed">
              SyncGuard uses AES-256 vault encryption for all OTA credentials. Keys are never logged.
            </p>
          </div>
        </div>

        {/* Right Side: Content */}
        <div className="flex-1 flex flex-col relative overflow-hidden bg-white">
          <button 
            onClick={onClose}
            className="absolute top-6 right-8 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all z-10"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex-1 overflow-y-auto p-12">
            {currentStep === 'authorize' && (
              <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                <header>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Step 1: Authorization</h2>
                  <p className="text-slate-500 text-sm mt-1">Configure your {config.name} credentials to begin synchronization.</p>
                </header>

                <div className="space-y-3">
                  {config.guideSteps.map((step, i) => (
                    <div key={i} className="flex gap-4 items-start p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                      <span className="text-[10px] font-black text-slate-400 mt-1">{i + 1}.</span>
                      <p className="text-xs text-slate-600 font-medium group-hover:text-slate-900 transition-colors">{step}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-5 pt-4">
                  {config.inputs.map((input) => (
                    <div key={input.key} className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        {input.key === 'propertyId' ? <Building className="w-3 h-3" /> : <Key className="w-3 h-3" />}
                        {input.label}
                      </label>
                      <input 
                        type={input.type || 'text'}
                        placeholder={input.placeholder}
                        value={formData[input.key] || ''}
                        onChange={e => setFormData({...formData, [input.key]: e.target.value})}
                        className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                  ))}
                </div>

                {verificationStatus === 'error' && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex gap-3 text-red-600 animate-in shake duration-300">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="text-xs font-bold">Handshake failed. Please verify credentials.</p>
                  </div>
                )}

                <button 
                  onClick={handleVerify}
                  disabled={isVerifying || !formData.propertyId || !formData.apiToken}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-indigo-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isVerifying ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify Connection'}
                  {!isVerifying && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            )}

            {currentStep === 'mapping' && (
              <div className="space-y-8 animate-in slide-in-from-right-4 duration-300 h-full flex flex-col">
                <header className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Step 2: Room Mapping</h2>
                    <p className="text-slate-500 text-sm mt-1">Link external {config.name} rooms to your internal inventory.</p>
                  </div>
                  <button 
                    onClick={fetchOtaRooms}
                    disabled={isFetchingRooms}
                    className="p-3 bg-slate-50 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-slate-200 hover:border-indigo-200"
                    title="Refresh OTA Rooms"
                  >
                    <RefreshCw className={`w-5 h-5 ${isFetchingRooms ? 'animate-spin' : ''}`} />
                  </button>
                </header>

                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                  {isFetchingRooms ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-4 text-slate-400">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                      <p className="text-xs font-bold uppercase tracking-widest">Fetching {config.name} Configuration...</p>
                    </div>
                  ) : fetchError ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-4 text-red-400">
                      <ServerCrash className="w-10 h-10" />
                      <p className="text-xs font-bold">Failed to load rooms. Check API connection.</p>
                      <button onClick={fetchOtaRooms} className="text-xs underline hover:text-red-500">Try Again</button>
                    </div>
                  ) : otaRooms.length === 0 ? (
                    <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400">
                      <p>No rooms found on {config.name}.</p>
                    </div>
                  ) : (
                    otaRooms.map(otaRoom => (
                      <div key={otaRoom.external_id} className="group relative bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all hover:border-indigo-200">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center justify-center w-8 h-8 bg-slate-50 rounded-full border border-slate-100 z-10 text-slate-300">
                          <LinkIcon className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
                          <div className="flex-1 p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] font-black uppercase rounded tracking-wider">External</span>
                              <span className="text-[10px] text-slate-400 font-mono">{otaRoom.external_id}</span>
                            </div>
                            <p className="font-bold text-slate-800 text-sm">{otaRoom.name}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">Max Occupancy: {otaRoom.max_occupancy}</p>
                          </div>
                          <div className="flex-1">
                            <select 
                              className={`
                                w-full px-4 py-3 bg-white border-2 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 transition-all
                                ${mapping[otaRoom.external_id] ? 'border-emerald-200 bg-emerald-50/10' : 'border-slate-200'}
                              `}
                              value={mapping[otaRoom.external_id] || ''}
                              onChange={e => setMapping(prev => ({...prev, [otaRoom.external_id]: e.target.value}))}
                            >
                              <option value="">-- Link to PMS Room --</option>
                              {roomTypes.map(rt => (
                                <option key={rt.id} value={rt.id}>
                                  {rt.name} (Cap: {rt.totalCapacity})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <button 
                    onClick={handleMappingSubmit}
                    disabled={Object.keys(mapping).length === 0}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-indigo-100 transition-all disabled:opacity-50 disabled:shadow-none"
                  >
                    Confirm & Sync
                  </button>
                </div>
              </div>
            )}

            {currentStep === 'golive' && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-6 animate-in zoom-in duration-500">
                <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                  <Rocket className="w-12 h-12 text-emerald-600 animate-bounce" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Ready to Sync</h2>
                  <p className="text-slate-500 text-sm mt-2 max-w-sm">
                    {config.name} connection successfully authorized. Inventory and rate pushes will begin immediately.
                  </p>
                </div>
                
                <div className="w-full bg-slate-50 border border-slate-100 p-6 rounded-3xl grid grid-cols-2 gap-4 text-left">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase">Property ID</p>
                    <p className="text-sm font-bold text-slate-800">{formData.propertyId}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase">Rate Sync</p>
                    <p className="text-sm font-bold text-emerald-600">Active</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase">Rooms Mapped</p>
                    <p className="text-sm font-bold text-indigo-600">{Object.keys(mapping).length}</p>
                  </div>
                </div>

                <button 
                  onClick={handleFinish}
                  className="w-full py-4 bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl transition-all"
                >
                  Launch Connection
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OTAConnectionWizard;
