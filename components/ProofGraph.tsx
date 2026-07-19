"use client";

import { useEffect, useMemo, useState } from "react";
import { Background, Controls, MarkerType, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { EvaluatedNode } from "../lib/domain/engine";
import type { DependencyEdge } from "../lib/domain/schemas";

const positions: Record<string, { x: number; y: number }> = {
  students: { x: 0, y: 0 },
  "spare-rate": { x: 0, y: 100 },
  devices: { x: 210, y: 48 },
  "a-hardware-rate": { x: 0, y: 225 },
  "a-support-rate": { x: 0, y: 330 },
  "a-hardware": { x: 210, y: 205 },
  "a-support": { x: 210, y: 330 },
  "a-total": { x: 440, y: 270 },
  "b-hardware-rate": { x: 0, y: 475 },
  "b-setup": { x: 0, y: 575 },
  "b-hardware": { x: 210, y: 470 },
  "b-total": { x: 440, y: 510 },
  budget: { x: 440, y: 90 },
  recommendation: { x: 680, y: 300 },
};

const focusedPositions: Record<string, { x: number; y: number }> = {
  "a-support-rate": { x: 0, y: 80 },
  "a-support": { x: 270, y: 80 },
  "a-total": { x: 540, y: 80 },
  recommendation: { x: 810, y: 80 },
};

const focusedMobilePositions: Record<string, { x: number; y: number }> = {
  "a-support-rate": { x: 40, y: 0 },
  "a-support": { x: 40, y: 130 },
  "a-total": { x: 40, y: 260 },
  recommendation: { x: 40, y: 390 },
};

export function ProofGraph({
  nodes,
  edges,
  activeTrace,
  focused,
  selectedId,
  onSelect,
  focusedIds,
}: {
  nodes: EvaluatedNode[];
  edges: DependencyEdge[];
  activeTrace: string[];
  focused: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
  focusedIds?: string[];
}) {
  const [narrowViewport, setNarrowViewport] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => setNarrowViewport(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  const visibleIds = useMemo(() => new Set(focused ? (focusedIds ?? Object.keys(focusedPositions)) : nodes.map((node) => node.id)), [focused, focusedIds, nodes]);
  const visibleNodes = useMemo(() => nodes.filter((node) => visibleIds.has(node.id)), [nodes, visibleIds]);
  const graphNodes = useMemo<Node[]>(
    () =>
      visibleNodes
        .map((node, index) => ({
          id: node.id,
          position: (focused ? (narrowViewport ? focusedMobilePositions[node.id] : focusedPositions[node.id]) : positions[node.id]) ?? { x: (index % 4) * 230, y: Math.floor(index / 4) * 130 },
          data: {
            label: node.id === "a-support-rate"
              ? "Quote A · $18 / device / month"
              : node.id === "a-support"
                ? "Support cost"
                : node.id === "recommendation"
                  ? "Recommendation"
                  : node.label,
          },
          className: `proof-node proof-node-${node.status} ${focused ? "proof-node-focused" : ""} ${activeTrace.includes(node.id) ? "proof-node-active" : ""}`,
          ariaLabel: `${node.label}. ${node.status}. ${node.statusReason}`,
          selected: selectedId === node.id,
          style: { width: focused ? (narrowViewport ? 250 : 232) : node.id === "recommendation" ? 202 : 184 },
        })),
    [activeTrace, focused, narrowViewport, selectedId, visibleNodes],
  );
  const graphEdges = useMemo<Edge[]>(
    () =>
      edges
        .filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to))
        .map((edge) => {
          const active = activeTrace.includes(edge.from) && activeTrace.includes(edge.to);
          return {
            id: edge.id,
            source: edge.from,
            target: edge.to,
            label: edge.label,
            animated: active,
            markerEnd: { type: MarkerType.ArrowClosed, color: active ? "#b6382f" : "#948b7e" },
            style: { stroke: active ? "#b6382f" : "#948b7e", strokeWidth: active ? 2.4 : 1.2 },
          };
        }),
    [activeTrace, edges, visibleIds],
  );

  return (
    <div className={`graph-canvas ${focused ? "graph-canvas-focused" : ""} ${focused && narrowViewport ? "graph-canvas-focused-mobile" : ""}`} data-testid="proof-graph" data-graph-view={focused ? "focused" : "full"} aria-label="Decision dependency graph">
      <ReactFlow
        key={`${focused ? "focused" : "full"}-${narrowViewport ? "narrow" : "wide"}`}
        nodes={graphNodes}
        edges={graphEdges}
        fitView
        fitViewOptions={{ padding: narrowViewport ? 0.08 : 0.14 }}
        minZoom={0.55}
        maxZoom={1.4}
        onlyRenderVisibleElements
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        onNodeClick={(_, node) => onSelect(node.id)}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#d8d0c4" gap={28} size={1} />
        {!focused && <Controls showInteractive={false} />}
      </ReactFlow>
    </div>
  );
}
