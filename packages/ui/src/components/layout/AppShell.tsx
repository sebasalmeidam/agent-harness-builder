import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function AppShell() {
  const [expanded, setExpanded] = useState(() => {
    const stored = localStorage.getItem('sidebar-expanded');
    return stored === 'true';
  });

  const handleToggle = () => {
    setExpanded((prev) => {
      const newValue = !prev;
      localStorage.setItem('sidebar-expanded', String(newValue));
      return newValue;
    });
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar
        expanded={expanded}
        onToggle={handleToggle}
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
