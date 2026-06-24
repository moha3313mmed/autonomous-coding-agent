import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { AnimatedPanel } from '../components/ui/AnimatedPanel';
import { useThemeStore } from '../stores/theme-store';
import { useI18nStore } from '../stores/i18n-store';

export function SettingsView() {
  const { t } = useTranslation('common');
  const { currentTheme, setTheme } = useThemeStore();
  const { locale, setLocale } = useI18nStore();
  const [wsUrl, setWsUrl] = useState('ws://localhost:8080/ws');

  const shortcuts = [
    { keys: 'Ctrl + 1', desc: 'Dashboard' },
    { keys: 'Ctrl + 2', desc: 'Tasks' },
    { keys: 'Ctrl + 3', desc: 'DAG View' },
    { keys: 'Ctrl + 4', desc: 'Agents' },
    { keys: 'Ctrl + 5', desc: 'Performance' },
    { keys: 'Ctrl + 6', desc: 'Skills' },
    { keys: 'Ctrl + 7', desc: 'Memory' },
    { keys: 'Ctrl + 8', desc: 'Timeline' },
    { keys: 'Ctrl + 9', desc: 'Quality' },
    { keys: 'Ctrl + Shift + T', desc: 'Toggle Theme' },
    { keys: 'Ctrl + N', desc: 'New Task' },
    { keys: 'Ctrl + K', desc: 'Quick Search' },
    { keys: 'Ctrl + ,', desc: 'Settings' },
    { keys: 'Escape', desc: 'Close Panel' },
  ];

  const systemInfo = [
    { label: 'Version', value: '2.4.0-beta.3' },
    { label: 'Runtime', value: 'Node.js 20.11.0' },
    { label: 'WebSocket Protocol', value: 'v2' },
    { label: 'Active Agents', value: '6' },
    { label: 'Uptime', value: '14h 23m' },
    { label: 'Memory Usage', value: '342 MB / 1024 MB' },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <AnimatedPanel variant="slideUp" duration={0.4}>
        <h1 className="text-2xl font-bold text-text-primary">{t('navigation.settings')}</h1>
      </AnimatedPanel>

      {/* Theme */}
      <AnimatedPanel variant="slideUp" delay={0.1}>
        <div className="glass-panel p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
            Appearance
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">Theme</p>
              <p className="text-xs text-text-muted mt-0.5">Choose your preferred color scheme</p>
            </div>
            <div className="flex items-center gap-2 bg-dark-primary rounded-lg p-1">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setTheme('dark')}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-fast
                  ${currentTheme === 'dark'
                    ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/20'
                    : 'text-text-secondary hover:text-text-primary'
                  }
                `}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                Dark
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setTheme('light')}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-fast
                  ${currentTheme === 'light'
                    ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/20'
                    : 'text-text-secondary hover:text-text-primary'
                  }
                `}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Light
              </motion.button>
            </div>
          </div>

          {/* Live Preview */}
          <div className="mt-4 p-3 rounded-lg bg-dark-primary border border-dark-tertiary">
            <p className="text-[10px] text-text-muted mb-2">Preview</p>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent-primary/20 border border-accent-primary/30" />
              <div className="flex-1">
                <div className="h-2 bg-dark-tertiary rounded w-24 mb-1.5" />
                <div className="h-1.5 bg-dark-tertiary rounded w-16" />
              </div>
              <div className="w-12 h-5 rounded bg-accent-primary/30" />
            </div>
          </div>
        </div>
      </AnimatedPanel>

      {/* Language */}
      <AnimatedPanel variant="slideUp" delay={0.15}>
        <div className="glass-panel p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            Language & Direction
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">Interface Language</p>
              <p className="text-xs text-text-muted mt-0.5">Instantly switches text direction for RTL languages</p>
            </div>
            <div className="flex items-center gap-2 bg-dark-primary rounded-lg p-1">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setLocale('en')}
                className={`
                  px-4 py-2 rounded-md text-sm font-medium transition-all duration-fast
                  ${locale === 'en'
                    ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/20'
                    : 'text-text-secondary hover:text-text-primary'
                  }
                `}
              >
                English
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setLocale('ar')}
                className={`
                  px-4 py-2 rounded-md text-sm font-medium transition-all duration-fast
                  ${locale === 'ar'
                    ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/20'
                    : 'text-text-secondary hover:text-text-primary'
                  }
                `}
              >
                العربية
              </motion.button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="text-[10px] text-text-muted">Current direction:</span>
            <span className="text-[10px] font-mono text-accent-primary bg-accent-primary/10 px-2 py-0.5 rounded">
              {locale === 'ar' ? 'RTL' : 'LTR'}
            </span>
          </div>
        </div>
      </AnimatedPanel>

      {/* WebSocket Connection */}
      <AnimatedPanel variant="slideUp" delay={0.2}>
        <div className="glass-panel p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            WebSocket Connection
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-text-muted mb-1.5 block">Connection URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={wsUrl}
                  onChange={(e) => setWsUrl(e.target.value)}
                  className="flex-1 px-3 py-2 bg-dark-primary border border-dark-tertiary rounded-lg text-sm font-mono text-text-primary focus:outline-none focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/20 transition-all duration-fast"
                />
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-accent-primary/10 text-accent-primary border border-accent-primary/20 hover:bg-accent-primary/20 transition-all"
                >
                  Reconnect
                </motion.button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-status-completed animate-pulse" />
              <span className="text-xs text-status-completed">Connected</span>
              <span className="text-[10px] text-text-muted ms-2">Latency: 12ms</span>
            </div>
          </div>
        </div>
      </AnimatedPanel>

      {/* Keyboard Shortcuts */}
      <AnimatedPanel variant="slideUp" delay={0.25}>
        <div className="glass-panel p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Keyboard Shortcuts
          </h2>
          <div className="grid grid-cols-1 tablet:grid-cols-2 gap-1">
            {shortcuts.map(({ keys, desc }, i) => (
              <motion.div
                key={keys}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-dark-primary/50 transition-colors"
              >
                <span className="text-xs text-text-secondary">{desc}</span>
                <kbd className="px-2 py-1 bg-dark-primary border border-dark-tertiary rounded text-[10px] font-mono text-text-muted shadow-sm">
                  {keys}
                </kbd>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedPanel>

      {/* System Information */}
      <AnimatedPanel variant="slideUp" delay={0.3}>
        <div className="glass-panel p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
            System Information
          </h2>
          <div className="grid grid-cols-1 tablet:grid-cols-2 gap-3">
            {systemInfo.map((info, i) => (
              <motion.div
                key={info.label}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center justify-between p-3 rounded-lg bg-dark-primary/50"
              >
                <span className="text-xs text-text-muted">{info.label}</span>
                <span className="text-xs font-mono text-text-primary">{info.value}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedPanel>
    </div>
  );
}
