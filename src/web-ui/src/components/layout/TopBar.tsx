import { useNavigationStore } from '../../stores/navigation-store';
import { useThemeStore } from '../../stores/theme-store';
import { useTranslation } from 'react-i18next';
import { NotificationArea } from '../ui/NotificationArea';

export function TopBar() {
  const { t } = useTranslation('common');
  const { sidebarCollapsed, toggleSidebar, setMobileSidebarOpen } = useNavigationStore();
  const { currentTheme, toggleTheme } = useThemeStore();

  return (
    <header className="h-16 flex items-center justify-between px-4 lg:px-6 border-b border-dark-tertiary bg-dark-secondary/80 backdrop-blur-sm sticky top-0 z-30">
      {/* Left section */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          className="tablet:hidden p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-dark-tertiary transition-colors duration-fast"
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Desktop sidebar toggle */}
        <button
          className="hidden tablet:flex p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-dark-tertiary transition-colors duration-fast"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {sidebarCollapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
            )}
          </svg>
        </button>

        {/* Search shortcut hint */}
        <div className="hidden desktop:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-tertiary/50 border border-dark-tertiary text-text-muted text-xs cursor-pointer hover:border-accent-primary/30 transition-colors duration-fast">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span>{t('actions.search')}</span>
          <kbd className="px-1.5 py-0.5 rounded bg-dark-primary text-[10px] font-mono">Ctrl+K</kbd>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <NotificationArea />

        {/* Theme toggle */}
        <button
          className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-dark-tertiary transition-colors duration-fast"
          onClick={toggleTheme}
          aria-label={t('actions.toggleTheme')}
          title="Ctrl+Shift+T"
        >
          {currentTheme === 'dark' ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        {/* Connection status indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-tertiary/30">
          <div className="w-2 h-2 rounded-full bg-status-completed" />
          <span className="text-xs text-text-muted hidden tablet:inline">
            {t('status.connected')}
          </span>
        </div>
      </div>
    </header>
  );
}
