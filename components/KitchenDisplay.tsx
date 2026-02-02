import React, { useState, useEffect } from 'react';
import {
    ChefHat, Clock, CheckCircle2, AlertCircle, RefreshCw,
    Leaf, Utensils, Hash, StickyNote, Volume2, VolumeX
} from 'lucide-react';
import { Notification } from '../types';
import { fetchNotifications, markNotificationRead, dismissNotification } from '../api';

const KitchenDisplay: React.FC = () => {
    const [orders, setOrders] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [justCompletedInfo, setJustCompletedInfo] = useState<{ id: string, room: string } | null>(null);
    const [soundEnabled, setSoundEnabled] = useState(false);

    // Refs for change detection
    const previousOrderIds = React.useRef<Set<string>>(new Set());
    const isFirstLoad = React.useRef(true);

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

            // "Ding-Dong" effect
            const now = ctx.currentTime;

            // First tone (E5)
            osc.type = 'sine';
            osc.frequency.setValueAtTime(659.25, now);
            osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1);

            // Second tone (C5)
            osc.frequency.setValueAtTime(523.25, now + 0.15);
            osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.8);

            // Envelope
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

            osc.start(now);
            osc.stop(now + 1);
        } catch (e) {
            console.error("Audio playback error:", e);
        }
    };

    const loadOrders = async () => {
        try {
            const data = await fetchNotifications(false); // Fetch all to see history too? Or just unread?
            // Better to fetch all active (undismissed) notifications
            // The API `fetchNotifications` by default gets undismissed ones.

            // Filter for kitchen relevant orders
            const kitchenOrders = data.filter(n =>
                n.category === 'service_order' &&
                !n.isDismissed
            );

            // Sort by priority/time? For now, server sort is likely by creation time.
            const sortedOrders = kitchenOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            // Check for NEW orders
            if (!isFirstLoad.current) {
                const newItems = sortedOrders.filter(o => !previousOrderIds.current.has(o.id));
                if (newItems.length > 0) {
                    playAlertSound();
                }
            }

            // Update Ref
            previousOrderIds.current = new Set(sortedOrders.map(o => o.id));
            isFirstLoad.current = false;

            setOrders(sortedOrders);
            setLastUpdated(new Date());
        } catch (e) {
            console.error("Failed to load kitchen orders", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOrders();
        const interval = setInterval(loadOrders, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, []);

    const handleCompleteOrder = async (notificationId: string, roomNumber: string) => {
        try {
            // Mark as read and dismiss to remove from active board
            await markNotificationRead(notificationId);
            await dismissNotification(notificationId);

            // Optimistic update
            setOrders(prev => prev.filter(o => o.id !== notificationId));

            // Show feedback
            setJustCompletedInfo({ id: notificationId, room: roomNumber });
            setTimeout(() => setJustCompletedInfo(null), 3000);

        } catch (e) {
            console.error("Failed to complete order", e);
            alert("Failed to update order status. Please try again.");
        }
    };

    const getTimeElapsed = (isoTime: string) => {
        const diff = new Date().getTime() - new Date(isoTime).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        return `${hours}h ${mins % 60}m ago`;
    };

    const getUrgencyColor = (isoTime: string) => {
        const diff = new Date().getTime() - new Date(isoTime).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins > 45) return 'bg-rose-500/10 border-rose-500/20 text-rose-500';
        if (mins > 25) return 'bg-amber-500/10 border-amber-500/20 text-amber-600';
        return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600';
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-inter p-6">
            {/* Header */}
            <header className="flex items-center justify-between mb-8 bg-slate-900/50 p-6 rounded-3xl border border-slate-800">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-500/20">
                        <ChefHat className="w-8 h-8 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-white">Kitchen Display System (KDS)</h1>
                        <p className="text-slate-400 text-sm font-bold flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Live Feed • Auto-syncing
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Active Tickets</p>
                        <p className="text-3xl font-black text-white">{orders.length}</p>
                    </div>
                    <button
                        onClick={() => loadOrders()}
                        className="p-4 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-slate-700 transition-all active:scale-95"
                    >
                        <RefreshCw className={`w-5 h-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => {
                            if (!soundEnabled) {
                                // Try playing checks audio context strictness
                                try { const ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); ctx.resume(); } catch { }
                            }
                            setSoundEnabled(!soundEnabled);
                        }}
                        className={`p-4 rounded-2xl border transition-all active:scale-95 flex items-center gap-2 ${soundEnabled ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'}`}
                        title={soundEnabled ? "Mute Alerts" : "Enable Sound Alerts"}
                    >
                        {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                        <span className="text-xs font-bold uppercase hidden sm:inline">{soundEnabled ? 'On' : 'Off'}</span>
                    </button>
                </div>
            </header>

            {justCompletedInfo && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 z-50 font-bold tracking-tight">
                    <CheckCircle2 className="w-6 h-6" />
                    Order for Room {justCompletedInfo.room} Completed!
                </div>
            )}

            {/* Grid */}
            {orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-slate-600">
                    <div className="w-24 h-24 rounded-full bg-slate-900 border-4 border-slate-800 flex items-center justify-center mb-6">
                        <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h2 className="text-xl font-black uppercase tracking-widest">All Caught Up</h2>
                    <p className="mt-2 text-sm font-bold opacity-60">No pending orders in the queue</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {orders.map((order) => {
                        // Extract items safely from metadata
                        const items = order.metadata?.items as { name: string, quantity: number, price?: number }[] | undefined;
                        const hasItems = items && Array.isArray(items) && items.length > 0;

                        // Derive simpler items from description if metadata missing (legacy support)
                        const displayItems = hasItems ? items : [{ name: order.message, quantity: 1 }];

                        return (
                            <div
                                key={order.id}
                                className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex flex-col shadow-xl hover:shadow-2xl hover:border-slate-700 transition-all duration-300 group"
                            >
                                {/* Ticket Header */}
                                <div className={`p-4 flex items-center justify-between border-b border-slate-800 ${getUrgencyColor(order.createdAt)} bg-opacity-5`}>
                                    <div className="flex items-center gap-3">
                                        <span className="px-3 py-1.5 bg-slate-950 rounded-lg text-xs font-black text-slate-300 border border-slate-800">
                                            #{order.roomNumber || 'UNK'}
                                        </span>
                                        <span className="text-xs font-bold uppercase tracking-wider opacity-80">
                                            {getTimeElapsed(order.createdAt)}
                                        </span>
                                    </div>
                                    <Clock className="w-4 h-4 opacity-50" />
                                </div>

                                {/* Items List */}
                                <div className="p-6 flex-1 bg-slate-900/50">
                                    <div className="space-y-4">
                                        {displayItems.map((item, idx) => (
                                            <div key={idx} className="flex items-start gap-4">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-black text-sm shrink-0 border border-indigo-500/20">
                                                    {item.quantity}x
                                                </div>
                                                <div className="pt-1">
                                                    <p className="font-bold text-slate-200 leading-tight block">
                                                        {item.name}
                                                    </p>
                                                    {/* Using regex to check if it matches service charge pattern to style differently if needed */}
                                                    {item.name.includes('Service Charge') && (
                                                        <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded mt-1 inline-block">
                                                            Automatic
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Notes section if any item has notes or generalized notes */}
                                    {order.metadata?.notes && (
                                        <div className="mt-6 pt-4 border-t border-dashed border-slate-800">
                                            <p className="text-xs font-bold text-amber-500 flex items-center gap-2 uppercase tracking-wider">
                                                <StickyNote className="w-3 h-3" /> Special Instructions
                                            </p>
                                            <p className="mt-1 text-sm text-slate-300 font-medium italic">"{order.metadata.notes}"</p>
                                        </div>
                                    )}
                                </div>

                                {/* Footer Actions */}
                                <div className="p-4 bg-slate-950 border-t border-slate-800">
                                    <button
                                        onClick={() => handleCompleteOrder(order.id, order.roomNumber || '')}
                                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 hover:shadow-lg hover:shadow-emerald-900/20 active:scale-95 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all"
                                    >
                                        <CheckCircle2 className="w-5 h-5" />
                                        Mark Ready
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default KitchenDisplay;
