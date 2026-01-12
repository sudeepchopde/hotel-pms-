
import React, { useState } from 'react';
import { 
  ShieldCheck, Globe, Eye, EyeOff, Loader2, 
  CheckCircle2, XCircle, Save, Info, Key, ExternalLink,
  Plus, Search, Filter, Sparkles, Power, TrendingUp, Percent, IndianRupee,
  Hand, ShieldAlert, ZapOff
} from 'lucide-react';
import { OTAConnection, RoomType } from '../types';
import OTAConnectionWizard from './OTAConnectionWizard';

const MARKETPLACE_OTAS = [
  { id: 'mmt', name: 'MakeMyTrip', category: 'OTA / Direct' },
  { id: 'booking', name: 'Booking.com', category: 'Global OTA' },
  { id: 'expedia', name: 'Expedia', category: 'Global OTA' },
  { id: 'agoda', name: 'Agoda', category: 'Global OTA' },
  { id: 'airbnb', name: 'Airbnb', category: 'Short-term Rental' },
  { id: 'tripadvisor', name: 'TripAdvisor', category: 'Reviews & Meta' },
  { id: 'hostelworld', name: 'Hostelworld', category: 'Specialized' },
];

// Added missing baseOccupancy and amenities properties to match the RoomType interface
const MOCK_ROOM_TYPES: RoomType[] = [
  { id: 'rt-1', name: 'Delux Room (AC)', totalCapacity: 10, basePrice: 4500, floorPrice: 3000, ceilingPrice: 8000, baseOccupancy: 2, amenities: ['WiFi', 'AC', 'TV'] },
  { id: 'rt-2', name: 'Double Bed Room', totalCapacity: 10, basePrice: 2800, floorPrice: 1800, ceilingPrice: 5000, baseOccupancy: 2, amenities: ['WiFi', 'Fan'] },
  { id: 'rt-3', name: 'Single Bed Room', totalCapacity: 10, basePrice: 1800, floorPrice: 1200, ceilingPrice: 3000, baseOccupancy: 1, amenities: ['WiFi'] },
  { id: 'rt-4', name: 'Dormitory', totalCapacity: 3, basePrice: 1200, floorPrice: 800, ceilingPrice: 2500, baseOccupancy: 1, amenities: ['WiFi', 'Locker'] },
];

interface SettingsPageProps {
  connections: OTAConnection[];
  setConnections: React.Dispatch<React.SetStateAction<OTAConnection[]>>;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ connections, setConnections }) => {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [activeWizardOta, setActiveWizardOta] = useState<string | null>(null);

  const toggleVisibility = (id: string) => {
    setConnections(prev => prev.map(c => 
      c.id === id ? { ...c, isVisible: !c.isVisible } : c
    ));
  };

  const toggleStopSell = (id: string) => {
    setConnections(prev => prev.map(c => 
      c.id === id ? { ...c, isStopped: !c.isStopped } : c
    ));
  };

  const updateMarkup = (id: string, type: 'percentage' | 'fixed', value: number) => {
    setConnections(prev => prev.map(c => 
      c.id === id ? { ...c, markupType: type, markupValue: value } : c
    ));
  };

  const handleConnect = async (id: string, customKey?: string) => {
    if (!customKey) {
      setActiveWizardOta(id);
      return;
    }

    setLoadingId(id);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (customKey) {
      const otaTemplate = MARKETPLACE_OTAS.find(o => o.id === id);
      if (otaTemplate) {
        const newConn: OTAConnection = {
          id: otaTemplate.id,
          name: otaTemplate.name,
          key: customKey.startsWith('••••') ? customKey : `••••••••${customKey.slice(-4)}`,
          isVisible: false,
          status: 'connected',
          lastValidated: 'Just now',
          markupType: 'percentage',
          markupValue: 0,
          isStopped: false
        };
        setConnections(prev => {
          if (prev.some(c => c.id === id)) {
            return prev.map(c => c.id === id ? newConn : c);
          }
          return [...prev, newConn];
        });
        setShowMarketplace(false);
      }
    }
    setLoadingId(null);
  };

  const handleDisconnect = (id: string) => {
    setConnections(prev => prev.map(c => 
      c.id === id ? { ...c, status: 'disconnected', key: '', lastValidated: undefined } : c
    ));
  };

  const onWizardSuccess = (generatedKey: string) => {
    if (activeWizardOta) {
      handleConnect(activeWizardOta, generatedKey);
      setActiveWizardOta(null);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-10 animate-in fade-in duration-500 pb-24">
      {activeWizardOta && (
        <OTAConnectionWizard 
          otaId={activeWizardOta}
          roomTypes={MOCK_ROOM_TYPES}
          onClose={() => setActiveWizardOta(null)}
          onSuccess={onWizardSuccess}
        />
      )}

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Channel Connections</h2>
          <p className="text-slate-500">Securely manage your distribution network and API credentials.</p>
        </div>
        <button 
          onClick={() => setShowMarketplace(!showMarketplace)}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-xl shadow-indigo-100 ${
            showMarketplace ? 'bg-slate-200 text-slate-700' : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-105 active:scale-95'
          }`}
        >
          {showMarketplace ? <XCircle className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showMarketplace ? 'Close Catalog' : 'Add New Channel'}
        </button>
      </header>

      {showMarketplace && (
        <section className="bg-slate-800 rounded-[2.5rem] p-8 shadow-2xl border border-slate-700/50 animate-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 rounded-xl">
                <Sparkles className="w-5 h-5 text-indigo-300" />
              </div>
              <h3 className="text-xl font-bold text-white">Marketplace</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {MARKETPLACE_OTAS.map(ota => {
              const isActive = connections.some(c => c.id === ota.id && c.status === 'connected');
              return (
                <div key={ota.id} className={`p-6 rounded-3xl border transition-all ${
                  isActive ? 'bg-slate-700/30 border-slate-600/50 opacity-50' : 'bg-slate-700 border-slate-600/50 hover:border-indigo-400/50 group cursor-pointer shadow-sm'
                }`}>
                  <div className="w-12 h-12 bg-slate-600 rounded-2xl mb-4 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Globe className="w-6 h-6 text-indigo-300" />
                  </div>
                  <h4 className="font-bold text-white mb-1">{ota.name}</h4>
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-4">{ota.category}</p>
                  {!isActive && (
                    <button 
                      onClick={() => handleConnect(ota.id)}
                      className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      Launch Guide
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid gap-8">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 px-2">Active Property Network</h3>
        {connections.map((ota) => (
          <div key={ota.id} className={`bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden transition-all hover:shadow-md ${ota.isStopped ? 'ring-2 ring-amber-400/50 bg-amber-50/10' : ''}`}>
            <div className="p-8 flex flex-col gap-8">
              <div className="flex flex-col md:flex-row md:items-center gap-8 border-b border-slate-100 pb-8">
                <div className="md:w-48 flex-shrink-0 flex items-center gap-4">
                  <div className={`p-4 rounded-2xl transition-colors ${
                    ota.isStopped ? 'bg-amber-100 text-amber-600' :
                    ota.status === 'connected' ? 'bg-indigo-50/50 text-indigo-600' : 'bg-slate-50 text-slate-400'
                  }`}>
                    {ota.isStopped ? <ShieldAlert className="w-6 h-6" /> : <Globe className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{ota.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className={`w-2 h-2 rounded-full ${ota.isStopped ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]' : ota.status === 'connected' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]' : 'bg-slate-300'}`}></div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {ota.isStopped ? 'STOPPED' : ota.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Key className="w-3 h-3 text-indigo-400" /> Secure Token
                  </label>
                  <div className="relative">
                    <input
                      type={ota.isVisible ? "text" : "password"}
                      value={ota.key}
                      readOnly
                      className="w-full bg-slate-50/50 border border-slate-200/60 rounded-xl px-4 py-3.5 pr-12 font-mono text-sm text-slate-600 outline-none"
                    />
                    <button 
                      onClick={() => toggleVisibility(ota.id)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-indigo-500 transition-colors"
                    >
                      {ota.isVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="md:w-40 flex flex-col gap-2">
                  <button
                    onClick={() => handleConnect(ota.id)}
                    disabled={loadingId !== null}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-800 text-white hover:bg-slate-900 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg"
                  >
                    {loadingId === ota.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    {ota.status === 'connected' ? 'Update' : 'Activate'}
                  </button>
                  
                  {ota.status === 'connected' && (
                    <button 
                      onClick={() => toggleStopSell(ota.id)}
                      className={`w-full py-2.5 font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 border shadow-sm ${
                        ota.isStopped 
                        ? 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600' 
                        : 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100'
                      }`}
                    >
                      {ota.isStopped ? <CheckCircle2 className="w-3 h-3" /> : <Hand className="w-3 h-3" />}
                      {ota.isStopped ? 'Resume Sales' : 'STOP SELL'}
                    </button>
                  )}
                </div>
              </div>

              {ota.status === 'connected' && !ota.isStopped && (
                <div className="bg-indigo-50/30 border border-indigo-100/50 rounded-3xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 animate-in slide-in-from-top-2">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white rounded-2xl shadow-sm text-indigo-500">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 tracking-tight uppercase">Strategic Channel Markup</h4>
                      <p className="text-xs text-slate-500">Adjust price sent to {ota.name} to cover commission costs.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                      <button 
                        onClick={() => updateMarkup(ota.id, 'percentage', ota.markupValue || 0)}
                        className={`p-2 rounded-lg transition-all ${ota.markupType === 'percentage' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <Percent className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => updateMarkup(ota.id, 'fixed', ota.markupValue || 0)}
                        className={`p-2 rounded-lg transition-all ${ota.markupType === 'fixed' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <IndianRupee className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                      <span className="text-xs font-black text-slate-400">
                        {ota.markupType === 'fixed' ? '₹' : '+'}
                      </span>
                      <input 
                        type="number"
                        value={ota.markupValue || 0}
                        onChange={(e) => updateMarkup(ota.id, ota.markupType || 'percentage', Number(e.target.value))}
                        className="w-16 bg-transparent text-sm font-black text-slate-900 outline-none text-center"
                        placeholder="0"
                      />
                      {ota.markupType === 'percentage' && <span className="text-xs font-black text-slate-400">%</span>}
                    </div>

                    <div className="text-[10px] font-bold text-indigo-600 bg-indigo-100/50 px-3 py-2 rounded-xl border border-indigo-200/50">
                      Sample: ₹1,000 → ₹{
                        ota.markupType === 'percentage' 
                        ? Math.round(1000 * (1 + (ota.markupValue || 0)/100))
                        : 1000 + (ota.markupValue || 0)
                      }
                    </div>
                  </div>
                </div>
              )}

              {ota.isStopped && (
                <div className="bg-amber-100/30 border border-amber-200 rounded-3xl p-6 flex items-center gap-6 animate-in slide-in-from-top-2">
                  <div className="p-3 bg-white rounded-2xl shadow-sm text-amber-500">
                    <ZapOff className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-amber-900 uppercase">Sales Circuit Breaker Active</h4>
                    <p className="text-xs text-amber-700/80 mt-1">
                      No inventory or rates are being pushed to {ota.name}. All incoming booking requests from this source will be ignored or rejected by the gateway.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-amber-50/50 border border-amber-100/60 rounded-[2rem] p-8 flex gap-6">
        <div className="p-3 bg-amber-100/50 rounded-2xl shrink-0 h-fit">
          <Info className="w-6 h-6 text-amber-600" />
        </div>
        <div className="space-y-2">
          <p className="font-bold text-amber-900">Isolation Layer Notice</p>
          <p className="text-sm text-amber-700/80 leading-relaxed">
            New OTA connections utilize **KDF isolation**. Tokens are encrypted with unique salts, ensuring that channel breaches never propagate. Background health checks run every 15 mins.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
