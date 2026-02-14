import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import AppShell from './AppShell';

// Mock the Outlet component
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Outlet: () => <div data-testid="outlet">Outlet Content</div>,
  };
});

describe('AppShell', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('sidebar defaults to collapsed when no localStorage value exists', () => {
    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
    );

    const aside = screen.getByRole('complementary');
    expect(aside.className).toContain('w-16');
    expect(aside.className).not.toContain('w-64');
  });

  test('sidebar initializes from localStorage "true" value as expanded', () => {
    localStorage.setItem('sidebar-expanded', 'true');

    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
    );

    const aside = screen.getByRole('complementary');
    expect(aside.className).toContain('w-64');
    expect(aside.className).not.toContain('w-16');
  });

  test('sidebar initializes from localStorage "false" value as collapsed', () => {
    localStorage.setItem('sidebar-expanded', 'false');

    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
    );

    const aside = screen.getByRole('complementary');
    expect(aside.className).toContain('w-16');
    expect(aside.className).not.toContain('w-64');
  });

  test('clicking toggle button updates localStorage value from false to true', () => {
    localStorage.setItem('sidebar-expanded', 'false');

    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
    );

    const toggleButton = screen.getByLabelText('Expand sidebar');
    fireEvent.click(toggleButton);

    expect(localStorage.getItem('sidebar-expanded')).toBe('true');
  });

  test('clicking toggle button updates localStorage value from true to false', () => {
    localStorage.setItem('sidebar-expanded', 'true');

    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
    );

    const toggleButton = screen.getByLabelText('Collapse sidebar');
    fireEvent.click(toggleButton);

    expect(localStorage.getItem('sidebar-expanded')).toBe('false');
  });

  test('sidebar state survives simulated navigation (Outlet re-render)', () => {
    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
    );

    // Start collapsed
    let aside = screen.getByRole('complementary');
    expect(aside.className).toContain('w-16');

    // Expand
    const toggleButton = screen.getByLabelText('Expand sidebar');
    fireEvent.click(toggleButton);

    // Verify expanded
    aside = screen.getByRole('complementary');
    expect(aside.className).toContain('w-64');

    // Outlet should still be present (simulating navigation doesn't unmount AppShell)
    expect(screen.getByTestId('outlet')).toBeTruthy();

    // State should persist
    aside = screen.getByRole('complementary');
    expect(aside.className).toContain('w-64');
  });

  test('main content area adjusts margin based on sidebar state', () => {
    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
    );

    const main = screen.getByRole('main');
    expect(main.className).toContain('ml-16');
    expect(main.className).not.toContain('ml-64');

    const toggleButton = screen.getByLabelText('Expand sidebar');
    fireEvent.click(toggleButton);

    expect(main.className).toContain('ml-64');
    expect(main.className).not.toContain('ml-16');
  });
});
