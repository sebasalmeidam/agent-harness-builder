import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import { Plus } from "lucide-react";
import TeamCanvas from "../components/canvas/TeamCanvas";
import AgentSidebar from "../components/sidebar/AgentSidebar";
import EdgeSidebar from "../components/sidebar/EdgeSidebar";
import type { AgentNodeData } from "../components/canvas/AgentNode";
import type { WorkflowEdgeData } from "../components/canvas/WorkflowEdge";

interface TeamAgent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  goal: string;
  skills: string[];
  practices: string[];
  position: { x: number; y: number };
}

interface TeamEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label: string;
  failureRouting: string | null;
  gate: { type: string } | null;
}

interface Team {
  id: string;
  name: string;
  description: string;
  agents: TeamAgent[];
  edges: TeamEdge[];
}

function agentsToNodes(agents: TeamAgent[]): Node[] {
  return agents.map((agent) => ({
    id: agent.id,
    type: "agent",
    position: { x: agent.position.x, y: agent.position.y },
    data: {
      name: agent.name,
      emoji: agent.emoji,
      role: agent.role,
      goal: agent.goal,
      skills: agent.skills,
      practices: agent.practices,
    },
  }));
}

function teamEdgesToFlowEdges(teamEdges: TeamEdge[]): Edge[] {
  return teamEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "workflow",
    label: edge.label,
    data: {
      type: edge.type,
      failureRouting: edge.failureRouting,
      gate: edge.gate,
    },
  }));
}

const EDGE_TYPE_LABELS: Record<string, string> = {
  "passes-work-to": "passes work to",
  reviews: "reviews",
  "escalates-to": "escalates to",
};

let agentCounter = 0;

function TeamDetailContent() {
  const { id } = useParams<{ id: string }>();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const { screenToFlowPosition } = useReactFlow();

  useEffect(() => {
    async function fetchTeam() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/teams/${id}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("Team not found");
          }
          throw new Error(`Failed to load team: ${res.statusText}`);
        }
        const data: Team = await res.json();
        setTeam(data);
        setNodes(agentsToNodes(data.agents));
        setEdges(teamEdgesToFlowEdges(data.edges));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load team");
      } finally {
        setLoading(false);
      }
    }

    fetchTeam();
  }, [id, setNodes, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge = {
        ...connection,
        type: "workflow",
        data: {
          type: "passes-work-to",
          failureRouting: null,
          gate: null,
        },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges],
  );

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  }, []);

  const onEdgeClick: EdgeMouseHandler = useCallback((_event, edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  const handleAgentDataChange = useCallback(
    (updatedData: AgentNodeData) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === selectedNodeId
            ? { ...node, data: { ...updatedData } }
            : node,
        ),
      );
    },
    [selectedNodeId, setNodes],
  );

  const handleEdgeDataChange = useCallback(
    (updatedData: WorkflowEdgeData) => {
      setEdges((eds) =>
        eds.map((edge) =>
          edge.id === selectedEdgeId
            ? {
                ...edge,
                label: EDGE_TYPE_LABELS[updatedData.type] ?? updatedData.type,
                data: { ...updatedData },
              }
            : edge,
        ),
      );
    },
    [selectedEdgeId, setEdges],
  );

  const handleDeleteAgent = useCallback(() => {
    if (selectedNodeId === null) return;

    const nodeIdToDelete = selectedNodeId;
    setSelectedNodeId(null);

    setNodes((nds) => nds.filter((node) => node.id !== nodeIdToDelete));
    setEdges((eds) =>
      eds.filter(
        (edge) =>
          edge.source !== nodeIdToDelete && edge.target !== nodeIdToDelete,
      ),
    );
  }, [selectedNodeId, setNodes, setEdges]);

  const handleDeleteEdge = useCallback(() => {
    if (selectedEdgeId === null) return;

    const edgeIdToDelete = selectedEdgeId;
    setSelectedEdgeId(null);

    setEdges((eds) => eds.filter((edge) => edge.id !== edgeIdToDelete));
  }, [selectedEdgeId, setEdges]);

  const handleAddAgent = useCallback(() => {
    agentCounter += 1;
    const newId = `agent-${Date.now()}-${agentCounter}`;

    let position = { x: 250, y: 250 };
    try {
      position = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
    } catch {
      // Fallback to default if screenToFlowPosition fails
    }

    const newNode: Node = {
      id: newId,
      type: "agent",
      position,
      data: {
        name: "New Agent",
        emoji: "\uD83E\uDD16",
        role: "",
        goal: "",
        skills: [],
        practices: [],
      },
    };

    setNodes((nds) => [...nds, newNode]);
  }, [setNodes, screenToFlowPosition]);

  // Find the selected node's data for the sidebar
  const selectedNode = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId)
    : null;

  const selectedAgentData = selectedNode
    ? (selectedNode.data as AgentNodeData)
    : null;

  // Find the selected edge's data for the sidebar
  const selectedEdge = selectedEdgeId
    ? edges.find((e) => e.id === selectedEdgeId)
    : null;

  const selectedEdgeData = selectedEdge
    ? (selectedEdge.data as WorkflowEdgeData)
    : null;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="font-body text-base text-text-secondary">
          Loading team...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="rounded-md border border-red-200 bg-red-50 px-6 py-4 text-center">
          <p className="font-body text-sm text-red-700">{error}</p>
          <Link
            to="/teams"
            className="mt-3 inline-block font-body text-sm font-medium text-primary underline"
          >
            Back to Teams
          </Link>
        </div>
      </div>
    );
  }

  if (!team) {
    return null;
  }

  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col">
      {/* Breadcrumb */}
      <nav className="mb-2 font-body text-sm text-text-secondary">
        <Link to="/teams" className="hover:text-primary">
          Teams
        </Link>
        <span className="mx-2">/</span>
        <span className="text-text-primary">{team.name}</span>
      </nav>

      {/* Team header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-[28px] font-semibold text-black">
            {team.name}
          </h1>
          <p className="font-body text-sm text-text-secondary">
            {nodes.length} {nodes.length === 1 ? "agent" : "agents"}
          </p>
        </div>
      </div>

      {/* Canvas + Sidebar flex container */}
      <div className="flex flex-1 overflow-hidden rounded-lg border border-border bg-bg-primary">
        {/* Canvas grows to fill available space */}
        <div className="min-w-0 flex-1">
          <TeamCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={handlePaneClick}
          />
        </div>

        {/* Agent Sidebar: fixed 320px, pushed from right */}
        {selectedAgentData && (
          <AgentSidebar
            data={selectedAgentData}
            onChange={handleAgentDataChange}
            onClose={handleCloseSidebar}
            onDelete={handleDeleteAgent}
          />
        )}

        {/* Edge Sidebar: fixed 320px, pushed from right */}
        {selectedEdgeData && (
          <EdgeSidebar
            data={selectedEdgeData}
            onChange={handleEdgeDataChange}
            onClose={handleCloseSidebar}
            onDelete={handleDeleteEdge}
          />
        )}
      </div>

      {/* Actions bar */}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={handleAddAgent}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-primary px-3 py-1.5 font-body text-sm font-medium text-text-primary transition-colors hover:border-primary hover:text-primary"
        >
          <Plus className="h-4 w-4" />
          Add Agent
        </button>
      </div>
    </div>
  );
}

export default function TeamDetailPage() {
  return (
    <ReactFlowProvider>
      <TeamDetailContent />
    </ReactFlowProvider>
  );
}
