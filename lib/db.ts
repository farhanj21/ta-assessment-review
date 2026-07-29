import { PrismaClient } from '@prisma/client';

/**
 * Prisma singleton.
 *
 * Next's dev server hot-reloads modules on every edit. Without stashing the
 * client on globalThis, each reload constructs a new PrismaClient and opens a
 * new connection pool, and you exhaust connections within a few minutes of
 * editing. In production the module is evaluated once, so the global is unused.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
