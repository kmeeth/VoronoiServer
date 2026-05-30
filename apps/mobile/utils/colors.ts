export type HSL = { h: number; s: number; l: number };

export function hslToString({ h, s, l }: HSL): string {
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

// Build a 12-swatch palette from a base hue: same-hue variants, complement,
// and triadic neighbours. Picking any swatch re-pivots the whole palette.
// Mirrors the web client's palette in `apps/web/app/page.tsx`.
export function buildPalette(base: HSL): HSL[] {
  const { h, s, l } = base;
  const comp = (h + 180) % 360;
  const tri1 = (h + 120) % 360;
  const tri2 = (h + 240) % 360;
  return [
    { h, s, l },
    { h, s, l: Math.min(l + 15, 92) },
    { h, s, l: Math.max(l - 15, 12) },
    { h, s: Math.max(s - 35, 10), l },
    { h: comp, s, l },
    { h: comp, s, l: Math.min(l + 15, 92) },
    { h: comp, s, l: Math.max(l - 15, 12) },
    { h: comp, s: Math.max(s - 35, 10), l },
    { h: tri1, s, l },
    { h: tri2, s, l },
    { h: tri1, s, l: Math.max(l - 15, 12) },
    { h: tri2, s, l: Math.max(l - 15, 12) },
  ];
}

export function randomHSL(): HSL {
  return {
    h: Math.floor(Math.random() * 360),
    s: 55 + Math.floor(Math.random() * 35),
    l: 45 + Math.floor(Math.random() * 25),
  };
}

export function sameHSL(a: HSL, b: HSL): boolean {
  return (
    Math.round(a.h) === Math.round(b.h) &&
    Math.round(a.s) === Math.round(b.s) &&
    Math.round(a.l) === Math.round(b.l)
  );
}
