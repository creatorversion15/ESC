import React, { useState } from 'react';
import {
  Bell,
  CheckCheck,
  Edit3,
  ExternalLink,
  Megaphone,
  Plus,
  Trash2,
} from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import type { Announcement, PlatformNotification } from '../../types';

interface AdminNotificationsPageProps {
  notifications: PlatformNotification[];
  setNotifications: React.Dispatch<React.SetStateAction<PlatformNotification[]>>;
  announcements: Announcement[];
  onOpenAnnouncementModal: (ann?: Announcement) => void;
  onToggleAnnouncementActive: (ann: Announcement) => Promise<void>;
  onDeleteAnnouncement: (ann: Announcement) => void;
  onNavigateTarget: (tab: string, relatedId?: string) => void;
}

export const AdminNotificationsPage: React.FC<AdminNotificationsPageProps> = ({
  notifications,
  setNotifications,
  announcements,
  onOpenAnnouncementModal,
  onToggleAnnouncementActive,
  onDeleteAnnouncement,
  onNavigateTarget,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all');
  const [busy, setBusy] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const displayedNotifications =
    filterMode === 'unread' ? notifications.filter((n) => !n.isRead) : notifications;

  const handleMarkRead = async (notif: PlatformNotification) => {
    try {
      if (!notif.isRead) {
        await apiRequest(`/api/notifications/${notif.id}/read`, {
          method: 'PATCH',
          requireAuth: true,
        });
        setNotifications((prev) =>
          prev.map((item) => (item.id === notif.id ? { ...item, isRead: true } : item))
        );
      }
      if (notif.linkTab) {
        onNavigateTarget(notif.linkTab, notif.relatedTeamId || notif.relatedMemberUid);
      }
    } catch {
      // Non-blocking
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setBusy(true);
      await apiRequest('/api/admin/notifications/read-all', {
        method: 'PATCH',
        requireAuth: true,
      });
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
      {/* Left 3 Columns: Admin Operational Alerts */}
      <div className="xl:col-span-3 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
              <Bell className="h-4 w-4 text-[#39FF14]" /> Admin Alerts &amp; Notifications
            </h3>
            <p className="text-xs text-[#8e919b] font-mono tabular-nums">
              {notifications.length} total alerts · {unreadCount} unread
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-[#262b36] bg-[#14171f] p-0.5">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`rounded-md px-3 py-1 text-xs font-medium cursor-pointer transition-colors ${
                  filterMode === 'all'
                    ? 'bg-[#39FF14] text-black font-semibold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('unread')}
                className={`rounded-md px-3 py-1 text-xs font-medium cursor-pointer transition-colors ${
                  filterMode === 'unread'
                    ? 'bg-[#39FF14] text-black font-semibold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#2b303d] bg-[#14171f] px-3 py-1.5 text-xs font-mono text-[#39FF14] hover:border-[#39FF14] cursor-pointer disabled:opacity-50"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark All Read
              </button>
            )}
          </div>
        </div>

        {displayedNotifications.length === 0 ? (
          <div className="rounded-2xl border border-[#222630] bg-[#101217] p-12 text-center space-y-2">
            <Bell className="h-8 w-8 text-zinc-600 mx-auto" />
            <p className="text-sm font-medium text-white">
              {filterMode === 'unread' ? 'All notifications are read' : 'No admin alerts recorded yet'}
            </p>
            <p className="text-xs text-zinc-400">
              New fellowship applications, startup team updates, support requests, and Problem Exchange submissions appear here automatically.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#222630] bg-[#101217] divide-y divide-[#1c2029] overflow-hidden">
            {displayedNotifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleMarkRead(n)}
                className={`w-full text-left px-5 py-4 transition-colors hover:bg-[#161a24] cursor-pointer ${
                  !n.isRead ? 'bg-[#121814]' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                      <span className="text-[#39FF14] uppercase font-semibold">
                        {n.type.replace('_', ' ')}
                      </span>
                      <span aria-hidden="true" className="text-zinc-600">·</span>
                      <span className={n.isRead ? 'text-zinc-500' : 'text-amber-300 font-semibold'}>
                        {n.isRead ? 'Read' : 'Unread'}
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-white">{n.title}</h4>
                    <p className="text-xs text-zinc-400 leading-relaxed">{n.description}</p>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="font-mono text-[11px] tabular-nums text-zinc-500 whitespace-nowrap">
                      {n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ''}
                    </span>
                    {n.linkTab && (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#39FF14]">
                        Open <ExternalLink className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right 2 Columns: Live Site Announcements Manager */}
      <div className="xl:col-span-2 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-[#39FF14]" /> Site Announcements
            </h3>
            <p className="text-xs text-[#8e919b]">
              Pinned alerts show in the top navbar; active banners show on the homepage.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenAnnouncementModal()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#39FF14] px-3.5 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#32e010] cursor-pointer shrink-0"
          >
            <Plus className="h-3.5 w-3.5" /> New
          </button>
        </div>

        {announcements.length === 0 ? (
          <div className="rounded-2xl border border-[#222630] bg-[#101217] p-10 text-center space-y-2">
            <Megaphone className="h-7 w-7 text-zinc-600 mx-auto" />
            <p className="text-xs text-zinc-400">No announcements published yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((ann) => (
              <div
                key={ann.id}
                className="rounded-2xl border border-[#222630] bg-[#101217] p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-[#39FF14] uppercase font-semibold">{ann.type}</span>
                    {ann.isPinned && (
                      <>
                        <span aria-hidden="true" className="text-zinc-600">·</span>
                        <span className="text-purple-300">Pinned Top Bar</span>
                      </>
                    )}
                    <span aria-hidden="true" className="text-zinc-600">·</span>
                    <span className={ann.isActive ? 'text-emerald-400' : 'text-zinc-500'}>
                      {ann.isActive ? 'Active' : 'Hidden'}
                    </span>
                  </div>
                  <span className="tabular-nums text-zinc-500">
                    {new Date(ann.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div>
                  <h4 className="font-display text-sm font-bold text-white">{ann.title}</h4>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{ann.message}</p>
                </div>

                <div className="flex items-center justify-between border-t border-[#1c2029] pt-2.5 text-xs">
                  <button
                    type="button"
                    onClick={() => onToggleAnnouncementActive(ann)}
                    className="font-mono text-[11px] text-zinc-300 hover:text-[#39FF14] cursor-pointer"
                  >
                    {ann.isActive ? 'Hide from Site' : 'Activate'}
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenAnnouncementModal(ann)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#2b2f38] px-2.5 py-1 text-[11px] text-[#39FF14] hover:bg-[#39FF14] hover:text-black cursor-pointer"
                    >
                      <Edit3 className="h-3 w-3" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteAnnouncement(ann)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 cursor-pointer"
                      aria-label={`Delete announcement ${ann.title}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
