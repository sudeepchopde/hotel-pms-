import React from "react";
import {
  Users,
  Home,
  TrendingUp,
  Settings as SettingsIcon,
  ChevronRight,
  CreditCard,
} from "lucide-react";
import { UserResponse } from "../types";

interface SettingsLayoutProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  user: UserResponse | null;
  children: React.ReactNode;
}

const SettingsLayout: React.FC<SettingsLayoutProps> = ({
  activeTab,
  setActiveTab,
  user,
  children,
}) => {
  const settingsTabs = [
    {
      id: "users",
      label: "User Management",
      icon: Users,
      color: "text-indigo-400",
    },
    {
      id: "setup",
      label: "Property Setup",
      icon: Home,
      color: "text-emerald-400",
    },
    {
      id: "rules",
      label: "Revenue Rules",
      icon: TrendingUp,
      color: "text-orange-400",
    },
    {
      id: "payments",
      label: "Payment Gateway",
      icon: CreditCard,
      color: "text-purple-400",
    },
    {
      id: "settings",
      label: "Channel Settings",
      icon: SettingsIcon,
      color: "text-slate-400",
    },
  ];

  const allowedTabs = settingsTabs.filter((tab) => {
    if (!user) return false;
    if (user.role === "admin") return true;
    return user.allowed_sections.includes(tab.id);
  });

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      {/* Settings Sub-Sidebar */}
      <aside className="w-80 border-r border-slate-200 bg-white flex flex-col shrink-0">
        <div className="p-8 border-b border-slate-100">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Settings
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Configure and manage your property
          </p>
        </div>

        <nav className="flex-1 p-4 flex flex-col gap-2 overflow-y-auto custom-scrollbar">
          {allowedTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all group ${
                  isActive
                    ? "bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100"
                    : "hover:bg-slate-50 text-slate-500 hover:text-slate-700 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`p-2.5 rounded-xl transition-colors ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                        : `bg-slate-100 ${tab.color} group-hover:bg-white`
                    }`}
                  >
                    <tab.icon className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-sm tracking-tight">
                    {tab.label}
                  </span>
                </div>
                {isActive ? (
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-transform group-hover:translate-x-0.5" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-6 bg-slate-50 border-t border-slate-100">
          <div className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-black">
              {user?.username?.charAt(0).toUpperCase() || "A"}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold text-slate-900 truncate">
                {user?.username}
              </p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {user?.role}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Settings Content Area */}
      <section className="flex-1 bg-[#fbfcfd] overflow-y-auto custom-scrollbar relative">
        <div className="min-h-full">{children}</div>
      </section>
    </div>
  );
};

export default SettingsLayout;
