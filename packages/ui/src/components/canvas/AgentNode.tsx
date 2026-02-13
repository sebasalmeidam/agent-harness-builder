import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

export interface AgentNodeData {
  name: string;
  emoji: string;
  role: string;
  goal: string;
  skills: string[];
  practices: string[];
  [key: string]: unknown;
}

type AgentNodeType = Node<AgentNodeData, "agent">;

export default function AgentNode({ data }: NodeProps<AgentNodeType>) {
  return (
    <div
      className="agent-node-wrapper flex items-center gap-3 rounded-lg border border-border bg-bg-primary px-4 py-3 shadow-sm"
      data-testid="agent-node"
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !rounded-full !border-2 !border-primary !bg-bg-primary"
      />

      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-secondary text-xl">
        {data.emoji}
      </div>

      <div className="flex flex-col">
        <span className="font-body text-sm font-medium text-text-primary">
          {data.name}
        </span>
        {data.role && (
          <span className="font-body text-xs text-text-secondary">
            {data.role}
          </span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !rounded-full !border-2 !border-primary !bg-bg-primary"
      />
    </div>
  );
}
