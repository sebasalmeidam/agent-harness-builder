import { NavLink } from 'react-router-dom';
import { Home, Users, FolderKanban, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}

interface SidebarProps {
  expanded?: boolean;
  onToggle?: () => void;
}

const navItems: NavItem[] = [
  { to: '/', icon: <Home size={20} />, label: 'Home' },
  { to: '/projects', icon: <FolderKanban size={20} />, label: 'Projects' },
  { to: '/teams', icon: <Users size={20} />, label: 'Teams' },
  { to: '/skills', icon: <Sparkles size={20} />, label: 'Skills' },
];

export default function Sidebar({
  expanded = false,
  onToggle,
}: SidebarProps) {
  return (
    <aside
      className={`fixed left-0 top-0 flex h-screen flex-col border-r border-border bg-bg-primary py-4 transition-all duration-200 ease-in-out ${
        expanded ? 'w-64 items-start px-3' : 'w-16 items-center'
      }`}
    >
      <div className={`mb-2 flex ${expanded ? 'w-full items-center justify-between px-1' : 'w-10 flex-col items-center gap-2'}`}>
        <div
          className={`flex h-10 items-center font-heading text-sm font-bold text-primary overflow-hidden whitespace-nowrap ${
            expanded ? 'flex-1' : 'w-10 justify-center'
          }`}
        >
          <span
            className={`transition-opacity duration-200 ${expanded ? 'opacity-0 w-0' : 'opacity-100'}`}
            aria-hidden={expanded}
          >
            AH
          </span>
          <span
            className={`transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0 w-0'}`}
            aria-hidden={!expanded}
          >
            Agent Harness
          </span>
        </div>
        <button
          onClick={onToggle}
          className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {expanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      <div className={`mb-4 h-px bg-border ${expanded ? 'w-full' : 'w-8'}`} />

      <nav className={`flex flex-col gap-2 ${expanded ? 'w-full' : 'items-center'}`}>
        {navItems.map((item) => {
          if (item.disabled) {
            return (
              <div
                key={item.label}
                className={`flex h-10 items-center rounded-md text-text-muted ${
                  expanded ? 'w-full gap-3 px-3' : 'w-10 justify-center'
                }`}
                title={item.label}
              >
                <span className="shrink-0">{item.icon}</span>
                {expanded && (
                  <span className="overflow-hidden whitespace-nowrap font-body text-sm">
                    {item.label}
                  </span>
                )}
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
                `flex h-10 items-center rounded-md transition-colors ${
                  expanded ? 'w-full gap-3 px-3' : 'w-10 justify-center'
                } ${
                  isActive
                    ? 'border-l-3 border-primary bg-primary-light text-primary'
                    : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                }`
              }
            >
              <span className="shrink-0">{item.icon}</span>
              <span
                className={`overflow-hidden whitespace-nowrap font-body text-sm transition-opacity duration-200 ${
                  expanded ? 'opacity-100' : 'w-0 opacity-0'
                }`}
              >
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
