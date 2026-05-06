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
const SELECTED_RING = "#222";
const SWATCH_BASE_STYLE: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 4,
  border: "1px solid rgba(0,0,0,0.15)",
  padding: 0,
  cursor: "pointer",
};

type Hsl = { h: number; s: number; l: number };

function hslToCss({ h, s, l }: Hsl): string {
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

function randomColor(): string {
  return hslToCss({
    h: Math.random() * 360,
    s: 40 + Math.random() * 60,
    l: 25 + Math.random() * 50,
  });
}

function hexToHsl(hex: string): Hsl {
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

function hslToHex({ h, s, l }: Hsl): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
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

const VARIANTS: ReadonlyArray<{ s: number; l: number }> = [
  { s: 70, l: 50 }, // pure
  { s: 60, l: 72 }, // light
  { s: 75, l: 32 }, // dark
  { s: 32, l: 55 }, // muted
];

const TRIADIC_VARIANTS: ReadonlyArray<{ s: number; l: number }> = [
  { s: 70, l: 50 },
  { s: 50, l: 62 },
];

type Swatch = { css: string; hue: number };

function derivePalette(h: number): {
  same: Swatch[];
  complement: Swatch[];
  triadic: Swatch[];
} {
  const same = VARIANTS.map((v) => ({
    css: hslToCss({ h, s: v.s, l: v.l }),
    hue: h,
  }));
  const complementHue = (h + 180) % 360;
  const complement = VARIANTS.map((v) => ({
    css: hslToCss({ h: complementHue, s: v.s, l: v.l }),
    hue: complementHue,
  }));
  const triadic: Swatch[] = [];
  for (const triHue of [(h + 120) % 360, (h + 240) % 360]) {
    for (const v of TRIADIC_VARIANTS) {
      triadic.push({
        css: hslToCss({ h: triHue, s: v.s, l: v.l }),
        hue: triHue,
      });
    }
  }
  return { same, complement, triadic };
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
  const [currentHue, setCurrentHue] = useState(220);
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const palette = useMemo(() => derivePalette(currentHue), [currentHue]);
  const customHex = useMemo(
    () => hslToHex({ h: currentHue, s: 70, l: 50 }),
    [currentHue],
  );

  const selectSwatch = (swatch: Swatch) => {
    setActiveColor(swatch.css);
    setCurrentHue(swatch.hue);
  };

  const selectCustom = (hex: string) => {
    const { h } = hexToHsl(hex);
    setCurrentHue(h);
    setActiveColor(hex);
  };

  const selectRandom = () => setActiveColor(null);

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

    addPoint.mutate({ x, y, color: activeColor ?? randomColor() });
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

  const renderSwatch = (swatch: Swatch) => {
    const isSelected = activeColor === swatch.css;
    return (
      <button
        key={`${swatch.css}-${swatch.hue}`}
        type="button"
        aria-label={`Pick ${swatch.css}`}
        onClick={() => selectSwatch(swatch)}
        style={{
          ...SWATCH_BASE_STYLE,
          background: swatch.css,
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
          aria-label="Random color"
          onClick={selectRandom}
          title="Random color on each click"
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
            outline:
              activeColor === null ? `2px solid ${SELECTED_RING}` : "none",
            outlineOffset: 2,
          }}
        >
          ?
        </button>
        <div style={{ display: "flex", gap: 4 }}>{palette.same.map(renderSwatch)}</div>
        <div style={{ display: "flex", gap: 4 }}>
          {palette.complement.map(renderSwatch)}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {palette.triadic.map(renderSwatch)}
        </div>
        <input
          type="color"
          aria-label="Custom color"
          value={
            activeColor && activeColor.startsWith("#") ? activeColor : customHex
          }
          onChange={(e) => selectCustom(e.target.value)}
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
