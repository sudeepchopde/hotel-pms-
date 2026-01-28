import React, { useState, useEffect, useCallback } from 'react';
import { Bell, X, Check, CheckCheck, Trash2, Calendar, CreditCard, Users, Home, AlertTriangle, Settings, Filter } from 'lucide-react';
import { Notification, NotificationType } from '../types';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead, dismissNotification } from '../api';

interface NotificationsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

const NOTIFICATION_ICONS: Record<NotificationType, React.ReactNode> = {
    reservation: <Calendar className="w-5 h-5" />,
    checkin: <Users className="w-5 h-5" />,
    checkout: <Users className="w-5 h-5" />,
    payment: <CreditCard className="w-5 h-5" />,
    housekeeping: <Home className="w-5 h-5" />,
    guest_request: <Bell className="w-5 h-5" />,
    system: <Settings className="w-5 h-5" />
};

const PRIORITY_COLORS: Record<string, string> = {
    urgent: 'bg-red-500/20 border-red-500/50 text-red-400',
    high: 'bg-amber-500/20 border-amber-500/50 text-amber-400',
    normal: 'bg-slate-500/20 border-slate-500/50 text-slate-300',
    low: 'bg-slate-600/20 border-slate-600/50 text-slate-400'
};

const TYPE_COLORS: Record<NotificationType, string> = {
    reservation: 'text-blue-400',
    checkin: 'text-emerald-400',
    checkout: 'text-amber-400',
    payment: 'text-green-400',
    housekeeping: 'text-purple-400',
    guest_request: 'text-pink-400',
    system: 'text-red-400'
};

const FILTER_TABS: { id: string; label: string; types: NotificationType[] | null }[] = [
    { id: 'all', label: 'All', types: null },
    { id: 'reservations', label: 'Reservations', types: ['reservation'] },
    { id: 'checkinout', label: 'Check-In/Out', types: ['checkin', 'checkout'] },
    { id: 'payments', label: 'Payments', types: ['payment'] },
    { id: 'system', label: 'System', types: ['system', 'housekeeping', 'guest_request'] }
];

const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
};

const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ isOpen, onClose }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');

    const loadNotifications = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchNotifications();
            setNotifications(data);
        } catch (error) {
            console.error('Failed to load notifications:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            loadNotifications();
        }
    }, [isOpen, loadNotifications]);

    const handleMarkRead = async (notificationId: string) => {
        try {
            await markNotificationRead(notificationId);
            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
            );
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await markAllNotificationsRead();
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    const handleDismiss = async (notificationId: string) => {
        try {
            await dismissNotification(notificationId);
            setNotifications(prev => prev.filter(n => n.id !== notificationId));
        } catch (error) {
            console.error('Failed to dismiss notification:', error);
        }
    };

    const filteredNotifications = notifications.filter(n => {
        const tab = FILTER_TABS.find(t => t.id === activeTab);
        if (!tab || !tab.types) return true;
        return tab.types.includes(n.type);
    });

    const unreadCount = notifications.filter(n => !n.isRead).length;

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed right-0 top-0 h-full w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-l border-slate-700/50 shadow-2xl z-50 flex flex-col animate-slide-in-right">
                {/* Header */}
                <div className="p-4 border-b border-slate-700/50 bg-slate-800/50">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
                                <Bell className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">Notifications</h2>
                                {unreadCount > 0 && (
                                    <p className="text-xs text-slate-400">{unreadCount} unread</p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllRead}
                                    className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700/50 rounded-lg transition-colors"
                                    title="Mark all as read"
                                >
                                    <CheckCheck className="w-5 h-5" />
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex gap-1 overflow-x-auto pb-1">
                        {FILTER_TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all ${activeTab === tab.id
                                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                        : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Notifications List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : filteredNotifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-500">
                            <Bell className="w-12 h-12 mb-3 opacity-50" />
                            <p className="text-sm">No notifications</p>
                            <p className="text-xs opacity-70">You're all caught up!</p>
                        </div>
                    ) : (
                        filteredNotifications.map(notification => (
                            <div
                                key={notification.id}
                                className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${notification.isRead
                                        ? 'bg-slate-800/30 border-slate-700/30'
                                        : `${PRIORITY_COLORS[notification.priority]} border`
                                    }`}
                                onClick={() => !notification.isRead && handleMarkRead(notification.id)}
                            >
                                <div className="flex gap-3">
                                    {/* Icon */}
                                    <div className={`flex-shrink-0 p-2 rounded-lg bg-slate-800/50 ${TYPE_COLORS[notification.type]}`}>
                                        {NOTIFICATION_ICONS[notification.type]}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className={`font-medium text-sm ${notification.isRead ? 'text-slate-400' : 'text-white'}`}>
                                                {notification.title}
                                            </h3>
                                            {!notification.isRead && (
                                                <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                                            )}
                                        </div>
                                        <p className={`text-xs mt-1 line-clamp-2 ${notification.isRead ? 'text-slate-500' : 'text-slate-400'}`}>
                                            {notification.message}
                                        </p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-xs text-slate-500">
                                                {formatTimeAgo(notification.createdAt)}
                                            </span>
                                            {notification.roomNumber && (
                                                <span className="text-xs px-2 py-0.5 bg-slate-700/50 rounded text-slate-400">
                                                    Room {notification.roomNumber}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDismiss(notification.id);
                                            }}
                                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                            title="Dismiss"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <style>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
        </>
    );
};

export default NotificationsPanel;
