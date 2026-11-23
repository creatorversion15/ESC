import React, { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Search,
  Download,
  X,
  ShieldAlert,
  UserCheck,
  Edit3,
  Save,
  BadgeCheck,
  Clock,
  IdCard,
} from 'lucide-react';
import { doc, updateDoc, setDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { apiRequest } from '../../lib/apiClient';
import { filterMembersByCategory, resolveAccountStatus } from '../../utils/escLogic';
import type {
  UserProfile,
  UserRole,
  MemberCategoryFilter,
  AccountStatus,
} from '../../types';

interface MembersManagementSectionProps {
  usersList: UserProfile[];
  setUsersList: React.Dispatch<React.SetStateAction<UserProfile[]>>;
  currentUid: string;
  isSuperAdmin: boolean;
  initialCategory?: MemberCategoryFilter;
  onNotify: (type: 'success' | 'error', text: string) => void;
  onRefreshAll: () => Promise<void>;
  onLogAdminAction: (action: string, targetType: string, targetId: string, details: string) => Promise<void>;
  onOpenTeamById?: (teamId: string) => void;
  onExportCSV: () => void;
}

const CATEGORY_TABS: { key: MemberCategoryFilter; label: string }[] = [
  { key: 'all', label: 'All Members' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'approved', label: 'Approved Members' },
  { key: 'active', label: 'Active Members' },
  { key: 'inactive', label: 'Inactive Members' },
  { key: 'suspended', label: 'Suspended Members' },
  { key: 'rejected', label: 'Rejected Applications' },
];

export const MembersManagementSection: React.FC<MembersManagementSectionProps> = ({
  usersList,
  setUsersList,
  currentUid,
  isSuperAdmin,
  initialCategory = 'all',
  onNotify,
  onRefreshAll,
  onLogAdminAction,
  onOpenTeamById,
  onExportCSV,
}) => {
  const [category, setCategory] = useState<MemberCategoryFilter>(initialCategory);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [memberDetails, setMemberDetails] = useState<any>(null);

  // Edit & Role controls
  const [roleDraft, setRoleDraft] = useState<UserRole>('student');
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCollege, setEditCollege] = useState('');
  const [editBranch, setEditBranch] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editSkills, setEditSkills] = useState('');
  const [busyAction, setBusyAction] = useState(false);

  useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);

  const categoryCounts = useMemo(() => {
    const counts: Record<MemberCategoryFilter, number> = {
      all: usersList.length,
      under_review: filterMembersByCategory(usersList, 'under_review').length,
      approved: filterMembersByCategory(usersList, 'approved').length,
      active: filterMembersByCategory(usersList, 'active').length,
      inactive: filterMembersByCategory(usersList, 'inactive').length,
      suspended: filterMembersByCategory(usersList, 'suspended').length,
      rejected: filterMembersByCategory(usersList, 'rejected').length,
    };
    return counts;
  }, [usersList]);

  const filteredUsers = useMemo(() => {
    const catFiltered = filterMembersByCategory(usersList, category);
    if (!search.trim()) return catFiltered;
    const q = search.toLowerCase();
    return catFiltered.filter((u) => {
      const skillsText = (u.technicalSkills || []).join(' ').toLowerCase();
      return (
        u.fullName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.escMemberId?.toLowerCase().includes(q) ||
        u.college?.toLowerCase().includes(q) ||
        u.branch?.toLowerCase().includes(q) ||
        skillsText.includes(q)
      );
    });
  }, [usersList, category, search]);

  const openMemberDrawer = async (u: UserProfile) => {
    setSelectedUser(u);
    setRoleDraft(u.role);
    setEditMode(false);
    setEditName(u.fullName || '');
    setEditCollege(u.college || '');
    setEditBranch(u.branch || '');
    setEditYear(u.academicYear || '');
    setEditSkills((u.technicalSkills || []).join(', '));
    setMemberDetails(null);

    try {
      setDetailLoading(true);
      const data = await apiRequest(`/api/admin/members/${u.userId}/details`, { requireAuth: true });
      setMemberDetails(data);
    } catch {
      // keep drawer responsive even if SQL details not yet present for legacy user
    } finally {
      setDetailLoading(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedUser) return;
    const isAdminChange =
      roleDraft === 'admin' ||
      roleDraft === 'superadmin' ||
      selectedUser.role === 'admin' ||
      selectedUser.role === 'superadmin';

    if (isAdminChange && !isSuperAdmin) {
      onNotify('error', 'Only the Super Admin can assign or revoke Administrator roles.');
      return;
    }
    if (selectedUser.userId === currentUid && roleDraft !== 'superadmin' && isSuperAdmin) {
      onNotify('error', 'You cannot demote your own active Super Admin session.');
      return;
    }

    try {
      setBusyAction(true);
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'users', selectedUser.userId), {
        role: roleDraft,
        updatedAt: now,
      });

      if (isSuperAdmin) {
        const adminDocRef = doc(db, 'admins', selectedUser.userId);
        if (roleDraft === 'admin' || roleDraft === 'superadmin') {
          await setDoc(
            adminDocRef,
            { userId: selectedUser.userId, email: selectedUser.email, role: roleDraft, updatedAt: now },
            { merge: true }
          );
        } else {
          await deleteDoc(adminDocRef).catch(() => {});
        }
      }

      await apiRequest(`/api/admin/members/${selectedUser.userId}`, {
        method: 'PATCH',
        requireAuth: true,
        body: { role: roleDraft },
      }).catch(() => {});

      await onLogAdminAction(
        'USER_ROLE_CHANGE',
        'User',
        selectedUser.userId,
        `Updated ${selectedUser.fullName} role from ${selectedUser.role} to ${roleDraft}`
      );

      setUsersList((prev) =>
        prev.map((u) => (u.userId === selectedUser.userId ? { ...u, role: roleDraft, updatedAt: now } : u))
      );
      setSelectedUser((prev) => (prev ? { ...prev, role: roleDraft } : null));
      onNotify('success', `Updated ${selectedUser.fullName}'s role to ${roleDraft}.`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to update role.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleSaveMemberProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      setBusyAction(true);
      const now = new Date().toISOString();
      const skillsArr = editSkills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const patch = {
        fullName: editName.trim(),
        college: editCollege.trim(),
        branch: editBranch.trim(),
        academicYear: editYear.trim(),
        technicalSkills: skillsArr,
      };

      await updateDoc(doc(db, 'users', selectedUser.userId), { ...patch, updatedAt: now }).catch(() => {});
      await apiRequest(`/api/admin/members/${selectedUser.userId}`, {
        method: 'PATCH',
        requireAuth: true,
        body: patch,
      });

      setUsersList((prev) =>
        prev.map((u) => (u.userId === selectedUser.userId ? { ...u, ...patch, updatedAt: now } : u))
      );
      setSelectedUser((prev) => (prev ? { ...prev, ...patch, updatedAt: now } : null));
      setEditMode(false);
      onNotify('success', `Updated profile details for ${patch.fullName}.`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Could not update member profile.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleAccountStatusChange = async (nextStatus: AccountStatus) => {
    if (!selectedUser) return;
    if (selectedUser.userId === currentUid && nextStatus === 'suspended') {
      onNotify('error', 'You cannot suspend your own Super Admin account.');
      return;
    }
    try {
      setBusyAction(true);
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'users', selectedUser.userId), {
        accountStatus: nextStatus,
        updatedAt: now,
      }).catch(() => {});
      await apiRequest(`/api/admin/members/${selectedUser.userId}`, {
        method: 'PATCH',
        requireAuth: true,
        body: { accountStatus: nextStatus },
      });
      await onLogAdminAction(
        nextStatus === 'suspended' ? 'MEMBER_SUSPENDED' : 'MEMBER_REACTIVATED',
        'User',
        selectedUser.userId,
        `Changed account status of ${selectedUser.fullName} to ${nextStatus}`
      );
      setUsersList((prev) =>
        prev.map((u) =>
          u.userId === selectedUser.userId ? { ...u, accountStatus: nextStatus, updatedAt: now } : u
        )
      );
      setSelectedUser((prev) => (prev ? { ...prev, accountStatus: nextStatus, updatedAt: now } : null));
      onNotify('success', `${selectedUser.fullName} marked as ${nextStatus}.`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Could not update account status.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleDirectApproveMember = async () => {
    if (!selectedUser) return;
    try {
      setBusyAction(true);
      const res = await apiRequest('/api/admin/members/approve', {
        method: 'POST',
        requireAuth: true,
        body: { userUid: selectedUser.userId, adminNotes: 'Approved by ESC Admin from Members Console' },
      });
      const now = new Date().toISOString();
      const escMemberId = res.escMemberId || '';

      await updateDoc(doc(db, 'users', selectedUser.userId), {
        membershipStatus: 'approved',
        role: ['superadmin', 'admin', 'project_lead', 'lead', 'mentor'].includes(selectedUser.role)
          ? selectedUser.role
          : 'member',
        escMemberId,
        accountStatus: 'active',
        approvalDate: now,
        updatedAt: now,
      }).catch(() => {});

      const appsSnap = await getDocs(
        query(collection(db, 'applications'), where('userId', '==', selectedUser.userId))
      ).catch(() => null);
      if (appsSnap && !appsSnap.empty) {
        await updateDoc(doc(db, 'applications', appsSnap.docs[0].id), {
          status: 'approved',
          approvalDate: now,
          updatedAt: now,
        }).catch(() => {});
      }

      onNotify('success', `Approved ${selectedUser.fullName} • Issued Member ID ${escMemberId}.`);
      await onRefreshAll();
      await openMemberDrawer({
        ...selectedUser,
        membershipStatus: 'approved',
        escMemberId,
        accountStatus: 'active',
        approvalDate: now,
      });
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to approve member.');
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* 7 Category Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORY_TABS.map((tab) => {
          const active = category === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setCategory(tab.key)}
              className={`rounded-xl px-3.5 py-2 text-xs font-mono font-semibold transition-all cursor-pointer border ${
                active
                  ? 'bg-[#CCFF00] text-black border-[#CCFF00]'
                  : 'bg-[#12141a] text-zinc-300 border-[#242834] hover:border-[#CCFF00]/50 hover:text-white'
              }`}
            >
              {tab.label} ({categoryCounts[tab.key]})
            </button>
          );
        })}
      </div>

      {/* Search + CSV */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-[#232731] bg-[#121419] p-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8e919b]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, Member ID (ESC-2026-...), college, branch, or skills..."
            className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] pl-10 pr-4 py-2 text-xs text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={onExportCSV}
          className="flex items-center gap-1.5 rounded-xl border border-[#2f333f] bg-[#17191e] px-3.5 py-2 text-xs font-mono text-white hover:border-[#CCFF00] hover:text-[#CCFF00] cursor-pointer shrink-0"
        >
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      </div>

      {/* Members Table */}
      {filteredUsers.length === 0 ? (
        <div className="rounded-2xl border border-[#232731] bg-[#111317] p-12 text-center space-y-2">
          <Users className="h-8 w-8 text-zinc-600 mx-auto" />
          <p className="text-xs text-zinc-400">No members match this category or search query.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#232731] bg-[#111317] overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#1f2229] bg-[#161820] text-zinc-400 font-mono text-[11px] uppercase">
              <tr>
                <th className="px-5 py-3">Member & ESC ID</th>
                <th className="px-5 py-3">College & Branch</th>
                <th className="px-5 py-3">Role & Membership</th>
                <th className="px-5 py-3">Account</th>
                <th className="px-5 py-3">Activity</th>
                <th className="px-5 py-3 text-right">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1c1f26]">
              {filteredUsers.map((u) => {
                const effectiveAccount = resolveAccountStatus(u);
                const memberPhoto = u.profilePhotoUrl || u.photoURL;
                return (
                  <tr key={u.userId} className="hover:bg-[#14161d] transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {memberPhoto ? (
                          <img
                            src={memberPhoto}
                            alt={u.fullName}
                            className="h-9 w-9 rounded-full object-cover border border-[#39FF14]/45"
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1e222b] text-xs font-bold text-[#CCFF00]">
                            {(u.fullName || 'U')[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-white flex items-center gap-2">
                            <span>{u.fullName}</span>
                            {u.escMemberId && (
                              <span className="rounded bg-[#CCFF00]/15 border border-[#CCFF00]/40 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#CCFF00]">
                                {u.escMemberId}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#8e919b]">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-zinc-200">{u.college || '—'}</div>
                      <div className="text-[11px] font-mono text-zinc-400">
                        {u.branch ? `${u.branch}${u.academicYear ? ` • ${u.academicYear}` : ''}` : 'Not provided'}
                      </div>
                    </td>
                    <td className="px-5 py-4 space-y-1">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase font-semibold border ${
                          u.role === 'superadmin'
                            ? 'bg-[#CCFF00]/15 border-[#CCFF00]/50 text-[#CCFF00]'
                            : u.role === 'admin'
                            ? 'bg-purple-950/50 border-purple-700 text-purple-300'
                            : u.role === 'member'
                            ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                        }`}
                      >
                        {u.role.replace('_', ' ')}
                      </span>
                      <div className="font-mono text-[10px] text-zinc-400 capitalize">
                        {(u.membershipStatus || 'unregistered').replace('_', ' ')}
                      </div>
                    </td>
                    <td className="px-5 py-4 space-y-1">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase font-semibold border ${
                          effectiveAccount === 'suspended'
                            ? 'bg-red-950/50 border-red-800 text-red-300'
                            : effectiveAccount === 'expired'
                            ? 'bg-orange-950/50 border-orange-700 text-orange-300'
                            : effectiveAccount === 'inactive'
                            ? 'bg-amber-950/40 border-amber-700 text-amber-300'
                            : 'bg-emerald-950/40 border-emerald-700 text-emerald-300'
                        }`}
                      >
                        {effectiveAccount}
                      </span>
                      <div className="font-mono text-[10px]">
                        {u.memberCardGeneratedAt ? (
                          <span className="text-[#39FF14]">Card Issued</span>
                        ) : u.profilePhotoUrl ? (
                          <span className="text-zinc-300">Photo Ready</span>
                        ) : (
                          <span className="text-zinc-500">No Photo</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-[11px] text-zinc-400">
                      <div>Reg: {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</div>
                      <div className="text-zinc-500">
                        Seen: {u.lastActiveAt || u.lastLoginAt ? new Date(u.lastActiveAt || u.lastLoginAt || '').toLocaleDateString() : '—'}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => openMemberDrawer(u)}
                        className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-1.5 font-semibold text-[#CCFF00] hover:bg-[#CCFF00] hover:text-black transition-colors cursor-pointer"
                      >
                        Inspect 360
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Member 360 Detail Drawer / Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-3xl rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-6 shadow-2xl my-8 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-[#23262d] pb-4 gap-4">
              <div className="flex items-center gap-3">
                {selectedUser.profilePhotoUrl || selectedUser.photoURL ? (
                  <img
                    src={selectedUser.profilePhotoUrl || selectedUser.photoURL}
                    alt={selectedUser.fullName}
                    className="h-12 w-12 rounded-xl object-cover border border-[#39FF14]/50"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-xl bg-[#1a1d24] flex items-center justify-center font-bold text-[#CCFF00]">
                    {(selectedUser.fullName || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-bold text-white">{selectedUser.fullName}</h3>
                    {selectedUser.escMemberId && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#CCFF00]/15 border border-[#CCFF00]/40 px-2 py-0.5 font-mono text-[11px] font-bold text-[#CCFF00]">
                        <BadgeCheck className="h-3.5 w-3.5" /> {selectedUser.escMemberId}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400">{selectedUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="text-zinc-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Action Quick Bar */}
            <div className="flex flex-wrap items-center gap-2.5">
              {selectedUser.membershipStatus !== 'approved' && (
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={handleDirectApproveMember}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#CCFF00] px-4 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] disabled:opacity-50 cursor-pointer"
                >
                  <UserCheck className="h-4 w-4" /> Approve & Issue ESC Member ID
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditMode((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#2b2f38] bg-[#161922] px-3.5 py-2 text-xs font-mono text-zinc-200 hover:border-[#CCFF00] cursor-pointer"
              >
                <Edit3 className="h-3.5 w-3.5" /> {editMode ? 'Cancel Edit' : 'Edit Profile'}
              </button>

              <div className="flex items-center gap-1.5 rounded-xl border border-[#2b2f38] bg-[#141720] px-2.5 py-1.5 text-xs">
                <span className="font-mono text-[10px] uppercase text-zinc-400">Status:</span>
                {(['active', 'inactive', 'suspended', 'expired'] as AccountStatus[]).map((st) => {
                  const isCurrent = (selectedUser.accountStatus || 'active') === st;
                  const disabledSelfSuspend = selectedUser.userId === currentUid && st === 'suspended';
                  return (
                    <button
                      key={st}
                      type="button"
                      disabled={busyAction || isCurrent || disabledSelfSuspend}
                      onClick={() => handleAccountStatusChange(st)}
                      className={`rounded-lg px-2 py-1 font-mono text-[10px] uppercase font-bold transition-colors cursor-pointer disabled:cursor-default ${
                        isCurrent
                          ? st === 'active'
                            ? 'bg-[#39FF14] text-black'
                            : st === 'suspended'
                              ? 'bg-red-600 text-white'
                              : st === 'expired'
                                ? 'bg-orange-600 text-white'
                                : 'bg-amber-500 text-black'
                          : 'text-zinc-400 hover:text-white hover:bg-[#1e222e] disabled:opacity-40'
                      }`}
                    >
                      {st}
                    </button>
                  );
                })}
              </div>
            </div>

            {editMode ? (
              <form onSubmit={handleSaveMemberProfile} className="rounded-xl border border-[#CCFF00]/40 bg-[#14171f] p-4 space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-white mb-1">Full Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                      className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-white mb-1">College / University</label>
                    <input
                      type="text"
                      value={editCollege}
                      onChange={(e) => setEditCollege(e.target.value)}
                      className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-white mb-1">Engineering Branch</label>
                    <input
                      type="text"
                      value={editBranch}
                      onChange={(e) => setEditBranch(e.target.value)}
                      className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-white mb-1">Academic Year</label>
                    <input
                      type="text"
                      value={editYear}
                      onChange={(e) => setEditYear(e.target.value)}
                      className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Skills (comma-separated)</label>
                  <input
                    type="text"
                    value={editSkills}
                    onChange={(e) => setEditSkills(e.target.value)}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="submit"
                    disabled={busyAction}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#CCFF00] px-4 py-2 font-display text-xs font-bold uppercase text-black cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5" /> Save Changes
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-[#14161c] p-4 rounded-xl border border-[#232731]">
                <div>
                  <span className="text-zinc-500 font-mono text-[10px] uppercase block">ESC Member ID</span>
                  <span className="text-[#CCFF00] font-mono font-bold">{selectedUser.escMemberId || 'Not issued yet'}</span>
                </div>
                <div>
                  <span className="text-zinc-500 font-mono text-[10px] uppercase block">Approval Date</span>
                  <span className="text-white font-mono">
                    {selectedUser.approvalDate ? new Date(selectedUser.approvalDate).toLocaleDateString() : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 font-mono text-[10px] uppercase block">Account Status</span>
                  <span className="text-white uppercase font-mono">{resolveAccountStatus(selectedUser)}</span>
                </div>
                <div>
                  <span className="text-zinc-500 font-mono text-[10px] uppercase block">College</span>
                  <span className="text-white">{selectedUser.college || '—'}</span>
                </div>
                <div>
                  <span className="text-zinc-500 font-mono text-[10px] uppercase block">Branch & Year</span>
                  <span className="text-white">
                    {selectedUser.branch || '—'} {selectedUser.academicYear ? `(${selectedUser.academicYear})` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 font-mono text-[10px] uppercase block">Last Active</span>
                  <span className="text-white font-mono">
                    {selectedUser.lastActiveAt || selectedUser.lastLoginAt
                      ? new Date(selectedUser.lastActiveAt || selectedUser.lastLoginAt || '').toLocaleString()
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 font-mono text-[10px] uppercase block">Member Profile Photo</span>
                  <span className={selectedUser.profilePhotoUrl ? 'text-[#39FF14] font-mono font-semibold' : 'text-amber-300 font-mono'}>
                    {selectedUser.profilePhotoUrl ? 'Uploaded' : 'Not Uploaded'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-zinc-500 font-mono text-[10px] uppercase flex items-center gap-1">
                    <IdCard className="h-3 w-3 text-[#39FF14]" /> Digital Member Card Status
                  </span>
                  <span className="text-white font-mono">
                    {selectedUser.memberCardGeneratedAt
                      ? `Generated on ${new Date(selectedUser.memberCardGeneratedAt).toLocaleString()}`
                      : selectedUser.membershipStatus === 'approved' && selectedUser.profilePhotoUrl
                        ? 'Eligible (Not Yet Generated)'
                        : 'Pending Approval / Profile Photo'}
                  </span>
                </div>
              </div>
            )}

            {/* Skills */}
            {selectedUser.technicalSkills && selectedUser.technicalSkills.length > 0 && (
              <div className="text-xs space-y-1.5">
                <span className="font-mono text-[10px] text-zinc-500 uppercase">Technical Skills</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedUser.technicalSkills.map((sk, idx) => (
                    <span key={idx} className="rounded bg-[#1a1d24] px-2 py-0.5 font-mono text-[11px] text-zinc-200">
                      {sk}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 360 SQL Details: Startup Teams, Tasks, Reports, Chronological Activity */}
            <div className="space-y-4 border-t border-[#23262d] pt-4 text-xs">
              {detailLoading ? (
                <p className="font-mono text-zinc-400">Loading Startup Team, Tasks & Activity History...</p>
              ) : memberDetails ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Teams */}
                  <div className="rounded-xl border border-[#232731] bg-[#14161c] p-4 space-y-2">
                    <span className="font-mono text-[10px] uppercase text-[#CCFF00] block">Startup Team Participation</span>
                    {memberDetails.teams?.length === 0 ? (
                      <p className="text-zinc-500">Not assigned to a startup team yet.</p>
                    ) : (
                      memberDetails.teams.map((t: any) => (
                        <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg bg-[#1a1d25] p-2.5">
                          <div>
                            <div className="font-semibold text-white">{t.name}</div>
                            <div className="font-mono text-[10px] text-zinc-400">
                              {t.teamCode} • Role: {t.memberRole} • Status: {t.status}
                            </div>
                          </div>
                          {onOpenTeamById && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedUser(null);
                                onOpenTeamById(t.id);
                              }}
                              className="rounded-lg border border-[#2b2f38] px-2.5 py-1 text-[10px] font-mono text-[#CCFF00] hover:bg-[#CCFF00] hover:text-black cursor-pointer"
                            >
                              View Team
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Assigned Tasks */}
                  <div className="rounded-xl border border-[#232731] bg-[#14161c] p-4 space-y-2">
                    <span className="font-mono text-[10px] uppercase text-[#CCFF00] block">
                      Assigned Tasks ({memberDetails.tasks?.length || 0})
                    </span>
                    {!memberDetails.tasks || memberDetails.tasks.length === 0 ? (
                      <p className="text-zinc-500">No tasks assigned directly to this member.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {memberDetails.tasks.map((tk: any) => (
                          <div key={tk.id} className="flex items-center justify-between rounded-lg bg-[#1a1d25] px-2.5 py-1.5">
                            <span className="text-zinc-200 truncate">{tk.title}</span>
                            <span className="font-mono text-[10px] text-[#CCFF00] uppercase shrink-0 ml-2">
                              {tk.status.replace('_', ' ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Chronological Activity History */}
                  <div className="md:col-span-2 rounded-xl border border-[#232731] bg-[#14161c] p-4 space-y-2">
                    <span className="font-mono text-[10px] uppercase text-[#CCFF00] flex items-center gap-1.5">
                      <Clock className="h-3 w-3" /> Chronological Member Activity Log
                    </span>
                    {!memberDetails.activities || memberDetails.activities.length === 0 ? (
                      <p className="text-zinc-500">No member activities logged yet.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-44 overflow-y-auto">
                        {memberDetails.activities.slice(0, 15).map((act: any) => (
                          <div key={act.id} className="flex items-start justify-between gap-2 rounded-lg bg-[#191c24] px-3 py-2">
                            <div>
                              <span className="font-semibold text-white">{act.title}</span>
                              <p className="text-[11px] text-zinc-400">{act.details}</p>
                            </div>
                            <span className="font-mono text-[10px] text-zinc-500 shrink-0">
                              {new Date(act.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-zinc-500 font-mono">Additional team/task records appear after first member action.</p>
              )}
            </div>

            {/* Platform Role Management */}
            <div className="border-t border-[#23262d] pt-4 space-y-3 text-xs">
              <label className="block font-semibold text-white flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-[#CCFF00]" />
                Platform Role {!isSuperAdmin && '(Admin/Super Admin assignment locked to Super Admin)'}
              </label>
              <div className="flex items-center gap-3">
                <select
                  value={roleDraft}
                  onChange={(e) => setRoleDraft(e.target.value as UserRole)}
                  className="flex-1 rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                >
                  <option value="visitor">Visitor</option>
                  <option value="student">Student</option>
                  <option value="member">Member</option>
                  <option value="project_lead">Project Lead</option>
                  <option value="admin" disabled={!isSuperAdmin}>
                    Admin {isSuperAdmin ? '' : '(Super Admin Only)'}
                  </option>
                  <option value="superadmin" disabled={!isSuperAdmin}>
                    Super Admin {isSuperAdmin ? '' : '(Super Admin Only)'}
                  </option>
                </select>
                <button
                  type="button"
                  onClick={handleUpdateRole}
                  disabled={busyAction || roleDraft === selectedUser.role}
                  className="rounded-xl bg-[#CCFF00] px-4 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] disabled:opacity-40 cursor-pointer"
                >
                  {busyAction ? 'Saving...' : 'Update Role'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
