import { describe, it, expect } from "vitest";
import {
  buildPalette,
  hslToString,
  randomHSL,
  sameHSL,
  type HSL,
} from "./colors";

describe("hslToString", () => {
  it("rounds each channel and formats as CSS hsl()", () => {
    expect(hslToString({ h: 220.4, s: 69.6, l: 50.1 })).toBe(
      "hsl(220, 70%, 50%)",
    );
  });
});

describe("buildPalette", () => {
  const base: HSL = { h: 100, s: 60, l: 50 };
  const palette = buildPalette(base);

  it("returns twelve swatches", () => {
    expect(palette).toHaveLength(12);
  });

  it("starts with the base colour", () => {
    expect(palette[0]).toEqual(base);
  });

  it("includes the complement (hue + 180)", () => {
    expect(palette.some((c) => c.h === (base.h + 180) % 360)).toBe(true);
  });

  it("keeps lightness within sane bounds", () => {
    for (const c of palette) {
      expect(c.l).toBeGreaterThanOrEqual(0);
      expect(c.l).toBeLessThanOrEqual(100);
    }
  });
});

describe("sameHSL", () => {
  it("treats colours equal after rounding", () => {
    expect(sameHSL({ h: 10.2, s: 50.4, l: 50 }, { h: 10, s: 50, l: 50 })).toBe(
      true,
    );
  });

  it("distinguishes different colours", () => {
    expect(sameHSL({ h: 10, s: 50, l: 50 }, { h: 11, s: 50, l: 50 })).toBe(
      false,
    );
  });
});

describe("randomHSL", () => {
  it("stays within the configured ranges", () => {
    for (let i = 0; i < 200; i++) {
      const c = randomHSL();
      expect(c.h).toBeGreaterThanOrEqual(0);
      expect(c.h).toBeLessThanOrEqual(359);
      expect(c.s).toBeGreaterThanOrEqual(55);
      expect(c.s).toBeLessThanOrEqual(89);
      expect(c.l).toBeGreaterThanOrEqual(45);
      expect(c.l).toBeLessThanOrEqual(69);
    }
  });
});
