import { NavLink } from 'react-router-dom';
import { Home, Users, FolderKanban } from 'lucide-react';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}

const navItems: NavItem[] = [
  { to: '/', icon: <Home size={20} />, label: 'Home' },
  { to: '#', icon: <FolderKanban size={20} />, label: 'Projects', disabled: true },
  { to: '/teams', icon: <Users size={20} />, label: 'Teams' },
];

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 flex h-screen w-16 flex-col items-center border-r border-border bg-bg-primary py-4">
      <div className="mb-4 flex h-10 w-10 items-center justify-center font-heading text-sm font-bold text-primary">
        AH
      </div>

      <div className="mb-4 h-px w-8 bg-border" />

      <nav className="flex flex-col items-center gap-2">
        {navItems.map((item) => {
          if (item.disabled) {
            return (
              <div
                key={item.label}
                className="flex h-10 w-10 items-center justify-center rounded-md text-text-muted"
                title={item.label}
              >
                {item.icon}
              </div>
            );
          }

          return (
            <NavLink
              key={item.label}
              to={item.to}
              title={item.label}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex h-10 w-10 items-center justify-center rounded-md transition ${
                  isActive
                    ? 'border-l-3 border-primary bg-primary-light text-primary'
                    : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                }`
              }
            >
              {item.icon}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
