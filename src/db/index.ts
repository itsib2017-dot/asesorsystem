import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

let cachedDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function hasDatabaseUrl(): boolean {
  const url = process.env.DATABASE_URL;
  return Boolean(url && !url.includes("[YOUR-PASSWORD]"));
}

export function getDb() {
  if (cachedDb) return cachedDb;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || connectionString.includes("[YOUR-PASSWORD]")) {
    throw new Error("[Drizzle DB] DATABASE_URL is not configured.");
  }
  const client = postgres(connectionString, { prepare: false, max: 10 });
  cachedDb = drizzle(client, { schema });
  return cachedDb;
}

export type DrizzleDb = ReturnType<typeof getDb>;

/**
 * Executes a Drizzle operation inside a transaction scoped by RLS JWT claims (ADR-0004).
 */
export async function withRlsTransaction<T>(
  userId: string,
  fn: (tx: Parameters<Parameters<DrizzleDb["transaction"]>[0]>[0]) => Promise<T>,
): Promise<T> {
  const db = getDb();
  const claims = JSON.stringify({ sub: userId, role: "authenticated" });

  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role authenticated`);
    await tx.execute(sql`select set_config('request.jwt.claims', ${claims}, true)`);
    return fn(tx);
  });
}
