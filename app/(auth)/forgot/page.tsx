import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Reset password · MMS" };

// Stub until E0-S8 (self-serve reset vs admin temp password — decision D6).
export default function ForgotPage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center px-4 py-10">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="font-condensed text-xl font-semibold text-slate-900">
          Reset your password
        </h1>
        <p className="mt-2 text-[15px] text-slate-600">
          Password reset by email is coming soon. For now, ask an admin to set a
          temporary password for you.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-flex items-center gap-1.5 text-[14px] text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
