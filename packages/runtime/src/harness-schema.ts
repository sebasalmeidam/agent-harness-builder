// --- Harness Schema Types ---
// Portable, versioned, engine-agnostic format for team designs.
// These types define the harness JSON structure that is exported
// from team data and can be shared, version-controlled, or consumed
// by execution engines.

export interface HarnessAgent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  goal: string;
  skills: string[];
  skillIds: string[];
  resolvedSkills?: Array<{ name: string; instructions: string }>;
  practices: string[];
  position: { x: number; y: number };
  model?: string;
}

export interface HarnessEdge {
  id: string;
  source: string;
  target: string;
  type: "passes-work-to" | "reviews" | "escalates-to";
  label: string;
  failureRouting: "loop-back" | null;
  gate: { type: "auto" | "manual" } | null;
}

export interface HarnessData {
  harnessVersion: string;
  name: string;
  description: string;
  agents: HarnessAgent[];
  edges: HarnessEdge[];
}
