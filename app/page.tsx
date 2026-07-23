import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/setup";
import { getCurrentUser } from "@/lib/auth/session";

export default async function Home() {
  if (!(await isSetupComplete())) redirect("/setup");
  const user = await getCurrentUser();
  redirect(user ? "/dashboard" : "/login");
}
