
import React from 'react';
import { 
  Zap, ShieldCheck, Globe, Database, BrainCircuit, 
  ArrowRight, CheckCircle2, CloudLightning, RefreshCw, 
  Lock, BarChart3, Users, Smartphone, BellRing, Share2,
  ChevronDown, ArrowDown
} from 'lucide-react';

const PitchView: React.FC = () => {
  return (
    <div className="min-h-full bg-slate-50/50 flex flex-col p-6 md:p-12 gap-16 max-w-6xl mx-auto animate-in fade-in duration-700">
      {/* Hero Section */}
      <section className="text-center space-y-6 pt-10">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border border-indigo-100">
          <Zap className="w-3 h-3" />
          The Future of Hospitality Tech
        </div>
        <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-[1.1]">
          Eliminate Overbookings. <br />
          <span className="text-indigo-600">Automate Operations.</span>
        </h1>
        <p className="text-xl text-slate-500 max-w-3xl mx-auto leading-relaxed">
          SyncGuard is a high-performance Property Management System designed for the modern hotelier. We replace manual updates with atomic distribution.
        </p>
      </section>

      {/* Feature Flowchart (Game-like Vertical Flow) */}
      <section className="space-y-12">
        <div className="text-center">
          <h2 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400">The 4-Stage Engine</h2>
          <p className="text-slate-900 font-bold mt-2 text-xl">Interactive Transaction Pipeline</p>
        </div>

        <div className="relative max-w-3xl mx-auto">
          {/* Background Track Line */}
          <div className="absolute top-0 bottom-0 left-1/2 w-4 bg-slate-100 -translate-x-1/2 rounded-full border border-slate-200"></div>

          <div className="flex flex-col gap-0 relative z-10">
            
            {/* Step 1: Booking Arrives */}
            <div className="group relative w-full transform transition-all duration-500 hover:scale-[1.02]">
              <div className="bg-white border-4 border-slate-100 group-hover:border-indigo-500 shadow-2xl rounded-[3rem] p-10 flex flex-col md:flex-row items-center gap-8 relative z-20 transition-colors">
                <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center font-black text-xl border-4 border-slate-50 shadow-lg z-30 hidden md:flex">1</div>
                
                <div className="w-32 h-32 bg-indigo-600 rounded-[2rem] flex items-center justify-center shadow-xl shadow-indigo-200 group-hover:rotate-6 transition-transform shrink-0">
                  <Smartphone className="w-16 h-16 text-white" />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <div className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-black uppercase tracking-widest mb-2">Trigger</div>
                  <h4 className="font-black text-slate-800 text-3xl tracking-tight">Booking Initiated</h4>
                  <p className="text-lg text-slate-500 mt-3 leading-relaxed font-medium">A guest initiates a reservation on an OTA like <strong>Booking.com</strong>. Our webhook listeners capture this signal in <span className="text-indigo-600 font-bold">~200ms</span>.</p>
                </div>
              </div>
            </div>

            {/* Connector 1 */}
            <div className="h-24 flex justify-center items-center relative">
               <div className="w-1 h-full bg-gradient-to-b from-indigo-500 to-emerald-500 animate-pulse"></div>
               <div className="absolute top-1/2 -translate-y-1/2 bg-white border-2 border-indigo-100 p-2 rounded-full shadow-sm z-20">
                 <ArrowDown className="w-6 h-6 text-indigo-400 animate-bounce" />
               </div>
            </div>

            {/* Step 2: Atomic Mutex Lock */}
            <div className="group relative w-full transform transition-all duration-500 hover:scale-[1.02]">
              <div className="bg-white border-4 border-slate-100 group-hover:border-emerald-500 shadow-2xl rounded-[3rem] p-10 flex flex-col md:flex-row items-center gap-8 relative z-20 transition-colors">
                <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center font-black text-xl border-4 border-slate-50 shadow-lg z-30 hidden md:flex">2</div>

                <div className="w-32 h-32 bg-emerald-600 rounded-[2rem] flex items-center justify-center shadow-xl shadow-emerald-200 group-hover:-rotate-6 transition-transform shrink-0">
                  <Lock className="w-16 h-16 text-white" />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <div className="inline-block px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-black uppercase tracking-widest mb-2">Safety Protocol</div>
                  <h4 className="font-black text-slate-800 text-3xl tracking-tight">Atomic Mutex Lock</h4>
                  <p className="text-lg text-slate-500 mt-3 leading-relaxed font-medium">Our engine instantly <span className="text-emerald-600 font-bold">locks the specific room unit</span> globally. Concurrent requests from other channels are queued or rejected to prevent double-booking.</p>
                </div>
              </div>
            </div>

            {/* Connector 2 */}
            <div className="h-24 flex justify-center items-center relative">
               <div className="w-1 h-full bg-gradient-to-b from-emerald-500 to-amber-500 animate-pulse"></div>
               <div className="absolute top-1/2 -translate-y-1/2 bg-white border-2 border-emerald-100 p-2 rounded-full shadow-sm z-20">
                 <ArrowDown className="w-6 h-6 text-emerald-400 animate-bounce" />
               </div>
            </div>

            {/* Step 3: PMS Update */}
            <div className="group relative w-full transform transition-all duration-500 hover:scale-[1.02]">
              <div className="bg-white border-4 border-slate-100 group-hover:border-amber-500 shadow-2xl rounded-[3rem] p-10 flex flex-col md:flex-row items-center gap-8 relative z-20 transition-colors">
                <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-12 h-12 bg-amber-500 text-white rounded-full flex items-center justify-center font-black text-xl border-4 border-slate-50 shadow-lg z-30 hidden md:flex">3</div>

                <div className="w-32 h-32 bg-amber-500 rounded-[2rem] flex items-center justify-center shadow-xl shadow-amber-200 group-hover:scale-110 transition-transform shrink-0">
                  <Database className="w-16 h-16 text-white" />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <div className="inline-block px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-black uppercase tracking-widest mb-2">Persist</div>
                  <h4 className="font-black text-slate-800 text-3xl tracking-tight">Ledger Update</h4>
                  <p className="text-lg text-slate-500 mt-3 leading-relaxed font-medium">The transaction is written to the immutable ledger. The reservation appears on your <strong>Front Desk</strong> dashboard immediately with a "Confirmed" status.</p>
                </div>
              </div>
            </div>

            {/* Connector 3 */}
            <div className="h-24 flex justify-center items-center relative">
               <div className="w-1 h-full bg-gradient-to-b from-amber-500 to-fuchsia-500 animate-pulse"></div>
               <div className="absolute top-1/2 -translate-y-1/2 bg-white border-2 border-amber-100 p-2 rounded-full shadow-sm z-20">
                 <ArrowDown className="w-6 h-6 text-amber-400 animate-bounce" />
               </div>
            </div>

            {/* Step 4: Distribution */}
            <div className="group relative w-full transform transition-all duration-500 hover:scale-[1.02]">
              <div className="bg-white border-4 border-slate-100 group-hover:border-fuchsia-600 shadow-2xl rounded-[3rem] p-10 flex flex-col md:flex-row items-center gap-8 relative z-20 transition-colors">
                <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-12 h-12 bg-fuchsia-600 text-white rounded-full flex items-center justify-center font-black text-xl border-4 border-slate-50 shadow-lg z-30 hidden md:flex">4</div>

                <div className="w-32 h-32 bg-fuchsia-600 rounded-[2rem] flex items-center justify-center shadow-xl shadow-fuchsia-200 group-hover:rotate-180 transition-transform duration-700 shrink-0">
                  <Share2 className="w-16 h-16 text-white" />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <div className="inline-block px-3 py-1 bg-fuchsia-100 text-fuchsia-700 rounded-lg text-xs font-black uppercase tracking-widest mb-2">Fan-Out</div>
                  <h4 className="font-black text-slate-800 text-3xl tracking-tight">Global Inventory Sync</h4>
                  <p className="text-lg text-slate-500 mt-3 leading-relaxed font-medium">Updated availability is pushed to <strong>Expedia, Agoda, & Airbnb</strong> simultaneously. The entire web is synchronized in milliseconds.</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Value Propositions Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
        {[
          {
            icon: BarChart3,
            title: "Yield Maximization",
            desc: "Don't just fill rooms. Sell them at the highest possible price using AI-driven demand forecasting.",
            color: "indigo"
          },
          {
            icon: RefreshCw,
            title: "Self-Healing Sync",
            desc: "If an OTA node fails, our system retries with exponential backoff until global consistency is restored.",
            color: "emerald"
          },
          {
            icon: Users,
            title: "Voice Concierge",
            desc: "Allow your staff to query occupancy and status using natural voice commands via Gemini Live.",
            color: "fuchsia"
          }
        ].map((prop, i) => (
          <div key={i} className="bg-white p-8 rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">
            <div className={`p-4 bg-${prop.color}-50 text-${prop.color}-600 rounded-2xl w-fit mb-6`}>
              <prop.icon className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-3 tracking-tight">{prop.title}</h3>
            <p className="text-slate-500 text-sm leading-relaxed">{prop.desc}</p>
          </div>
        ))}
      </section>

      {/* CTA Footer */}
      <footer className="bg-slate-900 rounded-[3rem] p-12 text-center space-y-6 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl"></div>
        
        <h3 className="text-3xl font-black text-white tracking-tight leading-tight">
          Ready to Upgrade Your <br />
          <span className="text-indigo-400">Distribution Strategy?</span>
        </h3>
        <p className="text-slate-400 max-w-xl mx-auto text-sm">Join 500+ properties using SyncGuard to protect their revenue and automate their future.</p>
        
        <button className="flex items-center gap-3 bg-white text-slate-900 px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-50 hover:scale-105 transition-all mx-auto shadow-2xl">
          Get Started Now
          <ArrowRight className="w-4 h-4" />
        </button>
      </footer>
    </div>
  );
};

export default PitchView;
