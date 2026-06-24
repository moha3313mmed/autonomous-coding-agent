import { create } from 'zustand';

interface ThemeSlice {
  currentTheme: 'dark' | 'light';
  toggleTheme: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
}

export const useThemeStore = create<ThemeSlice>((set) => ({
  currentTheme: 'dark',

  toggleTheme: () =>
    set((state) => {
      const newTheme = state.currentTheme === 'dark' ? 'light' : 'dark';
      applyThemeToDocument(newTheme);
      return { currentTheme: newTheme };
    }),

  setTheme: (theme: 'dark' | 'light') =>
    set(() => {
      applyThemeToDocument(theme);
      return { currentTheme: theme };
    }),
}));

function applyThemeToDocument(theme: 'dark' | 'light'): void {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

// Initialize dark theme on load
if (typeof document !== 'undefined') {
  document.documentElement.classList.add('dark');
}
