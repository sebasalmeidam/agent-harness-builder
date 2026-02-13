import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function AppShell() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-16 flex-1 bg-bg-secondary px-10 pt-8">
        <Outlet />
      </main>
    </div>
  );
}
