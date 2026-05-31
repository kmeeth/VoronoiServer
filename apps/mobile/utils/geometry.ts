// Pure geometry helpers for the canvas, kept free of React/RN so they can be
// unit-tested in isolation.

export type Seed = { id: string; x: number; y: number };

// Invert the letterbox (`preserveAspectRatio="xMidYMid meet"`) transform that
// maps a viewW×viewH viewBox into a canvasW×canvasH View. Given a press at
// (localX, localY) in canvas space, return the corresponding viewBox point, or
// null if the press landed in the letterbox margins (or the canvas is unsized).
export function letterboxToViewBox(
  localX: number,
  localY: number,
  canvasW: number,
  canvasH: number,
  viewW: number,
  viewH: number,
): { x: number; y: number } | null {
  if (canvasW === 0 || canvasH === 0) return null;
  const scale = Math.min(canvasW / viewW, canvasH / viewH);
  const offsetX = (canvasW - viewW * scale) / 2;
  const offsetY = (canvasH - viewH * scale) / 2;
  const x = (localX - offsetX) / scale;
  const y = (localY - offsetY) / scale;
  if (x < 0 || x > viewW || y < 0 || y > viewH) return null;
  return { x, y };
}

// The id of the seed nearest (x, y). A Voronoi cell is the region closest to
// its seed, so this is exactly the cell under the point. Returns null for an
// empty set.
export function nearestPointId(
  seeds: readonly Seed[],
  x: number,
  y: number,
): string | null {
  let nearestId: string | null = null;
  let best = Infinity;
  for (const s of seeds) {
    const d = (s.x - x) ** 2 + (s.y - y) ** 2;
    if (d < best) {
      best = d;
      nearestId = s.id;
    }
  }
  return nearestId;
}
