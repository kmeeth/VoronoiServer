"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Delaunay } from "d3-delaunay";
import type { Point } from "@repo/api";
import { trpc } from "../utils/trpc";

const WIDTH = 800;
const HEIGHT = 600;
const POINT_RADIUS = 4;
const CELL_FILL_ALPHA = 0.45;
const CELL_FILL_ALPHA_HIGHLIGHT = 0.8;
const HIGHLIGHT_COLOR = "#e11d48";

function randomColor(): string {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 70%, 50%)`;
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const utils = trpc.useUtils();
  const pointsQuery = trpc.getPoints.useQuery(undefined, {
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const addPoint = trpc.addPoint.useMutation();
  const deletePoint = trpc.deletePoint.useMutation();

  useEffect(() => {
    const source = new EventSource("/api/events");

    source.addEventListener("snapshot", (e) => {
      utils.getPoints.setData(undefined, JSON.parse(e.data) as Point[]);
    });
    source.addEventListener("added", (e) => {
      const { point } = JSON.parse(e.data) as { point: Point };
      utils.getPoints.setData(undefined, (prev) => {
        if (!prev) return [point];
        if (prev.some((p) => p.id === point.id)) return prev;
        return [...prev, point];
      });
    });
    source.addEventListener("removed", (e) => {
      const { id } = JSON.parse(e.data) as { id: string };
      utils.getPoints.setData(undefined, (prev) =>
        prev ? prev.filter((p) => p.id !== id) : prev,
      );
    });

    return () => source.close();
  }, [utils]);

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [shiftHeld, setShiftHeld] = useState(false);

  const points = pointsQuery.data;

  const delaunay = useMemo(
    () =>
      points && points.length > 0
        ? Delaunay.from(
            points,
            (p) => p.x,
            (p) => p.y,
          )
        : null,
    [points],
  );

  const voronoi = useMemo(
    () => delaunay?.voronoi([0, 0, WIDTH, HEIGHT]) ?? null,
    [delaunay],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftHeld(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftHeld(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    if (!points || points.length === 0 || !voronoi) return;

    const previewIndex =
      shiftHeld && hoveredIndex !== null && hoveredIndex < points.length
        ? hoveredIndex
        : null;

    ctx.save();
    for (let i = 0; i < points.length; i++) {
      ctx.beginPath();
      voronoi.renderCell(i, ctx);
      ctx.fillStyle = points[i]!.color;
      ctx.globalAlpha =
        i === previewIndex ? CELL_FILL_ALPHA_HIGHLIGHT : CELL_FILL_ALPHA;
      ctx.fill();
    }
    ctx.restore();

    ctx.beginPath();
    voronoi.render(ctx);
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.stroke();

    if (previewIndex !== null) {
      ctx.beginPath();
      voronoi.renderCell(previewIndex, ctx);
      ctx.strokeStyle = HIGHLIGHT_COLOR;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    for (let i = 0; i < points.length; i++) {
      const point = points[i]!;
      const isPreview = i === previewIndex;
      ctx.beginPath();
      ctx.arc(
        point.x,
        point.y,
        isPreview ? POINT_RADIUS + 1 : POINT_RADIUS,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.strokeStyle = isPreview ? HIGHLIGHT_COLOR : "#222";
      ctx.lineWidth = isPreview ? 2 : 1.5;
      ctx.stroke();
    }
  }, [points, voronoi, shiftHeld, hoveredIndex]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.round(event.clientX - rect.left);
    const y = Math.round(event.clientY - rect.top);

    if (event.shiftKey) {
      if (!delaunay || !points || points.length === 0) return;
      const idx = delaunay.find(x, y);
      const target = points[idx];
      if (target) deletePoint.mutate({ id: target.id });
      return;
    }

    addPoint.mutate({ x, y, color: randomColor() });
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!delaunay || !points || points.length === 0) {
      setHoveredIndex(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    setHoveredIndex(delaunay.find(x, y));
  };

  const handleMouseLeave = () => setHoveredIndex(null);

  return (
    <main style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <div
        style={{
          marginBottom: 8,
          color: "#666",
          fontSize: 14,
        }}
      >
        {points?.length ?? 0} points · click to add · shift-click to delete
      </div>
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          border: "1px solid #ccc",
          display: "block",
          cursor: shiftHeld ? "pointer" : "crosshair",
        }}
      />
    </main>
  );
}
