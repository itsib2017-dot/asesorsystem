import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_NAME: z.string().default("webapps_asesor"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url({ message: "NEXT_PUBLIC_SUPABASE_URL must be a valid URL" }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, { message: "NEXT_PUBLIC_SUPABASE_ANON_KEY is required" }),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, { message: "SUPABASE_SERVICE_ROLE_KEY is required on server" }).optional(),
  DATABASE_URL: z.string().optional(),
  DIRECT_URL: z.string().optional(),
  BYOK_ENCRYPTION_SECRET: z.string().min(32, { message: "BYOK_ENCRYPTION_SECRET must be at least 32 characters for AES-256" }).optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.format());
    // Only throw in production or when explicitly configured
    if (process.env.NODE_ENV === "production" && !process.env.NEXT_PHASE) {
      throw new Error(`Environment validation failed: ${JSON.stringify(parsed.error.format())}`);
    }
    return process.env as unknown as Env;
  }

  return parsed.data;
}

export const env = validateEnv();
