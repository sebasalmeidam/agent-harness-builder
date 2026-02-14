import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
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
import { Plus, Save, Trash2, Download } from "lucide-react";
import ErrorCard from "../components/ErrorCard";
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
  skillIds: string[];
  practices: string[];
  position: { x: number; y: number };
  model?: string;
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
      skillIds: agent.skillIds ?? [],
      practices: agent.practices,
      model: agent.model,
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

export function nodesToAgents(nodes: Node[]): TeamAgent[] {
  return nodes.map((node) => ({
    id: node.id,
    name: (node.data as AgentNodeData).name,
    emoji: (node.data as AgentNodeData).emoji,
    role: (node.data as AgentNodeData).role,
    goal: (node.data as AgentNodeData).goal,
    skills: (node.data as AgentNodeData).skills,
    skillIds: (node.data as AgentNodeData).skillIds ?? [],
    practices: (node.data as AgentNodeData).practices,
    position: { x: node.position.x, y: node.position.y },
    model: (node.data as AgentNodeData).model,
  }));
}

export function flowEdgesToTeamEdges(edges: Edge[]): TeamEdge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: (edge.data as WorkflowEdgeData)?.type ?? "passes-work-to",
    label:
      (edge.label as string) ??
      EDGE_TYPE_LABELS[
        (edge.data as WorkflowEdgeData)?.type ?? "passes-work-to"
      ] ??
      "passes work to",
    failureRouting:
      (edge.data as WorkflowEdgeData)?.failureRouting ?? null,
    gate: (edge.data as WorkflowEdgeData)?.gate ?? null,
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
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const { screenToFlowPosition } = useReactFlow();

  // Editable metadata
  const [editedName, setEditedName] = useState("");
  const [editedDescription, setEditedDescription] = useState("");

  // Save state
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Track whether initial load is complete to avoid marking dirty during load
  const initialLoadComplete = useRef(false);

  useEffect(() => {
    async function fetchTeam() {
      setLoading(true);
      setError(null);
      initialLoadComplete.current = false;
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
        setEditedName(data.name);
        setEditedDescription(data.description);
        setNodes(agentsToNodes(data.agents));
        setEdges(teamEdgesToFlowEdges(data.edges));
        setIsDirty(false);
        // Allow a tick for React Flow to process node/edge changes
        // before we start tracking dirty state
        setTimeout(() => {
          initialLoadComplete.current = true;
        }, 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load team");
      } finally {
        setLoading(false);
      }
    }

    fetchTeam();
  }, [id, setNodes, setEdges]);

  // beforeunload event for browser refresh/tab close
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) {
        e.preventDefault();
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  // Clear save message after 3 seconds
  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => {
        setSaveMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);

  const markDirty = useCallback(() => {
    if (initialLoadComplete.current) {
      setIsDirty(true);
    }
  }, []);

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
      markDirty();
    },
    [setEdges, markDirty],
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
      markDirty();
    },
    [selectedNodeId, setNodes, markDirty],
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
      markDirty();
    },
    [selectedEdgeId, setEdges, markDirty],
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
    markDirty();
  }, [selectedNodeId, setNodes, setEdges, markDirty]);

  const handleDeleteEdge = useCallback(() => {
    if (selectedEdgeId === null) return;

    const edgeIdToDelete = selectedEdgeId;
    setSelectedEdgeId(null);

    setEdges((eds) => eds.filter((edge) => edge.id !== edgeIdToDelete));
    markDirty();
  }, [selectedEdgeId, setEdges, markDirty]);

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
        skillIds: [],
        practices: [],
      },
    };

    setNodes((nds) => [...nds, newNode]);
    markDirty();
  }, [setNodes, screenToFlowPosition, markDirty]);

  // Track node position changes (drag)
  const handleNodesChange: typeof onNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);
      const hasPositionChange = changes.some(
        (change) => change.type === "position" && change.dragging === false,
      );
      if (hasPositionChange) {
        markDirty();
      }
    },
    [onNodesChange, markDirty],
  );

  // Track edge changes (deletion via keyboard)
  const handleEdgesChange: typeof onEdgesChange = useCallback(
    (changes) => {
      onEdgesChange(changes);
      const hasRemoveChange = changes.some(
        (change) => change.type === "remove",
      );
      if (hasRemoveChange) {
        markDirty();
      }
    },
    [onEdgesChange, markDirty],
  );

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEditedName(e.target.value);
      markDirty();
    },
    [markDirty],
  );

  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setEditedDescription(e.target.value);
      markDirty();
    },
    [markDirty],
  );

  const handleSave = useCallback(async () => {
    if (!team) return;

    setSaving(true);
    setSaveMessage(null);

    const payload = {
      id: team.id,
      name: editedName,
      description: editedDescription,
      agents: nodesToAgents(nodes),
      edges: flowEdgesToTeamEdges(edges),
    };

    try {
      const res = await fetch(`/api/teams/${team.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Failed to save team: ${res.statusText}`);
      }

      const updatedTeam: Team = await res.json();
      setTeam(updatedTeam);
      setEditedName(updatedTeam.name);
      setEditedDescription(updatedTeam.description);
      setIsDirty(false);
      setSaveMessage({ type: "success", text: "Team saved successfully" });
    } catch (err) {
      setSaveMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save team",
      });
    } finally {
      setSaving(false);
    }
  }, [team, editedName, editedDescription, nodes, edges]);

  const handleDeleteTeam = useCallback(async () => {
    if (!team) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${team.name}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/teams/${team.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error(`Failed to delete team: ${res.statusText}`);
      }

      // Clear isDirty so navigation blocker does not trigger on redirect
      setIsDirty(false);
      navigate("/teams");
    } catch (err) {
      setSaveMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to delete team",
      });
    }
  }, [team, navigate]);

  const handleExportHarness = useCallback(async () => {
    if (!team) return;

    setExporting(true);
    setSaveMessage(null);

    try {
      const res = await fetch(`/api/teams/${team.id}/harness`);

      if (!res.ok) {
        if (res.status === 400) {
          throw new Error("Cannot export: team has no agents");
        }
        throw new Error(`Export failed: ${res.statusText}`);
      }

      const harnessJson = await res.json();
      const blob = new Blob([JSON.stringify(harnessJson, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${team.id}.harness.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setSaveMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to export harness",
      });
    } finally {
      setExporting(false);
    }
  }, [team]);

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
        <div className="text-center">
          <ErrorCard message={error} className="px-6 py-4" />
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
        <span className="text-text-primary">{editedName || team.name}</span>
      </nav>

      {/* Team header */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={editedName}
            onChange={handleNameChange}
            className="w-full border-b border-transparent bg-transparent font-heading text-[28px] font-semibold text-black outline-none transition-colors focus:border-primary"
            aria-label="Team name"
          />
          <textarea
            value={editedDescription}
            onChange={handleDescriptionChange}
            placeholder="Add a description..."
            rows={1}
            className="mt-1 w-full resize-none border-b border-transparent bg-transparent font-body text-sm text-text-secondary outline-none transition-colors placeholder:text-text-secondary/50 focus:border-primary"
            aria-label="Team description"
          />
          <p className="mt-1 font-body text-xs text-text-secondary">
            {nodes.length} {nodes.length === 1 ? "agent" : "agents"}
            {isDirty && (
              <span
                className="ml-2 inline-flex items-center gap-1 text-primary"
                data-testid="dirty-indicator"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                Unsaved changes
              </span>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={handleDeleteTeam}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-primary px-3 py-1.5 font-body text-sm font-medium text-text-secondary transition-colors hover:border-red-300 hover:text-red-600"
            title="Delete team"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
          <button
            onClick={handleExportHarness}
            disabled={nodes.length === 0 || isDirty || exporting}
            title={
              nodes.length === 0
                ? "Add agents first"
                : isDirty
                  ? "Save changes first"
                  : "Export as harness file"
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-primary px-3 py-1.5 font-body text-sm font-medium text-text-secondary transition-colors hover:border-primary hover:text-primary disabled:opacity-50 disabled:hover:border-border disabled:hover:text-text-secondary"
          >
            <Download className="h-4 w-4" />
            Export Harness
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 font-body text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Save message */}
      {saveMessage && (
        <div
          className={`mb-3 rounded-md border px-4 py-2 font-body text-sm ${
            saveMessage.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
          role="status"
        >
          {saveMessage.text}
        </div>
      )}

      {/* Canvas + Sidebar flex container */}
      <div className="flex flex-1 overflow-hidden rounded-lg border border-border bg-bg-primary">
        {/* Canvas grows to fill available space */}
        <div className="min-w-0 flex-1">
          <TeamCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
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
