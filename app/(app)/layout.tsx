import { LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/setup";
import { countLowStock } from "@/lib/queries";
import { Sidebar, BottomTabs } from "@/components/nav";
import { logout } from "./actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const settings = await getSettings();
  const lowStock = await countLowStock();

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-200 px-4 py-4">
          <div className="font-condensed text-xl font-semibold text-slate-900">
            MMS
          </div>
          {settings && (
            <div className="truncate text-[13px] text-slate-500">
              {settings.factoryName}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <Sidebar lowStock={lowStock} />
        </div>
        <div className="border-t border-slate-200 p-3">
          <div className="mb-2 px-1">
            <div className="truncate text-[14px] font-medium text-slate-900">
              {user.name}
            </div>
            <div className="truncate text-[12px] text-slate-500 capitalize">
              {user.role}
            </div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-[14px] text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <div className="font-condensed text-lg font-semibold text-slate-900">
          MMS
        </div>
        <form action={logout}>
          <button
            type="submit"
            aria-label="Sign out"
            className="flex h-11 w-11 items-center justify-center rounded-md text-slate-500 hover:bg-slate-50 cursor-pointer"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </form>
      </header>

      {/* Content */}
      <main className="flex-1 pb-20 md:pb-0">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
          {children}
        </div>
      </main>

      <BottomTabs lowStock={lowStock} />
    </div>
  );
}
