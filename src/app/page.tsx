import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/get-session";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const user = await getUser();
  redirect(user ? "/dashboard" : "/login");
}
