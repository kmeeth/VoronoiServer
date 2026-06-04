import { prisma } from "./db";

export type Point = {
  id: string;
  x: number;
  y: number;
  color: string;
};

export function list(): Promise<Point[]> {
  return prisma.point.findMany({
    select: { id: true, x: true, y: true, color: true },
  });
}

export function add(input: {
  x: number;
  y: number;
  color: string;
}): Promise<Point> {
  return prisma.point.create({
    data: input,
    select: { id: true, x: true, y: true, color: true },
  });
}

// Idempotent on a missing id (deleteMany returns count 0 instead of throwing),
// matching the old in-memory Map.delete and tolerating concurrent deletes of the
// same point in the free-for-all model.
export async function remove(id: string): Promise<void> {
  await prisma.point.deleteMany({ where: { id } });
}
