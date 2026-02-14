export const VERSION = "0.0.0";

export type { HarnessAgent, HarnessEdge, HarnessData } from "./harness-schema.js";

export type {
  TranslatedTeam,
  TranslatedAgent,
  AgentStatus,
  ActivityEntry,
  ExecutionSummary,
  ExecutionRun,
  ExecutionRunSummary,
} from "./types.js";

export { translateHarness, identifyLeadAgent } from "./translator.js";

export { executeWithSdk, resolveTools } from "./sdk-executor.js";
export type { ExecuteWithSdkParams, AgentDefinition } from "./sdk-executor.js";
