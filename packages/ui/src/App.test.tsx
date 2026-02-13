import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { test, expect } from 'vitest';
import App from './App';

test('redirects / to /teams and renders Teams heading', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  );
  expect(screen.getByText('Teams')).toBeTruthy();
});

test('renders Teams page when navigating to /teams', () => {
  render(
    <MemoryRouter initialEntries={['/teams']}>
      <App />
    </MemoryRouter>,
  );
  expect(screen.getByText('Teams')).toBeTruthy();
});

test('renders sidebar navigation', () => {
  render(
    <MemoryRouter initialEntries={['/teams']}>
      <App />
    </MemoryRouter>,
  );
  expect(screen.getByTitle('Home')).toBeTruthy();
  expect(screen.getByTitle('Teams')).toBeTruthy();
  expect(screen.getByTitle('Projects')).toBeTruthy();
});
