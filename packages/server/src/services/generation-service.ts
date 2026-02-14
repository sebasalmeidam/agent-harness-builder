import Anthropic from "@anthropic-ai/sdk";
import * as configService from "./config-service.js";

// --- Types ---

export interface Skill {
  id: string;
  name: string;
  description: string;
  instructions: string;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  goal: string;
  skills: string[];
  skillIds: string[];
}

export interface Edge {
  id: string;
  source: string;
  target: string;
  type: string;
  label: string;
}

// --- Private helpers ---

async function createClient(): Promise<Anthropic> {
  const apiKey = await configService.getApiKey();
  
  if (!apiKey) {
    const error = new Error("API key not configured. Set it in Settings.");
    (error as Error & { code: string }).code = "NO_API_KEY";
    throw error;
  }
  
  return new Anthropic({ apiKey });
}

async function getModel(): Promise<string> {
  return await configService.getDefaultModel();
}

// --- Public API ---

/**
 * Generates detailed instructions for a skill based on its name and description.
 */
export async function generateSkillInstructions(
  name: string,
  description: string
): Promise<string> {
  const client = await createClient();
  const model = await getModel();

  const systemPrompt = `You are an expert at creating detailed, actionable instructions for AI agent skills.
Your task is to generate comprehensive instructions that will be injected into an AI agent's system prompt.

The instructions should:
- Be clear, specific, and actionable
- Include step-by-step guidance where appropriate
- Provide examples when helpful
- Define best practices and common patterns
- Be written in second person ("You should...", "When you...")
- Be formatted in markdown

Keep the instructions focused and practical. Aim for 200-500 words unless the topic requires more detail.`;

  const userPrompt = `Generate detailed instructions for a skill called "${name}".

Description: ${description}

Write comprehensive instructions that an AI agent can follow when applying this skill.`;

  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in response");
  }

  return textBlock.text;
}

/**
 * Generates a persona description for an agent based on their role, capabilities, and skills.
 */
export async function generateAgentPersona(
  name: string,
  role: string,
  capabilities: string,
  skills: Skill[]
): Promise<string> {
  const client = await createClient();
  const model = await getModel();

  const skillsList = skills.length > 0
    ? skills.map((s) => `- ${s.name}: ${s.description}`).join("\n")
    : "No specific skills assigned.";

  const systemPrompt = `You are an expert at creating compelling AI agent personas.
Your task is to generate a persona description that defines who the agent is, their expertise, and how they approach their work.

The persona should:
- Define the agent's identity and expertise
- Establish their professional background
- Describe their working style and approach
- Be written in second person ("You are...", "Your expertise...")
- Feel like a real professional with depth and personality
- Be 150-300 words

Focus on creating a distinct, memorable persona that guides how the agent interacts and makes decisions.`;

  const userPrompt = `Generate a persona for an AI agent with the following details:

Name: ${name}
Role: ${role}
Capabilities: ${capabilities || "General professional capabilities"}

Skills:
${skillsList}

Create a compelling persona that brings this agent to life.`;

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in response");
  }

  return textBlock.text;
}

/**
 * Generates a team workflow document describing how agents collaborate.
 */
export async function generateTeamWorkflow(
  agents: Agent[],
  edges: Edge[],
  teamDescription?: string
): Promise<string> {
  const client = await createClient();
  const model = await getModel();

  // Build agents description
  const agentsDescription = agents.map((agent) => {
    const skillsList = agent.skills.length > 0 
      ? `Skills: ${agent.skills.join(", ")}`
      : "No specific skills";
    return `- ${agent.name} (${agent.role}): ${agent.goal || "Team member"}. ${skillsList}`;
  }).join("\n");

  // Build connections description
  const connectionsDescription = edges.map((edge) => {
    const sourceAgent = agents.find((a) => a.id === edge.source);
    const targetAgent = agents.find((a) => a.id === edge.target);
    const sourceName = sourceAgent?.name || edge.source;
    const targetName = targetAgent?.name || edge.target;
    return `- ${sourceName} ${edge.label || edge.type} ${targetName}`;
  }).join("\n");

  const systemPrompt = `You are an expert at designing AI agent team workflows.
Your task is to generate a comprehensive workflow document that describes how a team of AI agents should collaborate.

The workflow should:
- Define clear phases of work
- Specify what each agent does in each phase
- Describe handoff points and criteria
- Include delegation rules
- Define quality gates and review processes
- Be formatted in markdown with clear sections
- Be actionable and specific

The workflow will be used to coordinate AI agents working together on tasks.`;

  const userPrompt = `Generate a team workflow document for the following team:

${teamDescription ? `Team Description: ${teamDescription}\n` : ""}
Agents:
${agentsDescription}

Connections (how work flows between agents):
${connectionsDescription || "No connections defined yet."}

Create a detailed workflow that describes:
1. How the team should process incoming work
2. What each agent's responsibilities are
3. How work is passed between agents
4. Quality checkpoints and review criteria
5. Escalation and error handling procedures`;

  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in response");
  }

  return textBlock.text;
}
