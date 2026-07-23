"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { cn } from "@/lib/cn";

// A submit button that asks for confirmation before firing its form's server
// action, and shows the pending spinner (DoD). For reversible-but-notable
// actions like retiring a machine.
export function ConfirmSubmit({
  children,
  message,
  variant = "danger",
  full = false,
  icon,
  compact = false,
  label,
}: {
  children?: React.ReactNode;
  message: string;
  variant?: "primary" | "secondary" | "danger";
  full?: boolean;
  // A rendered element (e.g. <Ban className="h-4 w-4" />), NOT a component
  // reference — component references can't cross the server→client boundary.
  icon?: React.ReactNode;
  // compact = a 44px icon-only square (for row actions); `label` names it.
  compact?: boolean;
  label?: string;
}) {
  const { pending } = useFormStatus();
  const guard = (e: React.MouseEvent) => {
    if (!window.confirm(message)) e.preventDefault();
  };

  if (compact) {
    return (
      <button
        type="submit"
        disabled={pending}
        aria-label={label}
        onClick={guard}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-red-600 disabled:opacity-60 cursor-pointer"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      </button>
    );
  }

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={guard}
      className={cn(buttonClass(variant, full))}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}
