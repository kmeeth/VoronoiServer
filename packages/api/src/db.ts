import { PrismaClient } from "@prisma/client";

// Reuse a single PrismaClient across hot reloads (dev) and warm serverless
// invocations (prod). A fresh client per module-eval would open a new connection
// pool each time and exhaust the database's connection limit.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
