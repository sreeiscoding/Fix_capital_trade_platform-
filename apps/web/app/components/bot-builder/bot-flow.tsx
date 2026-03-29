"use client";

import { useMemo } from "react";
import ReactFlow, { Background, Controls, MiniMap, type Edge, type Node } from "reactflow";

const initialNodes: Node[] = [
  { id: "market", position: { x: 60, y: 80 }, data: { label: "Market ticks" }, type: "input" },
  { id: "rsi", position: { x: 280, y: 80 }, data: { label: "RSI < 30" } },
  { id: "buy", position: { x: 500, y: 80 }, data: { label: "Deriv proposal + buy" }, type: "output" },
  { id: "risk", position: { x: 280, y: 210 }, data: { label: "Risk <= 1.5%" } }
];

const initialEdges: Edge[] = [
  { id: "e1", source: "market", target: "rsi", animated: true },
  { id: "e2", source: "rsi", target: "buy", animated: true },
  { id: "e3", source: "market", target: "risk", animated: true },
  { id: "e4", source: "risk", target: "buy", animated: true }
];

export function BotFlowCanvas() {
  const nodes = useMemo(() => initialNodes, []);
  const edges = useMemo(() => initialEdges, []);

  return (
    <div className="panel h-[380px] overflow-hidden p-0 sm:h-[520px]">
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background color="rgba(255,255,255,0.08)" gap={22} />
        <MiniMap pannable zoomable />
        <Controls />
      </ReactFlow>
    </div>
  );
}