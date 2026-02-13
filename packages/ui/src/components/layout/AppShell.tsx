import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function AppShell() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        expanded={expanded}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      />
      <main
        className={`flex-1 bg-bg-secondary px-10 pt-8 transition-all duration-200 ease-in-out ${
          expanded ? 'ml-64' : 'ml-16'
        }`}
      >
        <Outlet />
      </main>
    </div>
  );
}
