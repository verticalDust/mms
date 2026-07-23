import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { Factory, TriangleAlert, Wrench } from "lucide-react";
import { db } from "@/lib/db";
import { machines } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { Mono } from "@/components/ui";

export const metadata = { title: "Scan · MMS" };

// The QR-label target. One URL, auth decides the view (PLAN §1.5):
//   • signed-in staff  → the internal machine page
//   • anonymous + live → the public fault-report surface (E5-S1, week 5) —
//                        stubbed here so pilot labels never need reprinting
//   • dead / retired   → a friendly no-blame page (E5-S4)
// Public and anonymous by design (see proxy PUBLIC_PREFIXES); never leaks any
// internal data beyond the code + name already printed on the physical label.
export default async function ScanPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  // Next already percent-decodes route params — do NOT decode again, or a code
  // containing '%' throws URIError and the scan 500s at the machine.
  const { code } = await params;

  const [machine] = await db
    .select({
      id: machines.id,
      code: machines.code,
      name: machines.name,
      retiredAt: machines.retiredAt,
    })
    .from(machines)
    .where(eq(machines.code, code))
    .limit(1);

  // Staff who scan get the full machine page (including retired history).
  const user = await getCurrentUser();
  if (machine && user) redirect(`/machines/${machine.id}`);

  const active = machine && !machine.retiredAt;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-5 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
        {active ? (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Wrench className="h-6 w-6" />
            </div>
            <Mono className="mt-5 block text-[13px] font-medium text-slate-500">
              {machine.code}
            </Mono>
            <h1 className="font-condensed text-2xl font-semibold text-slate-900">
              {machine.name}
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
              Fault reporting for this machine is coming soon. For now, please
              tell a supervisor if something is wrong.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <TriangleAlert className="h-6 w-6" />
            </div>
            <h1 className="mt-5 font-condensed text-2xl font-semibold text-slate-900">
              This code isn&rsquo;t active
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
              Please tell a supervisor so they can check the machine.
            </p>
          </>
        )}
      </div>
      <div className="mt-6 flex items-center gap-1.5 text-[12px] text-slate-500">
        <Factory className="h-3.5 w-3.5" />
        <span className="font-condensed tracking-wide">MMS</span>
      </div>
    </main>
  );
}
