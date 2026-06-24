import { useNavigate, useLocation } from 'react-router-dom';
import { useNavigationStore, type ViewName } from '../../stores/navigation-store';
import { useTranslation } from 'react-i18next';

interface NavItem {
  id: ViewName;
  path: string;
  icon: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', path: '/', icon: '⬡' },
  { id: 'tasks', path: '/tasks', icon: '☰' },
  { id: 'dag', path: '/dag', icon: '◈' },
  { id: 'agents', path: '/agents', icon: '⬢' },
  { id: 'performance', path: '/performance', icon: '◉' },
  { id: 'skills', path: '/skills', icon: '⚡' },
  { id: 'memory', path: '/memory', icon: '◎' },
  { id: 'timeline', path: '/timeline', icon: '⏱' },
  { id: 'quality', path: '/quality', icon: '✓' },
  { id: 'recovery', path: '/recovery', icon: '↻' },
  { id: 'feedback', path: '/feedback', icon: '💬' },
  { id: 'settings', path: '/settings', icon: '⚙' },
];

export function NavigationSidebar() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarCollapsed, mobileSidebarOpen, setActiveView, setMobileSidebarOpen } =
    useNavigationStore();

  const handleNavClick = (item: NavItem) => {
    setActiveView(item.id);
    navigate(item.path);
    setMobileSidebarOpen(false);
  };

  const isActive = (item: NavItem) => {
    if (item.path === '/') return location.pathname === '/';
    return location.pathname.startsWith(item.path);
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm tablet:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full
          bg-dark-secondary border-r border-dark-tertiary
          transition-all duration-normal ease-smooth
          flex flex-col
          ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          tablet:translate-x-0 tablet:static
          ${sidebarCollapsed ? 'tablet:w-16' : 'tablet:w-64'}
        `}
      >
        {/* Logo area */}
        <div className="flex items-center h-16 px-4 border-b border-dark-tertiary">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-primary flex items-center justify-center text-white font-bold text-sm">
              A
            </div>
            {!sidebarCollapsed && (
              <span className="text-text-primary font-semibold text-sm whitespace-nowrap">
                Agent UI
              </span>
            )}
          </div>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                  transition-all duration-fast ease-smooth
                  group relative
                  ${
                    active
                      ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/20'
                      : 'text-text-secondary hover:text-text-primary hover:bg-dark-tertiary/50 border border-transparent'
                  }
                `}
                title={sidebarCollapsed ? t(`navigation.${item.id}`) : undefined}
              >
                <span className="text-lg flex-shrink-0 w-6 text-center">{item.icon}</span>
                {!sidebarCollapsed && (
                  <span className="text-sm font-medium truncate">
                    {t(`navigation.${item.id}`)}
                  </span>
                )}
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-accent-primary rounded-r" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="p-4 border-t border-dark-tertiary">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-status-completed animate-pulse-slow" />
            {!sidebarCollapsed && (
              <span className="text-xs text-text-muted">System Online</span>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
