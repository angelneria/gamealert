import { PrismaClient } from "@prisma/client";
import { createClient } from "@libsql/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import {
  resolveDatabaseConfig,
  assertDatabaseConfig,
} from "./db-config";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient(): PrismaClient {
  const cfg = resolveDatabaseConfig(process.env);
  assertDatabaseConfig(cfg);
  if (cfg.kind === "turso") {
    const libsql = createClient({ url: cfg.url, authToken: cfg.authToken });
    return new PrismaClient({
      adapter: new PrismaLibSQL(libsql),
      log: process.env.NODE_ENV === "development" ? ["query"] : [],
    });
  }
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export const db = {
  async getUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },
  async createUser(data: any) {
    return prisma.user.create({ data });
  },
  async upsertSubscription(userId: string, platform: string) {
    return prisma.subscription.upsert({
      where: { userId_platform: { userId, platform } },
      update: { isActive: true },
      create: { userId, platform, isActive: true },
    });
  },
};
