import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

let cachedDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): boolean {
  return Boolean(value && UUID_RE.test(value));
}

export function hasDatabaseUrl(): boolean {
  if (process.env.ENABLE_DIRECT_DB !== "true") return false;
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
export type RlsTx = Parameters<Parameters<DrizzleDb["transaction"]>[0]>[0];

/**
 * Executes a Drizzle operation inside a transaction scoped by RLS JWT claims (ADR-0004).
 */
export async function withRlsTransaction<T>(
  userId: string,
  fn: (tx: RlsTx) => Promise<T>,
): Promise<T> {
  const db = getDb();
  const claims = JSON.stringify({ sub: userId, role: "authenticated" });

  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role authenticated`);
    await tx.execute(sql`select set_config('request.jwt.claims', ${claims}, true)`);
    return fn(tx);
  });
}

export interface DualPathRlsOptions<T> {
  userId: string;
  label: string;
  drizzle: (tx: RlsTx) => Promise<T>;
  supabase: () => Promise<T>;
  fallbackOnError?: boolean;
  unscopedPublicRead?: false;
}

export interface DualPathPublicReadOptions<T> {
  userId?: undefined;
  unscopedPublicRead: true;
  label: string;
  drizzle: (db: DrizzleDb) => Promise<T>;
  supabase: () => Promise<T>;
  fallbackOnError?: boolean;
}

export type DualPathOptions<T> = DualPathRlsOptions<T> | DualPathPublicReadOptions<T>;

/**
 * Runs a Drizzle + RLS transaction when direct DB access is enabled, falling back cleanly
 * to the Supabase PostgREST path (which carries the caller's JWT cookies) on disabled/transient failures.
 * System-wide public config reads must opt in explicitly via `unscopedPublicRead: true`.
 */
export async function runRepositoryDualPath<T>(options: DualPathOptions<T>): Promise<T> {
  if (hasDatabaseUrl()) {
    try {
      if (options.unscopedPublicRead) {
        return await options.drizzle(getDb());
      }
      if (!options.userId) {
        throw new Error(`AUTH_ERROR: Missing userId for RLS repository call (${options.label}).`);
      }
      return await withRlsTransaction(options.userId, options.drizzle);
    } catch (err) {
      if (options.fallbackOnError === false) {
        throw err;
      }
      console.warn(
        `[${options.label} Warning] Direct DB fallback to Supabase REST:`,
        err instanceof Error ? err.message : "unknown",
      );
    }
  }

  return options.supabase();
}
