
import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, Users, IndianRupee, Activity, 
  Mic, MicOff, Sparkles, AlertCircle, ArrowUpRight, 
  Target, BarChart3, Bot, Waves
} from 'lucide-react';
import { AnalyticsData, Hotel } from '../types';

interface IntelligenceViewProps {
  hotel: Hotel;
}

const IntelligenceView: React.FC<IntelligenceViewProps> = ({ hotel }) => {
  const [isListening, setIsListening] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    occupancyRate: 78.4,
    revPar: 9800,
    adr: 12500,
    totalRevenue: 4589000,
  });

  const toggleVoice = () => {
    setIsListening(!isListening);
    if (!isListening) {
      setAiResponse(null);
      // Simulate Gemini Live API response
      setTimeout(() => {
        setIsListening(false);
        setAiResponse(`Current occupancy for ${hotel.name} is at 78.4%. Booking.com has 3 pending syncs. I recommend increasing the Deluxe Suite rate by 12% for the upcoming weekend peak to capitalize on high demand.`);
      }, 3000);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 bg-[#fbfcfd]">
      <header className="flex justify-between items-end relative z-10">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">SyncGuard Intelligence</h2>
          <p className="text-slate-500">Real-time revenue metrics and AI-assisted operations for {hotel.name}.</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-2xl border border-slate-200/60 shadow-sm flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Live Prediction Engine</span>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
        {[
          { label: 'Occupancy Rate', value: `${analytics.occupancyRate}%`, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', trend: '+4.2%' },
          { label: 'RevPAR', value: `₹${analytics.revPar.toLocaleString()}`, icon: Target, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: '+12.1%' },
          { label: 'Average Daily Rate', value: `₹${analytics.adr.toLocaleString()}`, icon: IndianRupee, color: 'text-indigo-600', bg: 'bg-indigo-50', trend: '+2.5%' },
          { label: 'Total Revenue', value: `₹${(analytics.totalRevenue / 100000).toFixed(1)}L`, icon: BarChart3, color: 'text-fuchsia-600', bg: 'bg-fuchsia-50', trend: '+18.4%' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-2xl ${kpi.bg} ${kpi.color} group-hover:scale-110 transition-transform`}>
                <kpi.icon className="w-6 h-6" />
              </div>
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                <ArrowUpRight className="w-3 h-3" />
                {kpi.trend}
              </span>
            </div>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">{kpi.label}</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{kpi.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
        {/* Voice Concierge Simulation */}
        <div className="lg:col-span-2 bg-slate-800 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[400px] border border-slate-700/30">
          <div className="relative z-10 flex justify-between items-start">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-fuchsia-400 font-bold text-sm uppercase tracking-widest">
                <Sparkles className="w-4 h-4" />
                Gemini Live Concierge
              </div>
              <h3 className="text-3xl font-bold text-white">How can I assist you today?</h3>
            </div>
          </div>

          <div className="relative z-10 flex-1 flex flex-col items-center justify-center py-12">
            {isListening ? (
              <div className="flex items-center gap-1 h-12">
                {[...Array(12)].map((_, i) => (
                  <div 
                    key={i} 
                    className="w-1.5 bg-fuchsia-500 rounded-full animate-bounce"
                    style={{ 
                      height: `${Math.random() * 100}%`,
                      animationDelay: `${i * 0.05}s`,
                      animationDuration: '0.6s'
                    }}
                  ></div>
                ))}
              </div>
            ) : aiResponse ? (
              <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl max-w-md animate-in zoom-in duration-300">
                <p className="text-indigo-100 text-sm leading-relaxed italic">
                  "{aiResponse}"
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-slate-700/50 rounded-full">
                  <Bot className="w-12 h-12 text-slate-600" />
                </div>
                <p className="text-slate-500 text-sm font-medium">Click the microphone to start voice briefing for {hotel.name}</p>
              </div>
            )}
          </div>

          <div className="relative z-10 flex justify-center">
            <button 
              onClick={toggleVoice}
              className={`
                group relative p-6 rounded-full transition-all duration-500 shadow-2xl
                ${isListening ? 'bg-red-500 scale-110' : 'bg-indigo-600 hover:bg-indigo-500'}
              `}
            >
              <div className={`absolute inset-0 rounded-full bg-current opacity-20 ${isListening ? 'animate-ping' : ''}`}></div>
              {isListening ? <MicOff className="w-8 h-8 text-white" /> : <Mic className="w-8 h-8 text-white" />}
            </button>
          </div>
        </div>

        {/* Operational Alerts */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200/60 p-8 shadow-sm flex flex-col">
          <h3 className="font-bold text-slate-900 text-lg mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600" />
            Strategic Insights
          </h3>
          
          <div className="space-y-6 flex-1">
            {[
              { 
                title: 'High Occupancy Alert', 
                desc: 'Saturday is trending at 98%. Lock remaining direct inventory.',
                type: 'warning',
                icon: AlertCircle,
                color: 'text-amber-600',
                bg: 'bg-amber-50'
              },
              { 
                title: 'Channel Lag Detected', 
                desc: 'Expedia API latency is 40% higher than average. Monitoring fan-out.',
                type: 'error',
                icon: Activity,
                color: 'text-red-600',
                bg: 'bg-red-50'
              },
              { 
                title: 'Yield Opportunity', 
                desc: 'Local event detected: Cultural Festival. Increase rates by ₹1,500.',
                type: 'success',
                icon: TrendingUp,
                color: 'text-emerald-600',
                bg: 'bg-emerald-50'
              }
            ].map((alert, i) => (
              <div key={i} className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group">
                <div className={`p-3 rounded-xl ${alert.bg} ${alert.color} h-fit`}>
                  <alert.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">{alert.title}</p>
                  <p className="text-xs text-slate-500 leading-relaxed mt-1">{alert.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <button className="w-full mt-8 py-4 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-xs uppercase tracking-widest rounded-2xl transition-all border border-slate-200/60">
            Export Forecast Report
          </button>
        </div>
      </div>
    </div>
  );
};

export default IntelligenceView;
