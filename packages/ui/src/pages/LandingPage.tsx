import { Link } from 'react-router-dom';

const checkmarkBullets = [
  'Visual canvas to design agent workflows',
  'Real-time execution monitoring',
  'No code required',
];

const howItWorksSteps = [
  {
    number: '01',
    title: 'Design your team',
    description:
      'Drag agents onto the canvas and configure their roles, skills, and practices.',
  },
  {
    number: '02',
    title: 'Define the workflow',
    description:
      'Set relationships between agents: who passes work, who reviews, who escalates.',
  },
  {
    number: '03',
    title: 'Run and watch',
    description:
      'Give your team a task and watch them collaborate in real time.',
  },
];

const featureCards = [
  {
    title: 'Visual canvas editor',
    description:
      'Drag-and-drop interface to design your agent team on an interactive canvas.',
  },
  {
    title: 'Agent collaboration',
    description:
      'Define how agents pass work, review output, and escalate decisions.',
  },
  {
    title: 'Live execution view',
    description:
      'Watch your agents work in real time with status updates and activity logs.',
  },
  {
    title: 'Project based',
    description:
      'Organize work into projects with dedicated teams, tasks, and execution history.',
  },
  {
    title: 'Reusable teams',
    description:
      'Build agent teams once and assign them across multiple projects.',
  },
  {
    title: 'Instant setup',
    description:
      'No infrastructure needed. Create a project, assign a team, and run immediately.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg-primary px-4 py-4 sm:px-8">
        <span className="font-heading text-lg font-bold text-primary">AH</span>
        <Link
          to="/"
          className="rounded-md bg-primary px-4 py-2 font-body text-base font-semibold text-white transition-colors hover:opacity-90"
        >
          Get Started
        </Link>
      </nav>

      {/* Hero Section */}
      <section className="px-4 pt-[72px] pb-16 sm:px-8">
        <h1 className="font-heading text-3xl font-bold leading-tight text-black md:text-[48px] lg:text-[56px]">
          AI Team Orchestration
        </h1>
        <h2 className="mt-2 font-heading text-2xl font-semibold leading-tight text-black md:text-[36px] lg:text-[48px]">
          Design your AI agent team. Visually.
        </h2>
        <p className="mt-6 max-w-2xl font-body text-lg text-text-primary">
          Stop writing YAML configs. Start dragging nodes. Build teams of AI
          agents that collaborate, review each other's work, and execute real
          tasks.
        </p>
        <ul className="mt-6 flex flex-col gap-3">
          {checkmarkBullets.map((bullet) => (
            <li
              key={bullet}
              className="flex items-center gap-2 font-body text-base font-medium text-text-primary"
            >
              <svg
                className="h-5 w-5 shrink-0 text-primary"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              {bullet}
            </li>
          ))}
        </ul>
      </section>

      {/* How It Works Section */}
      <section className="px-4 py-16 sm:px-8">
        <h3 className="font-heading text-2xl font-semibold text-black">
          How it works
        </h3>
        <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3">
          {howItWorksSteps.map((step) => (
            <div key={step.number}>
              <span className="font-heading text-[20px] text-primary">
                {step.number}
              </span>
              <h4 className="mt-2 font-heading text-[20px] font-semibold text-black">
                {step.title}
              </h4>
              <p className="mt-2 font-body text-base text-text-secondary">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid Section */}
      <section className="px-4 py-16 sm:px-8">
        <h3 className="font-heading text-2xl font-semibold text-black">
          Built for real work
        </h3>
        <p className="mt-2 font-body text-lg text-text-secondary">
          Everything you need to orchestrate AI agent teams
        </p>
        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {featureCards.map((card) => (
            <div key={card.title} className="py-2">
              <h4 className="font-body text-lg font-medium text-text-primary">
                {card.title}
              </h4>
              <p className="mt-1 font-body text-[15px] text-text-secondary">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-12 text-center sm:px-8">
        <p className="font-heading text-lg font-semibold text-black">
          Agent Harness
        </p>
        <p className="mt-1 font-body text-base text-text-secondary">
          AI agents that work together.
        </p>
        <p className="mt-4 font-body text-sm text-text-muted">
          Built for Cloudflare AI Hackathon 2025
        </p>
      </footer>
    </div>
  );
}
