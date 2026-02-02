import React, { useState, useEffect, useMemo } from 'react';
import {
    ChefHat, Clock, CheckCircle2, AlertCircle, RefreshCw,
    Leaf, Utensils, Hash, StickyNote, Volume2, VolumeX,
    Flame, History, Filter, XCircle, Coffee, Bed, Zap, ArrowRight,
    PlayCircle
} from 'lucide-react';
import { Notification } from '../types';
import { fetchNotifications, markNotificationRead, dismissNotification } from '../api';

/* --------------------------------------------------------------------------------
 * KITCHEN DISPLAY SYSTEM (KDS)
 * Features:
 * - Live Order Feed with Poll-based Sync
 * - "All Day" Aggregated View for Production Counts
 * - Multi-stage Workflow: New -> Cooking -> Ready -> Completed
 * - Ticket History / Recall
 * - Urgency Color Coding (Green -> Amber -> Rose)
 * - Sound Alerts for New Orders
 * -------------------------------------------------------------------------------- */

type TicketStatus = 'new' | 'cooking' | 'ready';

interface KitchenTicket extends Notification {
    kitchenStatus: TicketStatus; // Local state augmentation
    elapsedSeconds: number;
}

const KitchenDisplay: React.FC = () => {
    const [orders, setOrders] = useState<KitchenTicket[]>([]);
    const [completedOrders, setCompletedOrders] = useState<Notification[]>([]); // For history
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'live' | 'history'>('live');
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [soundEnabled, setSoundEnabled] = useState(false);
    const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'cooking' | 'ready'>('all');

    // Refs for change detection & sound
    const previousOrderIds = React.useRef<Set<string>>(new Set());
    const isFirstLoad = React.useRef(true);

    // Audio Logic
    const playAlertSound = () => {
        if (!soundEnabled) return;
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            // "Ding-Dong"
            const now = ctx.currentTime;
            osc.type = 'sine';
            osc.frequency.setValueAtTime(659.25, now);
            osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1);
            osc.frequency.setValueAtTime(523.25, now + 0.15);
            osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.8);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
            osc.start(now);
            osc.stop(now + 1);
        } catch (e) {
            console.error("Audio error:", e);
        }
    };

    // Load Orders Logic
    const loadOrders = async () => {
        try {
            const data = await fetchNotifications(false);

            // Filter active tickets
            const activeServerOrders = data.filter(n => n.category === 'service_order' && !n.isDismissed);

            // For history (approximate, ideally backend would support this better)
            const historyServerOrders = data.filter(n => n.category === 'service_order' && n.isDismissed).slice(0, 50);
            setCompletedOrders(historyServerOrders);

            // Merge server data with local status (if we had a backend for status, we'd use that)
            // For now, we assume everything from server is 'new' unless we have local state overrides.

            const newKitchenTickets = activeServerOrders.map(o => {
                // Determine elapsed time
                const seconds = (new Date().getTime() - new Date(o.createdAt).getTime()) / 1000;

                // Try to preserve existing status if present in current state
                const existing = orders.find(ex => ex.id === o.id);
                return {
                    ...o,
                    kitchenStatus: existing ? existing.kitchenStatus : 'new',
                    elapsedSeconds: seconds
                } as KitchenTicket;
            });

            // Sort by creation time (Oldest First is standard for Kitchen to FIFO)
            newKitchenTickets.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

            // Sound Check
            if (!isFirstLoad.current) {
                const newIds = newKitchenTickets.filter(o => !previousOrderIds.current.has(o.id));
                if (newIds.length > 0) playAlertSound();
            }

            previousOrderIds.current = new Set(newKitchenTickets.map(o => o.id));
            isFirstLoad.current = false;
            setOrders(newKitchenTickets);
            setLastUpdated(new Date());
        } catch (e) {
            console.error("KDS Load Error", e);
        } finally {
            setLoading(false);
        }
    };

    // Polling & Timer
    useEffect(() => {
        loadOrders();
        const pollInterval = setInterval(loadOrders, 10000); // Sync new orders
        const timerInterval = setInterval(() => {
            // Update elapsed seconds UI without full reload
            setOrders(prev => prev.map(o => ({
                ...o,
                elapsedSeconds: (new Date().getTime() - new Date(o.createdAt).getTime()) / 1000
            })));
        }, 1000);

        return () => {
            clearInterval(pollInterval);
            clearInterval(timerInterval);
        };
    }, []);

    // Workflow Actions
    const updateTicketStatus = (id: string, newStatus: TicketStatus) => {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, kitchenStatus: newStatus } : o));
    };

    const bumpTicket = async (id: string) => {
        try {
            // Optimistically remove
            setOrders(prev => prev.filter(o => o.id !== id));
            // Sync with backend
            await markNotificationRead(id);
            await dismissNotification(id);
        } catch (e) {
            console.error("Failed to bump ticket", e);
            loadOrders(); // Revert on fail
        }
    };

    // "All Day" Aggregation
    const allDayCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        orders.forEach(t => {
            const items = t.metadata?.items as { name: string, quantity: number }[] | undefined;
            if (items && Array.isArray(items)) {
                items.forEach(i => {
                    counts[i.name] = (counts[i.name] || 0) + i.quantity;
                });
            } else {
                // Legacy textual orders, try to parse or just count generic
                counts[t.message] = (counts[t.message] || 0) + 1;
            }
        });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]); // Descending count
    }, [orders]);

    // Helpers
    const formatTime = (seconds: number) => {
        if (seconds < 60) return `${Math.floor(seconds)}s`;
        const m = Math.floor(seconds / 60);
        if (m < 60) return `${m}m`;
        const h = Math.floor(m / 60);
        return `${h}h ${m % 60}m`;
    };

    const getUrgencyClass = (seconds: number, status: TicketStatus) => {
        if (status === 'ready') return 'border-emerald-500 bg-emerald-950/30';
        if (status === 'cooking') return 'border-blue-500 bg-blue-950/30';
        if (seconds > 30 * 60) return 'border-rose-600 bg-rose-950/20 animate-pulse-slow'; // Red > 30m
        if (seconds > 15 * 60) return 'border-amber-500 bg-amber-950/20'; // Amber > 15m
        return 'border-slate-700 bg-slate-900'; // Standard
    };

    return (
        <div className="h-full bg-slate-950 text-slate-100 font-inter flex flex-col overflow-hidden">
            {/* Top Bar */}
            <header className="h-16 shrink-0 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-10">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-indigo-600 rounded-lg">
                        <ChefHat className="w-5 h-5 text-white" />
                    </div>
                    <h1 className="text-lg font-black tracking-tight text-white uppercase hidden md:block">Kitchen Display</h1>

                    {/* View Switcher */}
                    <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800 ml-4">
                        <button
                            onClick={() => setActiveTab('live')}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'live' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            Live Feed
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            History
                        </button>
                    </div>

                    <div className="h-6 w-px bg-slate-800 mx-2" />

                    {/* Filters */}
                    <div className="flex gap-2">
                        {['all', 'new', 'cooking', 'ready'].map(st => (
                            <button
                                key={st}
                                onClick={() => setStatusFilter(st as any)}
                                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border transition-all ${statusFilter === st ? 'bg-white text-slate-950 border-white' : 'bg-transparent text-slate-500 border-slate-700 hover:border-slate-500'}`}
                            >
                                {st}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Avg Time</p>
                        <p className="text-lg font-black text-white font-mono">12m</p>
                    </div>

                    <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className={`p-2.5 rounded-xl border transition-all ${soundEnabled ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                    >
                        {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                    </button>

                    <button
                        onClick={() => loadOrders()}
                        className={`p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-all active:scale-95 ${loading ? 'animate-spin' : ''}`}
                    >
                        <RefreshCw className="w-5 h-5 text-slate-400" />
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">

                {/* Tickets Grid */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                    {activeTab === 'live' ? (
                        orders.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-40">
                                <ChefHat className="w-24 h-24 mb-6" />
                                <h2 className="text-2xl font-black uppercase tracking-widest">Kitchen Clear</h2>
                                <p className="font-mono mt-2">Ready for service</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 items-start">
                                {orders
                                    .filter(o => statusFilter === 'all' || o.kitchenStatus === statusFilter)
                                    .map(order => {
                                        // Parse Items
                                        const items = (order.metadata?.items || [{ name: order.message, quantity: 1 }]) as { name: string, quantity: number }[];
                                        const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

                                        return (
                                            <div
                                                key={order.id}
                                                className={`relative group flex flex-col rounded-xl border-l-4 shadow-xl overflow-hidden transition-all duration-300 ${getUrgencyClass(order.elapsedSeconds, order.kitchenStatus)}`}
                                            >
                                                {/* Header */}
                                                <div className="p-3 bg-slate-950/40 flex justify-between items-start border-b border-white/5">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xl font-black text-white">#{order.roomNumber}</span>
                                                            {order.priority === 'urgent' && <Flame className="w-4 h-4 text-rose-500 fill-rose-500 animate-pulse" />}
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-0.5">
                                                            Ticket #{order.id.slice(-4)} • {totalItems} Items
                                                        </p>
                                                    </div>
                                                    <div className={`px-2 py-1 rounded bg-black/40 font-mono text-lg font-bold ${order.elapsedSeconds > 1800 ? 'text-rose-500 animate-pulse' : 'text-slate-300'}`}>
                                                        {formatTime(order.elapsedSeconds)}
                                                    </div>
                                                </div>

                                                {/* Items Area */}
                                                <div className="p-4 bg-slate-900/80 min-h-[160px] space-y-3">
                                                    {items.map((item, idx) => (
                                                        <div key={idx} className="flex gap-3 text-sm">
                                                            <span className="font-black text-slate-400 min-w-[20px]">{item.quantity}</span>
                                                            <span className={`font-bold leading-snug ${order.kitchenStatus === 'ready' ? 'text-emerald-300 line-through opacity-50' : 'text-slate-200'}`}>
                                                                {item.name}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {order.metadata?.notes && (
                                                        <div className="mt-4 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-amber-300 text-xs font-bold italic">
                                                            "{order.metadata.notes}"
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Action Footer */}
                                                <div className="p-2 bg-slate-950/50 flex gap-2">
                                                    {order.kitchenStatus === 'new' && (
                                                        <button
                                                            onClick={() => updateTicketStatus(order.id, 'cooking')}
                                                            className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                                                        >
                                                            <Flame className="w-4 h-4" /> Start
                                                        </button>
                                                    )}

                                                    {order.kitchenStatus === 'cooking' && (
                                                        <button
                                                            onClick={() => updateTicketStatus(order.id, 'ready')}
                                                            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                                                        >
                                                            <CheckCircle2 className="w-4 h-4" /> Ready
                                                        </button>
                                                    )}

                                                    {order.kitchenStatus === 'ready' && (
                                                        <button
                                                            onClick={() => bumpTicket(order.id)}
                                                            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                                                        >
                                                            <XCircle className="w-4 h-4" /> Bump
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        )
                    ) : (
                        // History View
                        <div className="space-y-4 max-w-4xl mx-auto">
                            {completedOrders.length === 0 ? (
                                <div className="text-center p-12 text-slate-500">No history available in this session</div>
                            ) : (
                                completedOrders.map(order => (
                                    <div key={order.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between opacity-70">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-white/5 rounded-lg">
                                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-white">Room {order.roomNumber}</p>
                                                <p className="text-xs text-slate-400">{new Date(order.createdAt).toLocaleTimeString()}</p>
                                            </div>
                                        </div>
                                        <p className="font-mono text-sm text-slate-500">{order.message}</p>
                                        <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-xs font-bold rounded uppercase">Completed</span>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Sidebar: All Day Summary */}
                {activeTab === 'live' && (
                    <aside className="w-80 shrink-0 bg-slate-900 border-l border-slate-800 overflow-y-auto hidden lg:block">
                        <div className="p-5 border-b border-slate-800 bg-slate-900 sticky top-0 z-10">
                            <h2 className="text-sm font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                <Utensils className="w-4 h-4" /> All Day Count
                            </h2>
                            <p className="text-[10px] text-slate-500 mt-1 font-bold">Consolidated Items to Prep</p>
                        </div>
                        <div className="p-2">
                            {allDayCounts.length === 0 ? (
                                <div className="p-8 text-center text-slate-600 text-xs font-bold uppercase tracking-wider">
                                    No active items
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {allDayCounts.map(([name, count]) => (
                                        <div key={name} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-800 transition-colors group">
                                            <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">{name}</span>
                                            <span className="bg-indigo-600 text-white text-xs font-black min-w-[24px] h-6 flex items-center justify-center rounded px-1.5">
                                                {count}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Stats Footer */}
                        <div className="mt-auto p-5 border-t border-slate-800">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-800 p-3 rounded-lg text-center">
                                    <p className="text-[10px] uppercase font-bold text-slate-500">Pending</p>
                                    <p className="text-2xl font-black text-white">{orders.filter(o => o.kitchenStatus === 'new').length}</p>
                                </div>
                                <div className="bg-slate-800 p-3 rounded-lg text-center">
                                    <p className="text-[10px] uppercase font-bold text-slate-500">Cooking</p>
                                    <p className="text-2xl font-black text-blue-400">{orders.filter(o => o.kitchenStatus === 'cooking').length}</p>
                                </div>
                            </div>
                        </div>
                    </aside>
                )}
            </div>
        </div>
    );
};

export default KitchenDisplay;
