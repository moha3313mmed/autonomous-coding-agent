import { useNavigationStore, type Notification } from '../../stores/navigation-store';
import { useState } from 'react';

function NotificationItem({ notification, onDismiss }: { notification: Notification; onDismiss: (id: string) => void }) {
  const typeStyles: Record<string, { icon: string; color: string; bgColor: string }> = {
    error: { icon: '✕', color: 'text-status-failed', bgColor: 'bg-status-failed/10' },
    warning: { icon: '!', color: 'text-status-warning', bgColor: 'bg-status-warning/10' },
    success: { icon: '✓', color: 'text-status-completed', bgColor: 'bg-status-completed/10' },
    info: { icon: 'i', color: 'text-accent-primary', bgColor: 'bg-accent-primary/10' },
  };

  const style = typeStyles[notification.type] || typeStyles.info;

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border border-dark-tertiary ${style.bgColor} transition-all duration-fast animate-fade-in`}>
      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${style.color} bg-dark-tertiary/50 flex-shrink-0 mt-0.5`}>
        {style.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{notification.title}</p>
        <p className="text-xs text-text-muted mt-0.5 truncate">{notification.message}</p>
      </div>
      <button
        onClick={() => onDismiss(notification.id)}
        className="text-text-muted hover:text-text-primary transition-colors duration-fast flex-shrink-0"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function NotificationArea() {
  const { notifications, dismissNotification } = useNavigationStore();
  const [isOpen, setIsOpen] = useState(false);

  const activeNotifications = notifications.filter((n) => !n.dismissed);
  const unreadCount = activeNotifications.length;

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        className="relative p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-dark-tertiary transition-colors duration-fast"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-status-failed text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-dark-secondary border border-dark-tertiary rounded-xl shadow-xl z-50 animate-fade-in">
            <div className="p-3 border-b border-dark-tertiary flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] text-text-muted bg-dark-tertiary px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="p-2 space-y-2">
              {activeNotifications.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-6">No notifications</p>
              ) : (
                activeNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onDismiss={dismissNotification}
                  />
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
