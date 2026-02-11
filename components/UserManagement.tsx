import React, { useState, useEffect } from "react";
import {
  User,
  Plus,
  Trash2,
  Shield,
  LayoutGrid,
  Check,
  X,
  Loader2,
  Pencil,
} from "lucide-react";
import { UserResponse } from "../types";

// Navigation items for permission selection
const NAV_SECTIONS = [
  // Core Operational Sections
  { id: "frontdesk", label: "Front Desk" },
  { id: "dashboard", label: "Dashboard" },
  { id: "guests", label: "Guests" },
  { id: "kitchen", label: "Kitchen" },
  { id: "housekeeping", label: "Housekeeping" },
  { id: "compliance", label: "Compliance" },
  { id: "security", label: "Security" },
  { id: "analysis", label: "Analysis" },
  { id: "reports", label: "Reports" },

  // Settings Hub Sections
  { id: "users", label: "User Management" },
  { id: "setup", label: "Property Setup" },
  { id: "rules", label: "Revenue Rules" },
  { id: "settings", label: "Channel Settings" },
];

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingUser, setEditingUser] = useState<UserResponse | null>(null);

  // Form State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("staff");
  const [allowedSections, setAllowedSections] = useState<string[]>([
    "frontdesk",
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/users");
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (err) {
      console.error("Failed to load users", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const payload: any = {
      username,
      full_name: fullName,
      role,
      allowed_sections: role === "admin" ? [] : allowedSections,
    };

    // Only include password if it's a new user or if password field is filled for an existing user
    if (!editingUser || password) {
      payload.password = password;
    }

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const method = editingUser ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(
          data.detail || `Failed to ${editingUser ? "update" : "create"} user`,
        );
      }

      const returnedUser = await res.json();

      if (editingUser) {
        setUsers(
          users.map((u) => (u.id === editingUser.id ? returnedUser : u)),
        );
      } else {
        setUsers([...users, returnedUser]);
      }

      resetForm();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const resetForm = () => {
    setIsAdding(false);
    setEditingUser(null);
    setUsername("");
    setPassword("");
    setFullName("");
    setRole("staff");
    setAllowedSections(["frontdesk"]);
    setFormError(null);
  };

  const handleEditClick = (user: UserResponse) => {
    setEditingUser(user);
    setUsername(user.username);
    setFullName(user.full_name);
    setRole(user.role);
    setAllowedSections(user.allowed_sections || []);
    setPassword(""); // Clear password field for security
    setIsAdding(true);
    // Scroll to form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleSection = (id: string) => {
    if (allowedSections.includes(id)) {
      setAllowedSections(allowedSections.filter((s) => s !== id));
    } else {
      setAllowedSections([...allowedSections, id]);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      if (res.ok) {
        setUsers(users.filter((u) => u.id !== userId));
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to delete user");
      }
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
            User Management
          </h1>
          <p className="text-slate-500 font-medium">
            Manage staff access and roles
          </p>
        </div>
        <button
          onClick={() => (isAdding ? resetForm() : setIsAdding(true))}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition"
        >
          {isAdding ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          {isAdding ? "Cancel" : "Add Staff Member"}
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl animate-in slide-in-from-top-4">
          <h3 className="text-lg font-bold text-slate-800 mb-6">
            {editingUser ? "Edit User Details" : "New User Details"}
          </h3>
          <form onSubmit={handleAddUser} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Username
                </label>
                <input
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. frontdesk1"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Full Name
                </label>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. John Doe"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Password {editingUser && "(Leave blank to keep current)"}
                </label>
                <input
                  required={!editingUser}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500"
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="staff">Staff (Restricted)</option>
                  <option value="admin">Admin (Full Access)</option>
                </select>
              </div>
            </div>

            {role === "staff" && (
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Allowed Sections
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {NAV_SECTIONS.map((section) => (
                    <button
                      type="button"
                      key={section.id}
                      onClick={() => toggleSection(section.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        allowedSections.includes(section.id)
                          ? "bg-indigo-50 border-indigo-500 text-indigo-700 font-bold"
                          : "bg-white border-slate-200 text-slate-500 hover:border-indigo-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{section.label}</span>
                        {allowedSections.includes(section.id) && (
                          <Check className="w-4 h-4" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {formError && (
              <div className="p-3 bg-rose-50 text-rose-600 rounded-lg text-sm font-medium">
                {formError}
              </div>
            )}

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition shadow-lg"
              >
                {editingUser ? "Update User" : "Create User"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {users.map((user) => (
            <div
              key={user.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      user.role === "admin"
                        ? "bg-amber-100 text-amber-600"
                        : "bg-indigo-100 text-indigo-600"
                    }`}
                  >
                    {user.role === "admin" ? (
                      <Shield className="w-6 h-6" />
                    ) : (
                      <User className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">
                      {user.full_name || user.username}
                    </h3>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      @{user.username}
                    </p>
                  </div>
                </div>

                <div className="flex gap-1">
                  <button
                    onClick={() => handleEditClick(user)}
                    className="text-slate-400 hover:text-indigo-600 transition-colors p-2 hover:bg-indigo-50 rounded-lg"
                    title="Edit User"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                  {user.username !== "admin" && (
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="text-slate-400 hover:text-rose-500 transition-colors p-2 hover:bg-rose-50 rounded-lg"
                      title="Remove User"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400 font-bold uppercase mb-2">
                  Access
                </p>
                {user.role === "admin" ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Full Access
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {user.allowed_sections &&
                    user.allowed_sections.length > 0 ? (
                      user.allowed_sections.map((sec) => (
                        <span
                          key={sec}
                          className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 uppercase"
                        >
                          {NAV_SECTIONS.find((n) => n.id === sec)?.label || sec}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">
                        No sections assigned
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserManagement;
