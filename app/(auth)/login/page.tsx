import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/setup";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · MMS" };

export default async function LoginPage() {
  if (!(await isSetupComplete())) redirect("/setup");
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <div className="font-condensed text-3xl font-semibold tracking-tight text-slate-900">
          MMS
        </div>
        <p className="mt-1 text-slate-600">Maintenance Management System</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <LoginForm />
      </div>
    </main>
  );
}
