import { randomUUID } from "node:crypto";

export type Point = {
  id: string;
  x: number;
  y: number;
  color: string;
};

const points = new Map<string, Point>();

export function list(): Point[] {
  return Array.from(points.values());
}

export function add(input: { x: number; y: number; color: string }): Point {
  const point: Point = { id: randomUUID(), ...input };
  points.set(point.id, point);
  return point;
}

export function remove(id: string): void {
  points.delete(id);
}
