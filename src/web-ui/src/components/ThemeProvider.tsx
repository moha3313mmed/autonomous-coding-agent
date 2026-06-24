import { useEffect, type ReactNode } from 'react';
import { useThemeStore } from '../stores/theme-store';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const currentTheme = useThemeStore((state) => state.currentTheme);

  useEffect(() => {
    const root = document.documentElement;

    // Apply theme class
    if (currentTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Add transition class for smooth theme switching
    root.style.setProperty('transition', 'background-color 300ms ease, color 300ms ease');
  }, [currentTheme]);

  return (
    <div className="transition-theme min-h-screen bg-dark-primary text-text-primary">
      {children}
    </div>
  );
}
