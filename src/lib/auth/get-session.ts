import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function getSession() {
  const supabase = await getSupabaseServerClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) {
    return null;
  }
  return session;
}

export async function getUser() {
  const supabase = await getSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return null;
  }
  return user;
}

export async function requireUser() {
  const user = await getUser();
  if (!user) {
    throw new Error("UNAUTHORIZED: Session required");
  }
  return user;
}
