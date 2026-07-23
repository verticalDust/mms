"use client";

import { Printer } from "lucide-react";
import { buttonClass } from "@/components/ui";

export function PrintButton({ children = "Print" }: { children?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={buttonClass("primary")}
    >
      <Printer className="h-4 w-4" />
      {children}
    </button>
  );
}
