import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/setup";
import { SetupForm } from "./setup-form";

export const metadata = { title: "Set up MMS" };

export default async function SetupPage() {
  if (await isSetupComplete()) redirect("/login");
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6">
        <div className="font-condensed text-2xl font-semibold text-slate-900">
          Set up MMS
        </div>
        <p className="mt-1 text-slate-600">
          Create the first admin account and name your factory. This takes a
          minute.
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <SetupForm />
      </div>
    </main>
  );
}
