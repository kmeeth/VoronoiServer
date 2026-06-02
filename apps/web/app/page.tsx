"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Delaunay } from "d3-delaunay";
import { trpc } from "../utils/trpc";

const WIDTH = 800;
const HEIGHT = 600;
const POINT_RADIUS = 4;
const HIGHLIGHT_COLOR = "#e11d48";
const SELECTED_RING = "#222";
const SWATCH_BASE_STYLE: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 4,
  border: "1px solid rgba(0,0,0,0.15)",
  padding: 0,
  cursor: "pointer",
};

type HSL = { h: number; s: number; l: number };

const DEFAULT_COLOR: HSL = { h: 220, s: 70, l: 50 };

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function hslToCss({ h, s, l }: HSL): string {
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

function randomHSL(): HSL {
  return {
    h: Math.random() * 360,
    s: 40 + Math.random() * 60,
    l: 25 + Math.random() * 50,
  };
}

function hexToHSL(hex: string): HSL {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        break;
      case g:
        h = ((b - r) / d + 2) * 60;
        break;
      case b:
        h = ((r - g) / d + 4) * 60;
        break;
    }
  }
  return { h, s: s * 100, l: l * 100 };
}

function hslToHex({ h, s, l }: HSL): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0,
    g = 0,
    b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = lN - c / 2;
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function lighter(c: HSL): HSL {
  return { h: c.h, s: c.s, l: clamp(c.l + 18, 0, 88) };
}
function darker(c: HSL): HSL {
  return { h: c.h, s: c.s, l: clamp(c.l - 22, 12, 100) };
}
function muted(c: HSL): HSL {
  return { h: c.h, s: clamp(c.s * 0.4, 15, 100), l: c.l };
}

function derivePalette(current: HSL): {
  same: HSL[];
  complement: HSL[];
  triadic: HSL[];
} {
  const comp: HSL = { h: (current.h + 180) % 360, s: current.s, l: current.l };
  const tri1: HSL = { h: (current.h + 120) % 360, s: current.s, l: current.l };
  const tri2: HSL = { h: (current.h + 240) % 360, s: current.s, l: current.l };
  return {
    same: [current, lighter(current), darker(current), muted(current)],
    complement: [comp, lighter(comp), darker(comp), muted(comp)],
    triadic: [tri1, muted(tri1), tri2, muted(tri2)],
  };
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const utils = trpc.useUtils();
  // Pull model: re-fetch the shared point set on an interval so changes made by
  // other clients show up. Mutations also invalidate on success so your own
  // edits appear immediately rather than waiting for the next tick.
  const pointsQuery = trpc.getPoints.useQuery(undefined, {
    refetchInterval: 1500,
  });
  const invalidatePoints = () => utils.getPoints.invalidate();
  const addPoint = trpc.addPoint.useMutation({ onSuccess: invalidatePoints });
  const deletePoint = trpc.deletePoint.useMutation({
    onSuccess: invalidatePoints,
  });

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [shiftHeld, setShiftHeld] = useState(false);
  const [currentColor, setCurrentColor] = useState<HSL>(DEFAULT_COLOR);
  const palette = useMemo(() => derivePalette(currentColor), [currentColor]);
  const currentCss = useMemo(() => hslToCss(currentColor), [currentColor]);
  const customHex = useMemo(() => hslToHex(currentColor), [currentColor]);

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

    for (let i = 0; i < points.length; i++) {
      ctx.beginPath();
      voronoi.renderCell(i, ctx);
      ctx.fillStyle = points[i]!.color;
      ctx.fill();
    }

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

    addPoint.mutate({ x, y, color: currentCss });
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

  const renderSwatch = (color: HSL, key: string) => {
    const css = hslToCss(color);
    const isSelected = css === currentCss;
    return (
      <button
        key={key}
        type="button"
        aria-label={`Pick ${css}`}
        onClick={() => setCurrentColor(color)}
        style={{
          ...SWATCH_BASE_STYLE,
          background: css,
          outline: isSelected ? `2px solid ${SELECTED_RING}` : "none",
          outlineOffset: 2,
        }}
      />
    );
  };

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
      <div
        style={{
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <button
          type="button"
          aria-label="Roll random color"
          onClick={() => setCurrentColor(randomHSL())}
          title="Roll a random color"
          style={{
            ...SWATCH_BASE_STYLE,
            background:
              "conic-gradient(hsl(0,70%,50%), hsl(60,70%,50%), hsl(120,70%,50%), hsl(180,70%,50%), hsl(240,70%,50%), hsl(300,70%,50%), hsl(360,70%,50%))",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            textShadow: "0 0 2px rgba(0,0,0,0.6)",
          }}
        >
          ?
        </button>
        <div style={{ display: "flex", gap: 4 }}>
          {palette.same.map((c, i) => renderSwatch(c, `same-${i}`))}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {palette.complement.map((c, i) => renderSwatch(c, `comp-${i}`))}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {palette.triadic.map((c, i) => renderSwatch(c, `tri-${i}`))}
        </div>
        <input
          type="color"
          aria-label="Custom color"
          value={customHex}
          onChange={(e) => setCurrentColor(hexToHSL(e.target.value))}
          style={{
            width: 28,
            height: 28,
            padding: 0,
            border: "1px solid #ccc",
            borderRadius: 4,
            background: "transparent",
            cursor: "pointer",
          }}
        />
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
