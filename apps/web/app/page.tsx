"use client";

import { useEffect, useRef } from "react";
import { trpc } from "../utils/trpc";

const WIDTH = 800;
const HEIGHT = 600;
const POINT_RADIUS = 4;

function randomColor(): string {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 70%, 50%)`;
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const utils = trpc.useUtils();
  const pointsQuery = trpc.getPoints.useQuery();
  const addPoint = trpc.addPoint.useMutation({
    onSuccess: () => utils.getPoints.invalidate(),
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    for (const point of pointsQuery.data ?? []) {
      ctx.fillStyle = point.color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, POINT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [pointsQuery.data]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.round(event.clientX - rect.left);
    const y = Math.round(event.clientY - rect.top);
    addPoint.mutate({ x, y, color: randomColor() });
  };

  return (
    <main style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ marginBottom: 8, display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={() => utils.getPoints.invalidate()}>Refresh</button>
        <span style={{ color: "#666", fontSize: 14 }}>
          {pointsQuery.data?.length ?? 0} points · click canvas to add
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        onClick={handleCanvasClick}
        style={{ border: "1px solid #ccc", display: "block", cursor: "crosshair" }}
      />
    </main>
  );
}
