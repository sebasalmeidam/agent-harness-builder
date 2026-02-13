import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

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
    expect(screen.getByRole('heading', { name: 'Teams' })).toBeTruthy();
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

test('error boundary renders fallback when a route component throws', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});

  function CrashingPage(): never {
    throw new Error('Route component crash');
  }

  render(
    <MemoryRouter initialEntries={['/crash']}>
      <ErrorBoundary>
        <Routes>
          <Route path="/crash" element={<CrashingPage />} />
        </Routes>
      </ErrorBoundary>
    </MemoryRouter>,
  );

  expect(screen.getByText('Something went wrong')).toBeTruthy();
  expect(screen.getByText('Go back to Dashboard')).toBeTruthy();
});
