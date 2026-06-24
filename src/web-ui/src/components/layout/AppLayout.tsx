import { Outlet } from 'react-router-dom';
import { NavigationSidebar } from './NavigationSidebar';
import { TopBar } from './TopBar';
import { useNavigationStore } from '../../stores/navigation-store';

export function AppLayout() {
  const { sidebarCollapsed } = useNavigationStore();

  return (
    <div className="flex h-screen overflow-hidden bg-dark-primary">
      {/* Sidebar */}
      <NavigationSidebar />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />

        {/* Page content */}
        <main
          className={`
            flex-1 overflow-y-auto overflow-x-hidden
            p-4 lg:p-6
            transition-all duration-normal ease-smooth
          `}
        >
          <div className="max-w-[1800px] mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
