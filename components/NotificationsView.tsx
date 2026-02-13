import React, { useState, useEffect, useCallback } from "react";
import {
  Bell,
  CheckCheck,
  Trash2,
  Calendar,
  CreditCard,
  Users,
  Home,
  Settings,
} from "lucide-react";
import { Notification, NotificationType } from "../types";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
} from "../api";
import { formatDate } from "../utils";

const NOTIFICATION_ICONS: Record<NotificationType, React.ReactNode> = {
  reservation: <Calendar className="w-5 h-5" />,
  checkin: <Users className="w-5 h-5" />,
  checkout: <Users className="w-5 h-5" />,
  payment: <CreditCard className="w-5 h-5" />,
  housekeeping: <Home className="w-5 h-5" />,
  guest_request: <Bell className="w-5 h-5" />,
  system: <Settings className="w-5 h-5" />,
};

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "bg-red-50 border-red-200 hover:border-red-300",
  high: "bg-amber-50 border-amber-200 hover:border-amber-300",
  normal: "bg-white border-slate-200 hover:border-slate-300",
  low: "bg-slate-50 border-slate-100 hover:border-slate-200",
};

const TYPE_STYLES: Record<NotificationType, string> = {
  reservation: "text-blue-600 bg-blue-100",
  checkin: "text-emerald-600 bg-emerald-100",
  checkout: "text-amber-600 bg-amber-100",
  payment: "text-green-600 bg-green-100",
  housekeeping: "text-purple-600 bg-purple-100",
  guest_request: "text-pink-600 bg-pink-100",
  system: "text-slate-600 bg-slate-100",
};

const FILTER_TABS: {
  id: string;
  label: string;
  types: NotificationType[] | null;
}[] = [
  { id: "all", label: "All Notifications", types: null },
  { id: "reservations", label: "Reservations", types: ["reservation"] },
  { id: "checkinout", label: "Check-In/Out", types: ["checkin", "checkout"] },
  { id: "payments", label: "Payments", types: ["payment"] },
  {
    id: "system",
    label: "System & Support",
    types: ["system", "housekeeping", "guest_request"],
  },
];

const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
};

const NotificationsView: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchNotifications();
      setNotifications(data);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();

    // Refresh every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const handleMarkRead = async (notificationId: string) => {
    try {
      await markNotificationRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)),
      );
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const handleDismiss = async (notificationId: string) => {
    try {
      await dismissNotification(notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (error) {
      console.error("Failed to dismiss notification:", error);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    const tab = FILTER_TABS.find((t) => t.id === activeTab);
    if (!tab || !tab.types) return true;
    return tab.types.includes(n.type);
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="h-full flex flex-col bg-[#fbfcfd] overflow-hidden">
      {/* Header */}
      <div className="p-8 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              Notifications
            </h1>
            <p className="text-slate-500 mt-1 font-medium">
              Manage alerts and system updates
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-colors font-medium text-sm"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all as read
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-semibold rounded-xl whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                  : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-200 hover:border-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 font-medium">
              Loading notifications...
            </p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-96 text-slate-400">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <Bell className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-600">
              No notifications
            </h3>
            <p className="text-sm">You're all caught up!</p>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`group relative p-4 rounded-2xl border transition-all duration-200 ${
                notification.isRead
                  ? "bg-slate-50/50 border-slate-100 opacity-75 grayscale-[0.5] hover:grayscale-0 hover:opacity-100 hover:bg-white hover:shadow-md"
                  : `${PRIORITY_STYLES[notification.priority]} shadow-sm hover:shadow-md`
              }`}
              onClick={() =>
                !notification.isRead && handleMarkRead(notification.id)
              }
            >
              <div className="flex gap-4">
                {/* Icon */}
                <div
                  className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${TYPE_STYLES[notification.type]}`}
                >
                  {NOTIFICATION_ICONS[notification.type]}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 py-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3
                      className={`text-base font-bold ${notification.isRead ? "text-slate-600" : "text-slate-800"}`}
                    >
                      {notification.title}
                    </h3>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-slate-400 whitespace-nowrap">
                        {formatTimeAgo(notification.createdAt)}
                      </span>
                      {!notification.isRead && (
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/30" />
                      )}
                    </div>
                  </div>

                  <p
                    className={`text-sm mt-1 leading-relaxed ${notification.isRead ? "text-slate-500" : "text-slate-600"}`}
                  >
                    {notification.message}
                  </p>

                  {(notification.roomNumber || notification.category) && (
                    <div className="flex items-center gap-2 mt-3">
                      {notification.roomNumber && (
                        <span className="text-[10px] uppercase font-bold px-2 py-1 bg-white border border-slate-200 rounded-md text-slate-500">
                          Room {notification.roomNumber}
                        </span>
                      )}
                      <span className="text-[10px] uppercase font-bold px-2 py-1 bg-white border border-slate-200 rounded-md text-slate-500">
                        {notification.category}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity justify-center px-2 border-l border-slate-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDismiss(notification.id);
                    }}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
  );
};

export default NotificationsView;
