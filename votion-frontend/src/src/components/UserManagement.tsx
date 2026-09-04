import React, { useState, useEffect } from 'react';
import { apiClient, ApiAccount, ApiVM } from '../services/apiClient';

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<ApiAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [vms, setVms] = useState<ApiVM[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Add User State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('user');

  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  // Edit User State
  const [editTarget, setEditTarget] = useState<ApiAccount | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // Password Reset State
  const [pwTarget, setPwTarget] = useState<ApiAccount | null>(null);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwVisible, setPwVisible] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadUsers = async () => {
    try {
      const [usersData, vmsData] = await Promise.all([
        apiClient.getAdminUsers(),
        apiClient.getVMs().catch(() => [])
      ]);
      setUsers(usersData);
      setVms(vmsData);
    } catch (e) {
      showToast('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      const res = await apiClient.updateAdminUserRole(userId, newRole);
      if (res.success) {
        showToast('User role updated');
        loadUsers();
      } else {
        showToast(res.error || 'Failed to update role');
      }
    } catch (err) {
      showToast('Error updating role');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      const res = await apiClient.deleteAdminUser(userId);
      if (res.success) {
        showToast('User deleted');
        loadUsers();
      } else {
        showToast(res.error || 'Failed to delete user');
      }
    } catch (err) {
      showToast('Error deleting user');
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.createAdminUser({ email: newEmail, name: newName, role: newRole });
      if (res.success) {
        showToast('User created successfully');
        setShowAddModal(false);
        setNewEmail('');
        setNewName('');
        setNewRole('user');
        loadUsers();
      } else {
        showToast(res.error || 'Failed to create user');
      }
    } catch (err) {
      showToast('Error creating user');
    }
  };

  const openEditModal = (user: ApiAccount) => {
    setEditTarget(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditPhone(user.phone || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    try {
      const res = await apiClient.updateAdminUser(editTarget.id, {
        name: editName,
        email: editEmail,
        role: editRole,
        phone: editPhone,
      });
      if (res.success) {
        showToast('User details updated');
        setEditTarget(null);
        loadUsers();
      } else {
        showToast(res.error || 'Failed to update user');
      }
    } catch (err) {
      showToast('Error updating user');
    }
  };

  const pwStrength = (): { score: number; label: string; color: string } => {
    let score = 0;
    if (newPw.length >= 8) score++;
    if (newPw.length >= 12) score++;
    if (/[A-Z]/.test(newPw) && /[a-z]/.test(newPw)) score++;
    if (/[0-9]/.test(newPw)) score++;
    if (/[^A-Za-z0-9]/.test(newPw)) score++;
    if (score <= 1) return { score, label: 'Weak', color: '#dc2626' };
    if (score <= 3) return { score, label: 'Medium', color: '#f59e0b' };
    return { score, label: 'Strong', color: '#16a34a' };
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwTarget) return;
    if (newPw !== confirmPw) {
      showToast('Passwords do not match');
      return;
    }
    if (newPw.length < 8) {
      showToast('Password must be at least 8 characters');
      return;
    }
    try {
      const res = await apiClient.resetAdminUserPassword(pwTarget.id, newPw, confirmPw);
      if (res.success) {
        showToast(`Password reset for ${pwTarget.email}`);
        setPwTarget(null);
        setNewPw('');
        setConfirmPw('');
      } else {
        showToast(res.error || 'Failed to reset password');
      }
    } catch (err) {
      showToast('Error resetting password');
    }
  };

  if (loading) {
    return <div className="p-8 text-[#656b6b]" role="status" aria-busy="true">Loading users...</div>;
  }

  return (
    <main className="app-content">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="mb-6 p-3 bg-[#1a1a1a] text-white text-xs font-semibold rounded-lg flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-white/60 hover:text-white">✕</button>
        </div>
      )}

      <div className="flex items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="page-heading mb-1 font-serif font-medium tracking-[-0.03em]">Advanced User Management</h1>
          <p className="text-xs text-[#656b6b]">Manage roles, permissions, and platform access</p>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="text" 
            placeholder="Search by name, email or role..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-64 text-xs px-3 py-1.5 bg-white border border-[#dedfdf] rounded outline-none focus:border-[#1a1a1a]"
          />
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary cursor-pointer"
          >
            + Add New User
          </button>
        </div>
      </div>

      <div className="bg-ink-card border border-[#dedfdf] rounded-xl overflow-hidden shadow-sm">
        <div className="responsive-table-container">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-[#f5f6f6] border-b border-[#dedfdf] text-[#656b6b] uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold tracking-wider">User</th>
                <th className="px-4 py-3 font-semibold tracking-wider">Email</th>
                <th className="px-4 py-3 font-semibold tracking-wider">Role</th>
                <th className="px-4 py-3 font-semibold tracking-wider">Servers</th>
                <th className="px-4 py-3 font-semibold tracking-wider">Support verification</th>
                <th className="px-4 py-3 font-semibold tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dedfdf]">
              {users
                .filter(u => 
                  searchQuery === '' || 
                  (u.name + u.email + u.role).toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((user) => {
                  const userVms = vms.filter(v => v.ownerEmail === user.email);
                  return (
                <tr key={user.id} className="hover:bg-[#f9fafa] transition-colors">
                  <td className="px-4 py-3 font-medium text-[#1a1a1a]">{user.name}</td>
                  <td className="px-4 py-3 text-[#656b6b]">{user.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className="bg-ink-card border border-[#dedfdf] text-[#1a1a1a] text-xs rounded px-2 py-1 outline-none"
                    >
                      <option value="administrator">Administrator</option>
                      <option value="moderator">Moderator</option>
                      <option value="user">User</option>
                      <option value="client">Client</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {userVms.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {userVms.map(vm => (
                          <span key={vm.vmid} className="text-[10px] font-semibold bg-[#f1f1f1] border border-[#dedfdf] rounded px-1.5 py-0.5 text-[#1a1a1a]" title={vm.name}>
                            {vm.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[#a7aaaa]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#656b6b]">{user.supportPinConfigured ? 'Configured' : 'Not configured'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(user)}
                        className="text-[#2563eb] hover:text-[#1d4ed8] text-[11px] font-semibold px-2 py-1 rounded bg-[#eff6ff] hover:bg-[#dbeafe] transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setPwTarget(user)}
                        className="text-[#b45309] hover:text-[#92400e] text-[11px] font-semibold px-2 py-1 rounded bg-[#fffbeb] hover:bg-[#fef3c7] transition-colors"
                      >
                        Reset Password
                      </button>
                      <button
                        onClick={() => setDeleteTarget(user.id)}
                        className="text-[#dc2626] hover:text-[#b91c1c] text-[11px] font-semibold px-2 py-1 rounded bg-[#fef2f2] hover:bg-[#fecaca] transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm Delete Modal */}
      {deleteTarget !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1001] flex items-center justify-center p-6">
          <div className="w-full max-w-[380px] bg-white border border-[#dedfdf] rounded-xl shadow-2xl p-6 flex flex-col gap-4">
            <h3 className="text-base font-bold text-[#dc2626]">Delete this user?</h3>
            <p className="text-xs text-[#656b6b]">This permanently deletes the user account, all its VMs, uploaded files, and sessions from the panel.</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1 py-2 cursor-pointer">Cancel</button>
              <button onClick={async () => {
                const id = deleteTarget;
                setDeleteTarget(null);
                await handleDeleteUser(id);
              }} className="theme-destructive-button btn-primary bg-[#dc2626] hover:bg-[#b91c1c] flex-1 py-2 cursor-pointer">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editTarget !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1002] flex items-center justify-center p-6">
          <div className="w-full max-w-[460px] bg-white border border-[#dedfdf] rounded-xl shadow-2xl p-6">
            <h3 className="text-base font-bold text-[#1a1a1a] mb-1">Edit User Details</h3>
            <p className="text-xs text-[#656b6b] mb-6">Update the account information for {editTarget.name}. Changing the email cascades to all VMs, tickets, and sessions owned by this account.</p>

            <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1a1a1a] mb-1">Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-white border border-[#dedfdf] rounded p-2 text-xs text-[#1a1a1a] outline-none focus:border-[#1a1a1a]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1a1a1a] mb-1">Email Address</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-white border border-[#dedfdf] rounded p-2 text-xs text-[#1a1a1a] outline-none focus:border-[#1a1a1a]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1a1a1a] mb-1">Phone (optional)</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+91 ..."
                  className="w-full bg-white border border-[#dedfdf] rounded p-2 text-xs text-[#1a1a1a] outline-none focus:border-[#1a1a1a]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1a1a1a] mb-1">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full bg-white border border-[#dedfdf] rounded p-2 text-xs text-[#1a1a1a] outline-none focus:border-[#1a1a1a]"
                >
                  <option value="administrator">Administrator (Full Access)</option>
                  <option value="moderator">Moderator</option>
                  <option value="user">User</option>
                  <option value="client">Client</option>
                </select>
              </div>

              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[#dedfdf]">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="btn-secondary flex-1 py-2 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 py-2 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {pwTarget !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1003] flex items-center justify-center p-6">
          <div className="w-full max-w-[460px] bg-white border border-[#dedfdf] rounded-xl shadow-2xl p-6">
            <h3 className="text-base font-bold text-[#1a1a1a] mb-1">Reset Password</h3>
            <p className="text-xs text-[#656b6b] mb-6">Set a new password for <span className="font-semibold text-[#1a1a1a]">{pwTarget.email}</span>.</p>

            <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1a1a1a] mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={pwVisible ? 'text' : 'password'}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    className="w-full bg-white border border-[#dedfdf] rounded p-2 pr-14 text-xs text-[#1a1a1a] outline-none focus:border-[#1a1a1a]"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setPwVisible(!pwVisible)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-[#656b6b] hover:text-[#1a1a1a]"
                  >
                    {pwVisible ? 'Hide' : 'Show'}
                  </button>
                </div>
                {newPw.length > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1.5 rounded-full bg-[#f1f1f1] overflow-hidden flex gap-1">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <div key={i} className={`flex-1 rounded-full ${i < pwStrength().score ? '' : 'bg-transparent'}`} style={{ backgroundColor: i < pwStrength().score ? pwStrength().color : undefined }} />
                      ))}
                    </div>
                    <span className="text-[10px] font-semibold" style={{ color: pwStrength().color }}>{pwStrength().label}</span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1a1a1a] mb-1">Confirm New Password</label>
                <input
                  type={pwVisible ? 'text' : 'password'}
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  className={`w-full bg-white border rounded p-2 text-xs text-[#1a1a1a] outline-none focus:border-[#1a1a1a] ${confirmPw.length > 0 && confirmPw !== newPw ? 'border-[#dc2626]' : 'border-[#dedfdf]'}`}
                  required
                  minLength={8}
                />
                {confirmPw.length > 0 && confirmPw !== newPw && (
                  <p className="text-[10px] text-[#dc2626] mt-1">Passwords do not match</p>
                )}
              </div>

              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[#dedfdf]">
                <button
                  type="button"
                  onClick={() => { setPwTarget(null); setNewPw(''); setConfirmPw(''); }}
                  className="btn-secondary flex-1 py-2 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 py-2 cursor-pointer"
                >
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-6">
          <div className="w-full max-w-[460px] bg-white border border-[#dedfdf] rounded-xl shadow-2xl p-6">
            <h3 className="text-base font-bold text-[#1a1a1a] mb-1">Provision New User</h3>
            <p className="text-xs text-[#656b6b] mb-6">Create a new account on the VOTION platform.</p>

            <form onSubmit={handleAddUser} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1a1a1a] mb-1">Full Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-white border border-[#dedfdf] rounded p-2 text-xs text-[#1a1a1a] outline-none focus:border-[#1a1a1a]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1a1a1a] mb-1">Email Address</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-white border border-[#dedfdf] rounded p-2 text-xs text-[#1a1a1a] outline-none focus:border-[#1a1a1a]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1a1a1a] mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full bg-white border border-[#dedfdf] rounded p-2 text-xs text-[#1a1a1a] outline-none focus:border-[#1a1a1a]"
                >
                  <option value="administrator">Administrator (Full Access)</option>
                  <option value="moderator">Moderator</option>
                  <option value="user">User</option>
                </select>
              </div>

              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[#dedfdf]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary flex-1 py-2 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 py-2 cursor-pointer"
                >
                  Provision User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};
