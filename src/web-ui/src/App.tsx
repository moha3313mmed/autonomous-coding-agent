import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeProvider';
import { AppLayout } from './components/layout/AppLayout';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

// Views
import { DashboardView } from './views/DashboardView';
import { TaskView } from './views/TaskView';
import { DAGView } from './views/DAGView';
import { AgentsView } from './views/AgentsView';
import { PerformanceView } from './views/PerformanceView';
import { SkillsView } from './views/SkillsView';
import { MemoryView } from './views/MemoryView';
import { TimelineView } from './views/TimelineView';
import { QualityView } from './views/QualityView';
import { RecoveryView } from './views/RecoveryView';
import { FeedbackView } from './views/FeedbackView';
import { SettingsView } from './views/SettingsView';

// i18n
import './i18n';

function AppContent() {
  // Register global keyboard shortcuts
  useKeyboardShortcuts();

  return (
    <BrowserRouter>
      <ThemeProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardView />} />
            <Route path="/tasks" element={<TaskView />} />
            <Route path="/dag" element={<DAGView />} />
            <Route path="/agents" element={<AgentsView />} />
            <Route path="/performance" element={<PerformanceView />} />
            <Route path="/skills" element={<SkillsView />} />
            <Route path="/memory" element={<MemoryView />} />
            <Route path="/timeline" element={<TimelineView />} />
            <Route path="/quality" element={<QualityView />} />
            <Route path="/recovery" element={<RecoveryView />} />
            <Route path="/feedback" element={<FeedbackView />} />
            <Route path="/settings" element={<SettingsView />} />
          </Route>
        </Routes>
      </ThemeProvider>
    </BrowserRouter>
  );
}

function App() {
  return <AppContent />;
}

export default App;
