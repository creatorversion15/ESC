import React, { useState } from 'react';
import { Bell, CheckCheck, ExternalLink, X } from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import type { PlatformNotification } from '../../types';

interface AdminNotificationCenterProps {
  notifications: PlatformNotification[];
  setNotifications: React.Dispatch<React.SetStateAction<PlatformNotification[]>>;
  onNavigateTarget: (tab: string, relatedId?: string) => void;
}

export const AdminNotificationCenter: React.FC<AdminNotificationCenterProps> = ({
  notifications,
  setNotifications,
  onNavigateTarget,
}) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkRead = async (notif: PlatformNotification) => {
    try {
      if (!notif.isRead) {
        await apiRequest(`/api/notifications/${notif.id}/read`, { method: 'PATCH', requireAuth: true });
        setNotifications((prev) =>
          prev.map((item) => (item.id === notif.id ? { ...item, isRead: true } : item))
        );
      }
      if (notif.linkTab) {
        onNavigateTarget(notif.linkTab, notif.relatedTeamId || notif.relatedMemberUid);
        setOpen(false);
      }
    } catch {
      // non-blocking
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setBusy(true);
      await apiRequest('/api/admin/notifications/read-all', { method: 'PATCH', requireAuth: true });
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex items-center gap-1.5 rounded-xl border border-[#2b2f38] bg-[#14161c] px-3.5 py-2 text-xs font-mono text-zinc-200 hover:border-[#CCFF00] hover:text-white cursor-pointer"
        aria-label="Admin Notification Center"
      >
        <Bell className="h-4 w-4 text-[#CCFF00]" />
        <span className="hidden sm:inline">Notifications</span>
        {unreadCount > 0 && (
          <span className="ml-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#CCFF00] px-1.5 py-0.5 text-[10px] font-bold text-black">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[340px] sm:w-[400px] z-50 rounded-2xl border border-[#2b2f38] bg-[#101217] shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#1f2229] px-4 py-3">
            <div>
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-white">
                Admin Notification Centre
              </h4>
              <p className="font-mono text-[10px] text-zinc-400">
                {unreadCount} unread alerts
              </p>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleMarkAllRead}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#2b2f38] px-2.5 py-1 text-[10px] font-mono text-[#CCFF00] hover:bg-[#1a1d24] cursor-pointer disabled:opacity-50"
                >
                  <CheckCheck className="h-3 w-3" /> Read All
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 text-zinc-400 hover:text-white cursor-pointer"
                aria-label="Close notifications"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto divide-y divide-[#1b1e25]">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500 font-mono">
                No admin alerts recorded yet.
              </div>
            ) : (
              notifications.slice(0, 30).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleMarkRead(n)}
                  className={`w-full text-left px-4 py-3 transition-colors hover:bg-[#161922] cursor-pointer ${
                    !n.isRead ? 'bg-[#141815]' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {!n.isRead && (
                        <span className="h-2 w-2 rounded-full bg-[#CCFF00] shrink-0" />
                      )}
                      <span className="text-xs font-semibold text-white">{n.title}</span>
                    </div>
                    <span className="font-mono text-[10px] text-zinc-500 shrink-0">
                      {n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2">{n.description}</p>
                  <div className="flex items-center justify-between mt-1.5 font-mono text-[10px] text-zinc-500">
                    <span className="uppercase text-[#CCFF00]/80">{n.type.replace('_', ' ')}</span>
                    {n.linkTab && (
                      <span className="inline-flex items-center gap-1 text-zinc-300">
                        Open <ExternalLink className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
