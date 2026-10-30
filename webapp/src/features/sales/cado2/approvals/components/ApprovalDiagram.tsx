// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import { memo, useMemo, useRef, useState, type JSX } from "react";
import {
  BaseEdge,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Box, Stack, Typography, useColorScheme, useTheme } from "@wso2/oxygen-ui";
import type { ApprovalStep } from "@features/sales/cado2/approvals/api/approvalTypes";
import {
  buildApprovalGraph,
  elbowPath,
  END_ID,
  handleId,
  NODE_HEIGHT,
  NODE_WIDTH,
  START_ID,
  type EdgeState,
  type GraphEnd,
  type GraphStart,
  type GraphLane,
  type GraphNode,
  type Lane,
} from "@features/sales/cado2/approvals/model/approvalGraphModel";
import { LANE_LABEL, STEP_STATUS } from "@features/sales/cado2/approvals/model/approvalText";
import ApprovalReasons from "./ApprovalReasons";

/** Height of the drawing area: the layout's, within sensible bounds. */
const MIN_HEIGHT = 140;
const MAX_HEIGHT = 440;
/** Space around the drawing inside its frame. */
const PAD = 24;
/** Never shrink below this: smaller text stops being readable. */
const MIN_READABLE_ZOOM = 0.75;

type ApprovalNodeData = { node: GraphNode; selected: boolean };
type ApprovalFlowNode = Node<ApprovalNodeData, "approval">;
type LaneFlowNode = Node<{ lane: GraphLane }, "lane">;
type EndFlowNode = Node<{ end: GraphEnd; live: boolean }, "end">;
type StartFlowNode = Node<{ start: GraphStart }, "start">;
type FlowNode = ApprovalFlowNode | LaneFlowNode | EndFlowNode | StartFlowNode;
type ElbowEdge = Edge<{ bendX: number }, "elbow">;

/**
 * The approval graph, drawn left to right with React Flow; the
 * layout is approvalGraphModel's (columns in time, one row per lane). Every arrow is a real "waits for" link:
 * two arrows leaving a role run in parallel; two arriving mean it waits for
 * both. On a submitted quote the arrows show progress; on a preview they are
 * coloured by branch. The reasons are listed under the drawing, which also
 * serves screen readers. Loaded lazily (LazyApprovalDiagram).
 */
export default function ApprovalDiagram({ steps }: { steps: readonly ApprovalStep[] }): JSX.Element {
  const theme = useTheme();
  const { mode, systemMode } = useColorScheme();
  const dark = (mode === "system" ? systemMode : mode) === "dark";
  const [selected, setSelected] = useState<string | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const layout = useMemo(() => buildApprovalGraph(steps), [steps]);
  const live = steps.some((s) => s.status !== null);

  const colour = (lane: Lane, state: EdgeState): string => {
    const p = theme.palette;
    if (state === "done") return p.success.main;
    if (state === "active") return p.primary.main;
    if (state === "idle") return p.text.disabled;
    return lane === "DISCOUNT" ? p.primary.main : p.warning.main;
  };

  // The lane bands sit behind the roles.
  const laneNodes: LaneFlowNode[] = layout.lanes.map((lane) => ({
    id: `lane-${lane.id}`,
    type: "lane",
    position: { x: lane.x, y: lane.y },
    data: { lane },
    draggable: false,
    connectable: false,
    selectable: false,
    focusable: false,
    zIndex: -1,
    width: lane.width,
    height: lane.height,
  }));
  const nodes: FlowNode[] = [
    ...laneNodes,
    {
      id: START_ID,
      type: "start",
      position: { x: layout.start.x, y: layout.start.y },
      data: { start: layout.start },
      draggable: false,
      connectable: false,
      selectable: false,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    },
    ...layout.nodes.map(
      (n): ApprovalFlowNode => ({
        id: n.id,
        type: "approval",
        position: { x: n.x, y: n.y },
        data: { node: n, selected: selected === n.id },
        draggable: false,
        connectable: false,
        width: NODE_WIDTH,
        height: n.height,
      }),
    ),
    {
      id: END_ID,
      type: "end",
      position: { x: layout.end.x, y: layout.end.y },
      data: { end: layout.end, live },
      draggable: false,
      connectable: false,
      selectable: false,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    },
  ];
  const edges: Edge[] = layout.edges.map((e) => {
    const stroke = colour(e.lane, e.state);
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      // A role across both lanes: enter and leave level with this lane's middle.
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      // Arrows that change height turn at one exact x (Deal Desk's split,
      // Approved's join); the rest are straight lines along their lane.
      ...(e.bendX !== null ? { type: "elbow", data: { bendX: e.bendX } } : { type: "smoothstep" }),
      animated: e.state === "active",
      style: { stroke, strokeWidth: e.state === "done" || e.state === "active" ? 2.25 : 1.75, strokeDasharray: e.state === "idle" ? "4 4" : undefined },
      markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 16, height: 16 },
      focusable: false,
    };
  });

  const height = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, layout.height + 2 * PAD));
  // Fit the whole graph, shrinking a little if needed; if it still doesn't
  // fit at a readable size, start at Deal Desk and let the reader pan right.
  const place = (rf: ReactFlowInstance<FlowNode, Edge>) => {
    const width = frame.current?.clientWidth ?? 0;
    if (!width) return void rf.setViewport({ x: PAD, y: PAD, zoom: 1 });
    const zoom = Math.min(1, Math.max(MIN_READABLE_ZOOM, (width - 2 * PAD) / layout.width));
    const drawn = layout.width * zoom;
    const y = Math.max(PAD, (height - layout.height * zoom) / 2);
    const fits = drawn + 2 * PAD <= width;
    setOverflows(!fits);
    void rf.setViewport({ x: fits ? (width - drawn) / 2 : PAD, y, zoom });
  };
  return (
    <Stack spacing={1.5}>
      {/* Deal Desk alone has no lanes or parallel roles to explain. */}
      {layout.lanes.length > 0 ? <Legend live={live} colour={colour} /> : null}
      <Box
        ref={frame}
        aria-label="Approval graph"
        role="img"
        sx={{
          height,
          border: 1,
          borderColor: "divider",
          borderRadius: 2,
          bgcolor: "background.default",
          overflow: "hidden",
          "& .react-flow__attribution": { opacity: 0.5 },
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          colorMode={dark ? "dark" : "light"}
          onInit={place}
          minZoom={0.4}
          maxZoom={1.5}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          zoomOnScroll={false}
          preventScrolling={false}
          panOnDrag
          onNodeClick={(_, n) => n.type === "approval" && setSelected((cur) => (cur === n.id ? null : n.id))}
          style={{ background: "transparent" }}
        >
          <Controls showInteractive={false} position="bottom-left" />
        </ReactFlow>
      </Box>
      {overflows ? (
        <Typography variant="caption" color="text.secondary" sx={{ mt: -0.5 }}>
          Drag the graph to see the rest →
        </Typography>
      ) : null}
      <ApprovalReasons steps={steps} selected={selected} onSelect={setSelected} />
    </Stack>
  );
}

function Legend({ live, colour }: { live: boolean; colour: (l: Lane, s: EdgeState) => string }): JSX.Element {
  const items: [string, string, boolean][] = live
    ? [
        ["Approved", colour("DISCOUNT", "done"), false],
        ["Their turn now", colour("DISCOUNT", "active"), false],
        ["Not reached yet", colour("DISCOUNT", "idle"), true],
      ]
    : [
        ["Discount", colour("DISCOUNT", "preview"), false],
        ["Commercial", colour("COMMERCIAL", "preview"), false],
      ];
  return (
    <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", rowGap: 0.5 }} aria-label="Legend">
      {items.map(([label, c, dashed]) => (
        <Stack key={label} direction="row" spacing={0.75} alignItems="center">
          <Box aria-hidden sx={{ width: 22, borderTop: 2.5, borderTopStyle: dashed ? "dashed" : "solid", borderColor: c }} />
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
        </Stack>
      ))}
      <Typography variant="caption" color="text.secondary">
        Same column = at the same time. Two arrows into a role: it waits for both.
      </Typography>
    </Stack>
  );
}

const ApprovalNode = memo(function ApprovalNode({ data }: NodeProps<ApprovalFlowNode>): JSX.Element {
  const { node, selected } = data;
  const s = node.step;
  const shared = s.branches.length === 2;
  const status = s.status ? STEP_STATUS[s.status] : null;
  // Already approved in an earlier version (D119); approved by Deal Desk on
  // the approver's behalf (D120).
  const line = s.canAct
    ? "Your turn"
    : s.carriedFrom
      ? `Already approved in v${s.carriedFrom.versionNumber}`
      : node.waitingOn.length
        ? `Waiting on ${node.waitingOn.join(" and ")}`
        : s.approvedOnBehalf
          ? "Approved by Deal Desk"
          : status
            ? status.label
            : `${s.triggers.length} reason${s.triggers.length === 1 ? "" : "s"}`;
  const tone = s.canAct ? "primary" : s.carriedFrom ? "success" : status && status.color !== "default" ? status.color : null;
  return (
    <Box
      title={s.triggers.map((t) => t.reason).join("\n")}
      sx={{
        width: NODE_WIDTH,
        height: node.height,
        px: 1.5,
        py: 1,
        borderRadius: 2,
        border: s.canAct || selected ? 2 : 1,
        borderColor: s.canAct ? "primary.main" : selected ? "text.primary" : tone ? `${tone}.main` : "divider",
        bgcolor: "background.paper",
        boxShadow: 1,
        cursor: "pointer",
        opacity: s.status === "CANCELLED" ? 0.55 : 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {shared ? (
        // One entry and one exit level with each lane's middle, so each lane's
        // arrows stay in their lane.
        (["DISCOUNT", "COMMERCIAL"] as const).map((lane) => (
          <Handle
            key={`in-${lane}`}
            id={handleId("in", lane)}
            type="target"
            position={Position.Left}
            isConnectable={false}
            style={{ opacity: 0, top: lane === "DISCOUNT" ? NODE_HEIGHT / 2 : node.height - NODE_HEIGHT / 2 }}
          />
        ))
      ) : (
        <Handle type="target" position={Position.Left} isConnectable={false} style={{ opacity: 0 }} />
      )}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.25 }} noWrap>
        {s.roleLabel}
      </Typography>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5, minWidth: 0 }}>
        {tone ? <Box aria-hidden sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: `${tone}.main`, flexShrink: 0 }} /> : null}
        <Typography variant="caption" color={tone ? `${tone}.main` : "text.secondary"} noWrap sx={{ fontWeight: tone ? 600 : 400 }}>
          {line}
        </Typography>
      </Stack>
      {shared ? (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          Both lanes — asked once
        </Typography>
      ) : null}
      {shared ? (
        (["DISCOUNT", "COMMERCIAL"] as const).map((lane) => (
          <Handle
            key={`out-${lane}`}
            id={handleId("out", lane)}
            type="source"
            position={Position.Right}
            isConnectable={false}
            style={{ opacity: 0, top: lane === "DISCOUNT" ? NODE_HEIGHT / 2 : node.height - NODE_HEIGHT / 2 }}
          />
        ))
      ) : (
        <Handle type="source" position={Position.Right} isConnectable={false} style={{ opacity: 0 }} />
      )}
    </Box>
  );
});

/** A lane band: its label, and a note when nothing in it needs approving. */
const LaneNode = memo(function LaneNode({ data }: NodeProps<LaneFlowNode>): JSX.Element {
  const { lane } = data;
  return (
    <Box
      sx={{
        width: lane.width,
        height: lane.height,
        borderRadius: 2,
        border: 1,
        borderColor: "divider",
        bgcolor: lane.id === "DISCOUNT" ? "action.hover" : "action.selected",
        position: "relative",
        pointerEvents: "none",
      }}
    >
      <Typography variant="caption" sx={{ position: "absolute", top: 5, left: 12, fontWeight: 700, color: "text.secondary" }}>
        {LANE_LABEL[lane.id]}
      </Typography>
      {lane.empty ? (
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ position: "absolute", top: "50%", left: 16, transform: "translateY(-10%)" }}
        >
          No {lane.id === "DISCOUNT" ? "discount" : "commercial"} approvals needed
        </Typography>
      ) : null}
    </Box>
  );
});

/** "Submitted": where every approval starts (2026-09-28). */
const StartNode = memo(function StartNode({ data }: NodeProps<StartFlowNode>): JSX.Element {
  const { submittedAt } = data.start;
  return (
    <Box
      sx={{
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        px: 1.5,
        borderRadius: 2,
        border: submittedAt ? 2 : 1,
        borderStyle: submittedAt ? "solid" : "dashed",
        borderColor: submittedAt ? "success.main" : "divider",
        bgcolor: "background.paper",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }} color={submittedAt ? "success.main" : "text.primary"}>
        Submitted
      </Typography>
      <Typography variant="caption" color="text.secondary" noWrap>
        {submittedAt
          ? new Date(submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
          : "When you submit"}
      </Typography>
      <Handle type="source" position={Position.Right} isConnectable={false} style={{ opacity: 0 }} />
    </Box>
  );
});

/** "Approved": where the quote ends up once every approval is in. */
const EndNode = memo(function EndNode({ data }: NodeProps<EndFlowNode>): JSX.Element {
  const { end, live } = data;
  return (
    <Box
      sx={{
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        px: 1.5,
        borderRadius: 2,
        border: end.reached ? 2 : 1,
        borderStyle: end.reached ? "solid" : "dashed",
        borderColor: end.reached ? "success.main" : "divider",
        bgcolor: "background.paper",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} style={{ opacity: 0 }} />
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }} color={end.reached ? "success.main" : "text.primary"}>
        Approved
      </Typography>
      <Typography variant="caption" color="text.secondary" noWrap>
        {end.reached ? "Every approval is in" : live ? "Not yet" : "Once every approval is in"}
      </Typography>
    </Box>
  );
});

/** An arrow that turns at one exact x, so arrows sharing a trunk split or join at one point. */
function ElbowArrow({ id, sourceX, sourceY, targetX, targetY, style, markerEnd, data }: EdgeProps<ElbowEdge>) {
  const bx = data?.bendX ?? (sourceX + targetX) / 2;
  return <BaseEdge id={id} path={elbowPath(sourceX, sourceY, bx, targetX, targetY)} style={style} markerEnd={markerEnd} />;
}

const NODE_TYPES = { approval: ApprovalNode, lane: LaneNode, end: EndNode, start: StartNode };
const EDGE_TYPES = { elbow: ElbowArrow };
