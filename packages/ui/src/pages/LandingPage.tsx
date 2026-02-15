import { Link } from "react-router-dom";
import {
  CheckCircle,
  LayoutGrid,
  Link2,
  Play,
  GripHorizontal,
  Users,
  Activity,
  FolderKanban,
  RefreshCw,
  Zap,
} from "lucide-react";

const checkmarkBullets = [
  "Visual canvas to design agent workflows",
  "Real-time execution monitoring",
  "No code required",
];

const howItWorksSteps = [
  {
    number: "01",
    icon: LayoutGrid,
    title: "Design your team",
    description:
      "Drag agents onto the canvas. Connect them to define how they collaborate. Give each one a role and instructions.",
  },
  {
    number: "02",
    icon: Link2,
    title: "Define the workflow",
    description:
      "Set relationships between agents. Who passes work to whom. Who reviews. Who approves. All visual, no code.",
  },
  {
    number: "03",
    icon: Play,
    title: "Run and watch",
    description:
      "Give your team a task and watch them work in real-time. See every step, every handoff, every result.",
  },
];

const featureCards = [
  {
    icon: GripHorizontal,
    title: "Visual canvas editor",
    description:
      "Drag-and-drop interface to design your agent team on an interactive canvas.",
  },
  {
    icon: Users,
    title: "Agent collaboration",
    description:
      "Define how agents pass work, review output, and escalate decisions.",
  },
  {
    icon: Activity,
    title: "Live execution view",
    description:
      "Watch your agents work in real time with status updates and activity logs.",
  },
  {
    icon: FolderKanban,
    title: "Project based",
    description:
      "Organize work into projects with dedicated teams, tasks, and execution history.",
  },
  {
    icon: RefreshCw,
    title: "Reusable teams",
    description:
      "Build agent teams once and assign them across multiple projects.",
  },
  {
    icon: Zap,
    title: "Instant setup",
    description:
      "No infrastructure needed. Create a project, assign a team, and run immediately.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white px-6 py-4 sm:px-12">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Users className="h-4.5 w-4.5 text-primary" />
          </div>
          <span className="font-heading text-lg font-bold text-black">
            Agent Harness
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden font-body text-sm text-text-secondary sm:block">
            Claude Agent SDK Hackathon 2025
          </span>
          <a
            href="#quick-setup"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("quick-setup")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="rounded-lg bg-primary px-5 py-2 font-body text-sm font-semibold text-white transition-colors hover:bg-primary/90"
          >
            Get Started
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-bg-secondary">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-12 px-6 py-20 sm:px-12 lg:flex-row lg:gap-16 lg:py-24">
          {/* Left: Text */}
          <div className="flex-1">
            <p className="font-body text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              AI Team Orchestration
            </p>
            <h1 className="mt-4 font-heading text-4xl font-bold leading-[1.1] text-black md:text-5xl lg:text-[56px]">
              Design your AI agent team. Visually.
            </h1>
            <p className="mt-6 max-w-lg font-body text-lg leading-relaxed text-text-secondary">
              Stop writing configs. Start dragging nodes. Build teams of AI
              agents that collaborate, review each other&apos;s work, and execute
              real tasks.
            </p>
            <ul className="mt-8 flex flex-col gap-3">
              {checkmarkBullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex items-center gap-2.5 font-body text-base text-text-secondary"
                >
                  <CheckCircle className="h-5 w-5 shrink-0 text-primary" />
                  {bullet}
                </li>
              ))}
            </ul>
          </div>

          {/* Right: Hero image */}
          <div className="flex flex-1 items-center justify-center">
            <img
              src="/hero-agents.png"
              alt="AI agents connected in a network"
              className="w-full max-w-lg rounded-2xl shadow-lg"
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="px-6 py-20 sm:px-12">
        <div className="mx-auto max-w-6xl">
          <h3 className="text-center font-heading text-3xl font-semibold text-black">
            How it works
          </h3>
          <div className="mt-14 grid grid-cols-1 gap-12 md:grid-cols-3">
            {howItWorksSteps.map((step) => (
              <div key={step.number} className="text-center">
                <span className="font-heading text-5xl font-bold text-primary/20">
                  {step.number}
                </span>
                <div className="mt-4 flex justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <step.icon className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <h4 className="mt-4 font-heading text-xl font-semibold text-black">
                  {step.title}
                </h4>
                <p className="mt-2 font-body text-base leading-relaxed text-text-secondary">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section className="bg-bg-secondary px-6 py-20 sm:px-12">
        <div className="mx-auto max-w-6xl">
          <h3 className="text-center font-heading text-3xl font-semibold text-black">
            Built for real work
          </h3>
          <p className="mt-3 text-center font-body text-lg text-text-secondary">
            Everything you need to orchestrate AI agent teams
          </p>
          <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {featureCards.map((card) => (
              <div
                key={card.title}
                className="rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <card.icon className="h-5 w-5 text-primary" />
                </div>
                <h4 className="mt-4 font-body text-lg font-semibold text-text-primary">
                  {card.title}
                </h4>
                <p className="mt-2 font-body text-[15px] leading-relaxed text-text-secondary">
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Setup Section */}
      <section id="quick-setup" className="scroll-mt-20 px-6 py-20 sm:px-12">
        <div className="mx-auto max-w-3xl">
          <h3 className="text-center font-heading text-3xl font-semibold text-black">
            Quick setup
          </h3>
          <p className="mt-3 text-center font-body text-lg text-text-secondary">
            Three commands to get started
          </p>
          <div className="mt-10 overflow-hidden rounded-xl border border-border bg-[#1e1e2e] p-6 font-mono text-sm leading-relaxed text-gray-300">
            <div className="flex items-center gap-2 text-text-muted">
              <span className="text-xs">$</span>
            </div>
            <pre className="mt-3 whitespace-pre-wrap">
              <span className="text-gray-500"># Clone and setup</span>
              {"\n"}git clone https://github.com/sebasalmeidam/agent-harness-builder.git{"\n"}cd agent-harness-builder{"\n"}./setup.sh
              {"\n\n"}
              <span className="text-gray-500"># Start the app</span>
              {"\n"}pnpm start
            </pre>
          </div>
          <p className="mt-4 text-center font-body text-sm text-text-muted">
            Requires Node.js 22+. The setup script auto-installs pnpm and Claude Code CLI.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-bg-secondary px-6 py-20 sm:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <h3 className="font-heading text-3xl font-semibold text-black">
            Ready to build your team?
          </h3>
          <p className="mt-3 font-body text-lg text-text-secondary">
            Create your first agent team in minutes. No infrastructure required.
          </p>
          <Link
            to="/"
            className="mt-8 inline-block rounded-lg bg-primary px-8 py-3 font-body text-base font-semibold text-white transition-colors hover:bg-primary/90"
          >
            Go to Dashboard
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-10 text-center sm:px-12">
        <div className="flex items-center justify-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
            <Users className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="font-heading text-base font-semibold text-black">
            Agent Harness
          </span>
        </div>
        <p className="mt-2 font-body text-sm text-text-secondary">
          AI agents that work together.
        </p>
        <p className="mt-4 font-body text-xs text-text-muted">
          Built for the Claude Agent SDK Hackathon 2025
        </p>
      </footer>
    </div>
  );
}
