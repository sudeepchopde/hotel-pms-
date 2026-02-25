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
  ChevronDown,
} from "lucide-react";
import { UserResponse } from "../types";
import { PERMISSION_GROUPS } from "./permissions";

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
  const [allowedSections, setAllowedSections] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/users");
      if (res.ok) {
        setUsers(await res.json());
      } else {
        console.error("Failed to load users: HTTP", res.status);
      }
    } catch (err) {
      console.error("Failed to load users", err);
    } finally {
      setLoading(false);
    }
  };

  // --- Password validation ---
  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return "Password must be at least 8 characters long";
    if (!/[A-Z]/.test(pwd))
      return "Password must include at least one uppercase letter";
    if (!/[a-z]/.test(pwd))
      return "Password must include at least one lowercase letter";
    if (!/[0-9]/.test(pwd)) return "Password must include at least one number";
    return null;
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validate password: required for new users, validated if provided for edits
    if (!editingUser && !password) {
      setFormError("Password is required for new users");
      return;
    }
    if (password) {
      const pwdError = validatePassword(password);
      if (pwdError) {
        setFormError(pwdError);
        return;
      }
    }

    const payload: any = {
      username,
      full_name: fullName,
      role,
      allowed_sections: role === "admin" ? [] : allowedSections,
    };

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
        const text = await res.text();
        let errMsg = `Failed to ${editingUser ? "update" : "create"} user`;
        try {
          const data = JSON.parse(text);
          errMsg = data.detail || errMsg;
        } catch {}
        throw new Error(errMsg);
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
    setAllowedSections([]);
    setFormError(null);
    setExpandedGroups([]);
  };

  const handleEditClick = (user: UserResponse) => {
    setEditingUser(user);
    setUsername(user.username);
    setFullName(user.full_name);
    setRole(user.role);

    // Flatten permissions - handle legacy "section-only" permissions if needed
    // In a real migration, we might map 'frontdesk' to all frontdesk permissions
    // For now, we assume user.allowed_sections contains granular permissions or section IDs
    setAllowedSections(user.allowed_sections || []);

    setPassword("");
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const togglePermission = (permId: string) => {
    if (allowedSections.includes(permId)) {
      setAllowedSections(allowedSections.filter((s) => s !== permId));
    } else {
      setAllowedSections([...allowedSections, permId]);
    }
  };

  const toggleGroup = (groupId: string) => {
    // Determine if we are selecting all or deselecting all
    const group = PERMISSION_GROUPS.find((g) => g.id === groupId);
    if (!group) return;

    const allPermissionIds = group.actions.map((a) => a.id);
    const hasAll = allPermissionIds.every((id) => allowedSections.includes(id));

    if (hasAll) {
      // Deselect all
      setAllowedSections(
        allowedSections.filter((s) => !allPermissionIds.includes(s)),
      );
    } else {
      // Select all (merge checking for duplicates)
      const newSections = new Set([...allowedSections, ...allPermissionIds]);
      setAllowedSections(Array.from(newSections));
    }
  };

  const toggleGroupExpand = (groupId: string) => {
    if (expandedGroups.includes(groupId)) {
      setExpandedGroups(expandedGroups.filter((id) => id !== groupId));
    } else {
      setExpandedGroups([...expandedGroups, groupId]);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      if (res.ok) {
        setUsers(users.filter((u) => u.id !== userId));
      } else {
        const text = await res.text();
        let errMsg = "Failed to delete user";
        try {
          const data = JSON.parse(text);
          errMsg = data.detail || errMsg;
        } catch {}
        alert(errMsg);
      }
    } catch (e: any) {
      alert(e.message || "Network error while deleting user");
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
                <p className="text-[10px] text-slate-400 font-medium leading-tight px-1">
                  At least 8 characters: Must include uppercase, lowercase &
                  numbers.
                </p>
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
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">
                  Permissions & Access Control
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {PERMISSION_GROUPS.map((group) => {
                    const allActionIds = group.actions.map((a) => a.id);
                    const selectedCount = allActionIds.filter((id) =>
                      allowedSections.includes(id),
                    ).length;
                    const isAllSelected = selectedCount === allActionIds.length;
                    const isExpanded = expandedGroups.includes(group.id);

                    return (
                      <div
                        key={group.id}
                        className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50"
                      >
                        <div className="p-3 bg-white border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isAllSelected}
                              ref={(input) => {
                                if (input) {
                                  input.indeterminate =
                                    selectedCount > 0 &&
                                    selectedCount < allActionIds.length;
                                }
                              }}
                              onChange={() => toggleGroup(group.id)}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <div
                              className="cursor-pointer"
                              onClick={() => toggleGroupExpand(group.id)}
                            >
                              <h4 className="font-bold text-slate-700 text-sm">
                                {group.label}
                              </h4>
                              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">
                                {group.description}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleGroupExpand(group.id)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-400"
                          >
                            <ChevronDown
                              className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            />
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="p-3 bg-slate-50 grid gap-2 animate-in slide-in-from-top-1">
                            {group.actions.map((action) => (
                              <label
                                key={action.id}
                                className="flex items-center gap-3 p-2 hover:bg-white rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-100"
                              >
                                <input
                                  type="checkbox"
                                  checked={allowedSections.includes(action.id)}
                                  onChange={() => togglePermission(action.id)}
                                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-xs font-bold text-slate-600">
                                  {action.label}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
                  Access & Permissions
                </p>
                {user.role === "admin" ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Full Admin Access
                  </span>
                ) : (
                  <div className="space-y-2">
                    {(!user.allowed_sections ||
                      user.allowed_sections.length === 0) && (
                      <span className="text-xs text-slate-400 italic">
                        No permissions assigned
                      </span>
                    )}
                    {PERMISSION_GROUPS.map((group) => {
                      const groupActions = group.actions.map((a) => a.id);
                      const userActions =
                        user.allowed_sections?.filter((s) =>
                          groupActions.includes(s),
                        ) || [];
                      if (userActions.length === 0) return null;

                      return (
                        <div key={group.id} className="flex items-start gap-2">
                          <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded uppercase shrink-0 min-w-[80px] text-center">
                            {group.label}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {userActions.map((actionId) => {
                              const actionLabel = group.actions.find(
                                (a) => a.id === actionId,
                              )?.label;
                              return (
                                <span
                                  key={actionId}
                                  className="text-[10px] text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded"
                                >
                                  {actionLabel || actionId}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
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
