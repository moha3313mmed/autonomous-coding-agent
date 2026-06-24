import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '../stores/theme-store';
import { useNavigationStore } from '../stores/navigation-store';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const setActiveView = useNavigationStore((state) => state.setActiveView);

  useEffect(() => {
    const shortcuts: ShortcutConfig[] = [
      {
        key: '1',
        ctrl: true,
        description: 'Go to Dashboard',
        action: () => {
          setActiveView('dashboard');
          navigate('/');
        },
      },
      {
        key: '2',
        ctrl: true,
        description: 'Go to Tasks',
        action: () => {
          setActiveView('tasks');
          navigate('/tasks');
        },
      },
      {
        key: '3',
        ctrl: true,
        description: 'Go to DAG View',
        action: () => {
          setActiveView('dag');
          navigate('/dag');
        },
      },
      {
        key: '4',
        ctrl: true,
        description: 'Go to Agents',
        action: () => {
          setActiveView('agents');
          navigate('/agents');
        },
      },
      {
        key: 't',
        ctrl: true,
        shift: true,
        description: 'Toggle Theme',
        action: () => {
          toggleTheme();
        },
      },
      {
        key: 'n',
        ctrl: true,
        description: 'New Task',
        action: () => {
          setActiveView('tasks');
          navigate('/tasks');
        },
      },
      {
        key: 'k',
        ctrl: true,
        description: 'Quick Search',
        action: () => {
          // Global search - placeholder for now
          // Will open a command palette / search modal
        },
      },
    ];

    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : true;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
          // Only match if ctrl is required and pressed
          if (shortcut.ctrl && !(event.ctrlKey || event.metaKey)) continue;

          event.preventDefault();
          shortcut.action();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, toggleTheme, setActiveView]);
}
