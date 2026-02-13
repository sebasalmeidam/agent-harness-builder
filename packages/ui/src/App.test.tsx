import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App';

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('renders DashboardPage at / with welcome header', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  );
  await waitFor(() => {
    expect(screen.getByText('Welcome back')).toBeTruthy();
  });
});

test('renders Teams page when navigating to /teams', async () => {
  render(
    <MemoryRouter initialEntries={['/teams']}>
      <App />
    </MemoryRouter>,
  );
  await waitFor(() => {
    expect(screen.getByText('Teams')).toBeTruthy();
  });
});

test('renders sidebar navigation', async () => {
  render(
    <MemoryRouter initialEntries={['/teams']}>
      <App />
    </MemoryRouter>,
  );
  await waitFor(() => {
    expect(screen.getByTitle('Home')).toBeTruthy();
    expect(screen.getByTitle('Teams')).toBeTruthy();
    expect(screen.getByTitle('Projects')).toBeTruthy();
  });
});
