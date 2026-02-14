import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, test, expect, vi } from 'vitest';
import Sidebar from './Sidebar';

function renderSidebar(props: {
  expanded?: boolean;
  onToggle?: () => void;
  route?: string;
} = {}) {
  const { route = '/', ...sidebarProps } = props;
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Sidebar {...sidebarProps} />
    </MemoryRouter>,
  );
}

describe('Sidebar', () => {
  test('renders at 64px width by default showing AH logo text', () => {
    renderSidebar();

    const aside = screen.getByRole('complementary');
    expect(aside.className).toContain('w-16');
    expect(aside.className).not.toContain('w-64');

    expect(screen.getByText('AH')).toBeTruthy();
  });

  test('shows icon-only navigation items when collapsed (no text labels visible)', () => {
    renderSidebar();

    const homeLabel = screen.getByText('Home');
    expect(homeLabel.className).toContain('opacity-0');
    expect(homeLabel.className).toContain('w-0');

    const projectsLabel = screen.getByText('Projects');
    expect(projectsLabel.className).toContain('opacity-0');
    expect(projectsLabel.className).toContain('w-0');

    const teamsLabel = screen.getByText('Teams');
    expect(teamsLabel.className).toContain('opacity-0');
    expect(teamsLabel.className).toContain('w-0');
  });

  test('toggle button renders with correct icon based on expanded state', () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/']}>
        <Sidebar expanded={false} />
      </MemoryRouter>,
    );

    const toggleButtonCollapsed = screen.getByLabelText('Expand sidebar');
    expect(toggleButtonCollapsed).toBeTruthy();

    rerender(
      <MemoryRouter initialEntries={['/']}>
        <Sidebar expanded={true} />
      </MemoryRouter>,
    );

    const toggleButtonExpanded = screen.getByLabelText('Collapse sidebar');
    expect(toggleButtonExpanded).toBeTruthy();
  });

  test('when expanded, sidebar has w-64 class and text labels are visible', () => {
    renderSidebar({ expanded: true });

    const aside = screen.getByRole('complementary');
    expect(aside.className).toContain('w-64');
    expect(aside.className).not.toContain('w-16');

    const homeLabel = screen.getByText('Home');
    expect(homeLabel.className).toContain('opacity-100');

    const projectsLabel = screen.getByText('Projects');
    expect(projectsLabel.className).toContain('opacity-100');

    const teamsLabel = screen.getByText('Teams');
    expect(teamsLabel.className).toContain('opacity-100');
  });

  test('clicking toggle button calls onToggle callback', () => {
    const handleToggle = vi.fn();
    renderSidebar({ onToggle: handleToggle });

    const toggleButton = screen.getByLabelText('Expand sidebar');
    fireEvent.click(toggleButton);

    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  test('logo text changes to Agent Harness when expanded and AH when collapsed', () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/']}>
        <Sidebar expanded={false} />
      </MemoryRouter>,
    );

    const ahText = screen.getByText('AH');
    expect(ahText.className).toContain('opacity-100');
    const agentHarnessCollapsed = screen.getByText('Agent Harness');
    expect(agentHarnessCollapsed.className).toContain('opacity-0');

    rerender(
      <MemoryRouter initialEntries={['/']}>
        <Sidebar expanded={true} />
      </MemoryRouter>,
    );

    const ahExpanded = screen.getByText('AH');
    expect(ahExpanded.className).toContain('opacity-0');
    const agentHarnessExpanded = screen.getByText('Agent Harness');
    expect(agentHarnessExpanded.className).toContain('opacity-100');
  });

  test('active route nav item has border-l-3 and border-primary classes', () => {
    renderSidebar({ route: '/projects' });

    const projectsLink = screen.getByTitle('Projects');
    expect(projectsLink.className).toContain('border-l-3');
    expect(projectsLink.className).toContain('border-primary');
    expect(projectsLink.className).toContain('bg-primary-light');

    const homeLink = screen.getByTitle('Home');
    expect(homeLink.className).not.toContain('border-l-3');
  });

  test('all three nav items link to correct routes', () => {
    renderSidebar();

    const homeLink = screen.getByTitle('Home');
    expect(homeLink.getAttribute('href')).toBe('/');

    const projectsLink = screen.getByTitle('Projects');
    expect(projectsLink.getAttribute('href')).toBe('/projects');

    const teamsLink = screen.getByTitle('Teams');
    expect(teamsLink.getAttribute('href')).toBe('/teams');
  });

  test('aside element has transition classes for animation', () => {
    renderSidebar();

    const aside = screen.getByRole('complementary');
    expect(aside.className).toContain('transition-all');
    expect(aside.className).toContain('duration-200');
    expect(aside.className).toContain('ease-in-out');
  });
});
