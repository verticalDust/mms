"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { cn } from "@/lib/cn";

// Disables itself + shows a spinner while the server action is pending (DoD).
export function SubmitButton({
  children,
  variant = "primary",
  full = true,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger";
  full?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(buttonClass(variant, full, "lg"))}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
