import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  type Notification, 
  getNotifications, 
  markNotificationRead, 
  markAllNotificationsRead
} from '../api';
import { useWebSocket } from '../context/WebSocketContext';
import { formatTimeAgo } from './TaskDetailModal';

const NotificationCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { addListener } = useWebSocket();

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await getNotifications(30);
      setNotifications(data);
    } catch (err) {
      console.error('Failed to load notifications', err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    // Re-fetch on any incoming notification WebSocket event
    const unsubscribe = addListener((event) => {
      if (
        event.type === 'NOTIFICATION_TRIGGERED' ||
        event.type === 'COMMENT_CREATED' ||
        event.type === 'TASK_CREATED'
      ) {
        fetchNotifications();
      }
    });

    return () => unsubscribe();
  }, [fetchNotifications, addListener]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAllRead = async () => {
    try {
      setLoading(true);
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Failed to mark all as read', err);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = async (notif: Notification) => {
    if (!notif.is_read) {
      try {
        await markNotificationRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
      } catch (err) {
        console.error('Failed to mark notification as read', err);
      }
    }
    setIsOpen(false);
    if (notif.link) {
      navigate(notif.link);
    }
  };

  return (
    <div className="notification-center-wrapper" ref={dropdownRef}>
      <button
        className="notification-bell-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Notifications"
        aria-label="Notifications"
      >
        <span style={{ fontSize: '1.2rem' }}>🔔</span>
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Notifications</span>
              {unreadCount > 0 && (
                <span className="badge badge-inprogress" style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem' }}>
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                className="btn-link"
                style={{ fontSize: '0.8rem', color: 'var(--primary)', cursor: 'pointer', background: 'none', border: 'none' }}
                onClick={handleMarkAllRead}
                disabled={loading}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="notification-list">
            {notifications.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-soft)', fontSize: '0.9rem' }}>
                ✨ No notifications yet
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`notification-item ${notif.is_read ? 'read' : 'unread'}`}
                  onClick={() => handleItemClick(notif)}
                >
                  <div className="notification-item-content">
                    <div className="flex justify-between items-center" style={{ marginBottom: '0.2rem' }}>
                      <span className="notification-item-title">{notif.title}</span>
                      <span className="notification-time">{formatTimeAgo(notif.created_at)}</span>
                    </div>
                    <p className="notification-item-message">{notif.message}</p>
                  </div>
                  {!notif.is_read && <span className="notification-unread-dot" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;

