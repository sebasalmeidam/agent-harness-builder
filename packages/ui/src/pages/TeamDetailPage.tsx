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
import { Plus, Save, Trash2, Download, Sparkles, Loader2, ChevronDown, ChevronRight } from "lucide-react";
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
  processWorkflow?: string;
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

  // Workflow generation state
  const [generatingWorkflow, setGeneratingWorkflow] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [editedWorkflow, setEditedWorkflow] = useState("");

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
        setEditedWorkflow(data.processWorkflow || "");
        setShowWorkflow(!!data.processWorkflow);
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
    
    // Check if API key is configured
    async function checkApiKey() {
      try {
        const res = await fetch("/api/settings/status");
        if (res.ok) {
          const data = await res.json();
          setHasApiKey(data.hasApiKey);
        }
      } catch {
        setHasApiKey(false);
      }
    }
    checkApiKey();
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
      processWorkflow: editedWorkflow || undefined,
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
      setEditedWorkflow(updatedTeam.processWorkflow || "");
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
  }, [team, editedName, editedDescription, nodes, edges, editedWorkflow]);

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

  const handleProcessTeam = useCallback(async () => {
    if (!team) return;

    setGeneratingWorkflow(true);
    setSaveMessage(null);

    try {
      const res = await fetch("/api/generate/team-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: team.id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to generate workflow");
      }

      const data = await res.json();
      setEditedWorkflow(data.workflow);
      setShowWorkflow(true);
      markDirty();
      setSaveMessage({ type: "success", text: "Workflow generated! Save to persist." });
    } catch (err) {
      setSaveMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to generate workflow",
      });
    } finally {
      setGeneratingWorkflow(false);
    }
  }, [team, markDirty]);

  const handleWorkflowChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setEditedWorkflow(e.target.value);
      markDirty();
    },
    [markDirty],
  );

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
    <div className="flex h-[calc(100vh-2rem)] flex-col pb-16">
      {/* Breadcrumb */}
      <nav className="mb-2 font-body text-sm text-text-secondary">
        <Link to="/teams" className="hover:text-primary">
          Teams
        </Link>
        <span className="mx-2">/</span>
        <span className="text-text-primary">{editedName || team.name}</span>
      </nav>

      {/* Team header */}
      <div className="mb-3 flex items-start justify-between gap-4">
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
        </div>
      </div>

      {/* Toolbar: Add Agent + Process Team */}
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={handleAddAgent}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-primary px-3 py-1.5 font-body text-sm font-medium text-text-primary transition-colors hover:border-primary hover:text-primary"
        >
          <Plus className="h-4 w-4" />
          Add Agent
        </button>
        <button
          onClick={handleProcessTeam}
          disabled={generatingWorkflow || hasApiKey === false || nodes.length === 0 || isDirty}
          title={
            hasApiKey === false
              ? "Set API key in Settings"
              : nodes.length === 0
                ? "Add agents first"
                : isDirty
                  ? "Save changes first"
                  : "Generate team workflow with AI"
          }
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-body text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            editedWorkflow
              ? "border border-border bg-bg-primary text-text-primary hover:border-primary hover:text-primary disabled:hover:border-border disabled:hover:text-text-primary"
              : "bg-primary text-white hover:bg-primary/90"
          }`}
        >
          {generatingWorkflow ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Process Team
            </>
          )}
        </button>
      </div>

      {/* Canvas + Sidebar flex container (drag bottom-right corner to resize) */}
      <div className="flex h-[500px] min-h-[300px] max-h-[80vh] resize-y overflow-hidden rounded-lg border border-border bg-bg-primary">
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
            onSave={handleSave}
            isDirty={isDirty}
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

      {/* Workflow section */}
      <div className="mt-4 rounded-lg border border-border bg-bg-primary p-4">
        <button
          type="button"
          onClick={() => setShowWorkflow(!showWorkflow)}
          className="flex w-full items-center gap-1 font-body text-sm font-medium text-text-primary hover:text-primary"
        >
          {showWorkflow ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Team Workflow
          {editedWorkflow ? (
            <span className="ml-1 text-xs text-text-secondary">
              ({editedWorkflow.split("\n").length} lines)
            </span>
          ) : (
            <span className="ml-1 text-xs text-text-muted">
              (not defined)
            </span>
          )}
        </button>
        {showWorkflow && (
          <>
            {!editedWorkflow && (
              <div className="mt-3 rounded-md border border-dashed border-border bg-bg-secondary px-4 py-5 text-center">
                <Sparkles className="mx-auto h-5 w-5 text-text-muted" />
                <p className="mt-2 font-body text-sm text-text-secondary">
                  Define how your agents collaborate. Click <strong>Process Team</strong> to auto-generate from your agent graph, or write it manually below.
                </p>
              </div>
            )}
            <textarea
              value={editedWorkflow}
              onChange={handleWorkflowChange}
              rows={editedWorkflow ? 15 : 5}
              className="mt-3 w-full rounded-md border border-border bg-white px-3 py-2 font-body text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-light"
              placeholder="Describe the workflow: who does what, in what order, what are the handoff criteria..."
            />
          </>
        )}
      </div>

      {/* Sticky save bar: appears when there are unsaved changes */}
      {(isDirty || saveMessage) && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white px-6 py-3 shadow-lg">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <div className="flex items-center gap-3">
              {saveMessage ? (
                <span
                  className={`font-body text-sm font-medium ${
                    saveMessage.type === "success" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {saveMessage.text}
                </span>
              ) : (
                <span className="font-body text-sm font-medium text-amber-600">
                  ● Unsaved changes
                </span>
              )}
            </div>
            {isDirty && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2 font-body text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            )}
          </div>
        </div>
      )}
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
