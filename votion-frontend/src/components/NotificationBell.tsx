import React, { useState, useEffect, useRef } from 'react';
import { Bell, X } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { useToast } from './ToastContext';

interface Notification {
  id: number;
  title: string;
  message: string;
  severity: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationBellProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ open, onToggle, onClose }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isClearing, setIsClearing] = useState(false);
  const { showToast } = useToast();
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const res = await apiClient.getNotifications(false);
      if (res?.success) {
        setNotifications(res.data || []);
        setUnreadCount(Number(res.unreadCount || 0));
      }
    } catch {
      // Silent — bell should never break the header
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      load();
    }, 10000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleMarkAllRead = async () => {
    try {
      await apiClient.markNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const handleClear = async () => {
    if (isClearing || notifications.length === 0) return;
    setIsClearing(true);
    try {
      await apiClient.clearNotifications();
      setNotifications([]);
      setUnreadCount(0);
      showToast('All notifications cleared.');
    } catch {
      showToast('Unable to clear notifications. Please try again.');
    } finally {
      setIsClearing(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiClient.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch {
      // ignore
    }
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const severityColor = (sev: string) =>
    sev === 'critical' ? 'text-[#dc2626] bg-[#fef2f2] border-[#fecaca]' :
    sev === 'info' ? 'text-[#2563eb] bg-[#eff6ff] border-[#bfdbfe]' :
    'text-[#b45309] bg-[#fffbeb] border-[#fde68a]';

  return (
    <div className="header-notification-wrap relative" ref={ref}>
      <button
        onClick={onToggle}
        className={`header-notification-control relative cursor-pointer ${open ? 'is-open' : ''}`}
        title="Alert notifications"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell size={16} strokeWidth={1.8} aria-hidden="true" />
        <span>Alerts</span>
        {unreadCount > 0 && (
          <span className="notification-count" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-panel">
          <div className="notification-panel-header">
            <span className="notification-panel-title">
              Alert notifications{unreadCount > 0 ? ` · ${unreadCount} unread` : ''}
            </span>
            <div className="notification-panel-actions">
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="notification-panel-action notification-panel-action-primary">
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={handleClear}
                  disabled={isClearing}
                  className="notification-panel-action notification-panel-action-danger"
                >
                  {isClearing ? 'Clearing…' : 'Clear'}
                </button>
              )}
            </div>
          </div>

          <div className="notification-panel-body">
            {notifications.length === 0 ? (
              <div className="notification-empty-state">
                <span className="notification-empty-mark" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m5 12 4 4L19 7" /></svg>
                </span>
                <p className="notification-empty-title">No active notifications</p>
                <p className="notification-empty-description">Triggered alerts will appear here.</p>
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id} className={`px-4 py-3 flex gap-2.5 ${n.isRead ? '' : 'bg-[#fbfaf9]'}`}>
                  <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${n.severity === 'critical' ? 'bg-[#dc2626]' : n.severity === 'info' ? 'bg-[#2563eb]' : 'bg-[#f59e0b]'}`}></span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <span className={`text-[11px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${severityColor(n.severity)}`}>
                        {n.severity}
                      </span>
                      <span className="text-[10px] text-[#a7aaaa] whitespace-nowrap">{timeAgo(n.createdAt)}</span>
                    </div>
                    <p className="text-xs font-bold text-[#1a1a1a] mt-1">{n.title}</p>
                    <p className="text-[11px] text-[#656b6b] mt-0.5 leading-snug">{n.message}</p>
                  </div>
                  <button onClick={() => handleDelete(n.id)} className="notification-dismiss" title="Dismiss notification" aria-label={`Dismiss ${n.title}`}><X size={14} strokeWidth={1.8} aria-hidden="true" /></button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
