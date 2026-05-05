import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

export type Point = {
  id: string;
  x: number;
  y: number;
  color: string;
};

export type PointEvent =
  | { type: "added"; point: Point }
  | { type: "removed"; id: string };

const points = new Map<string, Point>();
const emitter = new EventEmitter();
emitter.setMaxListeners(0);

export function list(): Point[] {
  return Array.from(points.values());
}

export function add(input: { x: number; y: number; color: string }): Point {
  const point: Point = { id: randomUUID(), ...input };
  points.set(point.id, point);
  emitter.emit("event", { type: "added", point } satisfies PointEvent);
  return point;
}

export function remove(id: string): void {
  if (points.delete(id)) {
    emitter.emit("event", { type: "removed", id } satisfies PointEvent);
  }
}

export function subscribe(listener: (event: PointEvent) => void): () => void {
  emitter.on("event", listener);
  return () => emitter.off("event", listener);
}
