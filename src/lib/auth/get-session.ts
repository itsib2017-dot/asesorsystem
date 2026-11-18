import { getSupabaseServerClient } from "@/lib/supabase/server";

function hasSupabasePublicEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export async function getSession() {
  if (!hasSupabasePublicEnv()) {
    return null;
  }
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error || !session) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function getUser() {
  if (!hasSupabasePublicEnv()) {
    return null;
  }
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getUser();
  if (!user) {
    throw new Error("UNAUTHORIZED: Session required");
  }
  return user;
}
