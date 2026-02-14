import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import App from '../App';
import LandingPage from './LandingPage';

// Mock fetch for App-level tests (DashboardPage fetches data)
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

describe('LandingPage', () => {
  test('renders at /landing route via App component', () => {
    render(
      <MemoryRouter initialEntries={['/landing']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText('AI Team Orchestration')).toBeTruthy();
  });

  test('no sidebar is present on the landing page', () => {
    render(
      <MemoryRouter initialEntries={['/landing']}>
        <App />
      </MemoryRouter>,
    );

    // Sidebar nav items use title attributes: "Home", "Projects", "Teams"
    expect(screen.queryByTitle('Home')).toBeNull();
    expect(screen.queryByTitle('Projects')).toBeNull();
    expect(screen.queryByTitle('Teams')).toBeNull();
  });

  test('navigation bar contains AH logo text and Get Started link', () => {
    render(
      <MemoryRouter initialEntries={['/landing']}>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('AH')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Get Started' })).toBeTruthy();
  });

  test('hero heading "AI Team Orchestration" renders', () => {
    render(
      <MemoryRouter initialEntries={['/landing']}>
        <LandingPage />
      </MemoryRouter>,
    );

    const heading = screen.getByRole('heading', {
      name: 'AI Team Orchestration',
    });
    expect(heading).toBeTruthy();
    expect(heading.className).toContain('font-heading');
    expect(heading.className).toContain('lg:text-[56px]');
    expect(heading.className).toContain('font-bold');
  });

  test('hero subheading "Design your AI agent team. Visually." renders', () => {
    render(
      <MemoryRouter initialEntries={['/landing']}>
        <LandingPage />
      </MemoryRouter>,
    );

    const subheading = screen.getByRole('heading', {
      name: 'Design your AI agent team. Visually.',
    });
    expect(subheading).toBeTruthy();
    expect(subheading.className).toContain('font-heading');
    expect(subheading.className).toContain('lg:text-[48px]');
    expect(subheading.className).toContain('font-semibold');
  });

  test('all 3 checkmark bullet texts render', () => {
    render(
      <MemoryRouter initialEntries={['/landing']}>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByText('Visual canvas to design agent workflows'),
    ).toBeTruthy();
    expect(screen.getByText('Real-time execution monitoring')).toBeTruthy();
    expect(screen.getByText('No code required')).toBeTruthy();
  });

  test('"How it works" section title renders', () => {
    render(
      <MemoryRouter initialEntries={['/landing']}>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'How it works' }),
    ).toBeTruthy();
  });

  test('all 3 numbered column titles render with numbers', () => {
    render(
      <MemoryRouter initialEntries={['/landing']}>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('01')).toBeTruthy();
    expect(screen.getByText('02')).toBeTruthy();
    expect(screen.getByText('03')).toBeTruthy();

    expect(
      screen.getByRole('heading', { name: 'Design your team' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Define the workflow' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Run and watch' }),
    ).toBeTruthy();
  });

  test('"Built for real work" section title renders', () => {
    render(
      <MemoryRouter initialEntries={['/landing']}>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'Built for real work' }),
    ).toBeTruthy();
    expect(
      screen.getByText('Everything you need to orchestrate AI agent teams'),
    ).toBeTruthy();
  });

  test('all 6 feature card titles render', () => {
    render(
      <MemoryRouter initialEntries={['/landing']}>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Visual canvas editor')).toBeTruthy();
    expect(screen.getByText('Agent collaboration')).toBeTruthy();
    expect(screen.getByText('Live execution view')).toBeTruthy();
    expect(screen.getByText('Project based')).toBeTruthy();
    expect(screen.getByText('Reusable teams')).toBeTruthy();
    expect(screen.getByText('Instant setup')).toBeTruthy();
  });

  test('footer contains "Agent Harness" text and hackathon credit', () => {
    render(
      <MemoryRouter initialEntries={['/landing']}>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Agent Harness')).toBeTruthy();
    expect(screen.getByText('AI agents that work together.')).toBeTruthy();
    expect(
      screen.getByText('Built for Cloudflare AI Hackathon 2025'),
    ).toBeTruthy();
  });

  test('"Get Started" link points to "/" route', () => {
    render(
      <MemoryRouter initialEntries={['/landing']}>
        <LandingPage />
      </MemoryRouter>,
    );

    const getStartedLink = screen.getByRole('link', { name: 'Get Started' });
    expect(getStartedLink.getAttribute('href')).toBe('/');
  });

  test('How it Works grid has responsive column classes', () => {
    render(
      <MemoryRouter initialEntries={['/landing']}>
        <LandingPage />
      </MemoryRouter>,
    );

    const howItWorksHeading = screen.getByRole('heading', {
      name: 'How it works',
    });
    const gridContainer =
      howItWorksHeading.parentElement?.querySelector('.grid');
    expect(gridContainer).toBeTruthy();
    expect(gridContainer!.className).toContain('grid-cols-1');
    expect(gridContainer!.className).toContain('md:grid-cols-3');
  });

  test('Features grid has responsive column classes', () => {
    render(
      <MemoryRouter initialEntries={['/landing']}>
        <LandingPage />
      </MemoryRouter>,
    );

    const featuresHeading = screen.getByRole('heading', {
      name: 'Built for real work',
    });
    const gridContainer =
      featuresHeading.parentElement?.querySelector('.grid');
    expect(gridContainer).toBeTruthy();
    expect(gridContainer!.className).toContain('grid-cols-1');
    expect(gridContainer!.className).toContain('sm:grid-cols-2');
    expect(gridContainer!.className).toContain('lg:grid-cols-3');
  });

  test('all content renders correctly with responsive classes', () => {
    render(
      <MemoryRouter initialEntries={['/landing']}>
        <LandingPage />
      </MemoryRouter>,
    );

    // Hero content
    expect(screen.getByText('AI Team Orchestration')).toBeTruthy();
    expect(
      screen.getByText('Design your AI agent team. Visually.'),
    ).toBeTruthy();
    expect(
      screen.getByText('Visual canvas to design agent workflows'),
    ).toBeTruthy();

    // How it Works content
    expect(screen.getByText('01')).toBeTruthy();
    expect(screen.getByText('02')).toBeTruthy();
    expect(screen.getByText('03')).toBeTruthy();

    // Features content
    expect(screen.getByText('Visual canvas editor')).toBeTruthy();
    expect(screen.getByText('Agent collaboration')).toBeTruthy();
    expect(screen.getByText('Live execution view')).toBeTruthy();
    expect(screen.getByText('Project based')).toBeTruthy();
    expect(screen.getByText('Reusable teams')).toBeTruthy();
    expect(screen.getByText('Instant setup')).toBeTruthy();

    // Footer content
    expect(screen.getByText('Agent Harness')).toBeTruthy();
  });
});
