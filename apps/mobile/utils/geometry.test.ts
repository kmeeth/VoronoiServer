import { describe, it, expect } from "vitest";
import { letterboxToViewBox, nearestPointId, type Seed } from "./geometry";

describe("letterboxToViewBox", () => {
  it("maps 1:1 when the canvas exactly matches the viewBox", () => {
    expect(letterboxToViewBox(400, 300, 800, 600, 800, 600)).toEqual({
      x: 400,
      y: 300,
    });
  });

  it("undoes uniform scaling when the canvas keeps the aspect ratio", () => {
    // 400x300 canvas = half scale, no letterbox margins.
    expect(letterboxToViewBox(200, 150, 400, 300, 800, 600)).toEqual({
      x: 400,
      y: 300,
    });
  });

  it("accounts for horizontal letterbox margins on a too-wide canvas", () => {
    // 1000x600 vs 4:3 viewBox → scale 1, 100px margin each side.
    expect(letterboxToViewBox(100, 0, 1000, 600, 800, 600)).toEqual({
      x: 0,
      y: 0,
    });
    expect(letterboxToViewBox(900, 600, 1000, 600, 800, 600)).toEqual({
      x: 800,
      y: 600,
    });
  });

  it("returns null for presses in the letterbox margin", () => {
    expect(letterboxToViewBox(50, 0, 1000, 600, 800, 600)).toBeNull();
  });

  it("returns null when the canvas is unsized", () => {
    expect(letterboxToViewBox(10, 10, 0, 0, 800, 600)).toBeNull();
  });

  it("returns null for points outside the viewBox", () => {
    expect(letterboxToViewBox(801, 0, 800, 600, 800, 600)).toBeNull();
    expect(letterboxToViewBox(0, -1, 800, 600, 800, 600)).toBeNull();
  });
});

describe("nearestPointId", () => {
  const seeds: Seed[] = [
    { id: "a", x: 0, y: 0 },
    { id: "b", x: 100, y: 0 },
    { id: "c", x: 50, y: 100 },
  ];

  it("returns null for an empty set", () => {
    expect(nearestPointId([], 10, 10)).toBeNull();
  });

  it("picks the closest seed", () => {
    expect(nearestPointId(seeds, 5, 5)).toBe("a");
    expect(nearestPointId(seeds, 95, 5)).toBe("b");
    expect(nearestPointId(seeds, 50, 90)).toBe("c");
  });

  it("breaks ties toward the first seed encountered", () => {
    // Equidistant between a (0,0) and b (100,0).
    expect(nearestPointId(seeds, 50, 0)).toBe("a");
  });
});
