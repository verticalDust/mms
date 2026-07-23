import * as React from "react";
import { cn } from "@/lib/cn";

// Button — one safety-orange primary per screen; everything else slate.
const buttonVariants = {
  primary:
    "bg-orange-600 text-white hover:bg-orange-500 focus-visible:ring-orange-600",
  secondary:
    "bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 focus-visible:ring-slate-400",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-400",
  danger:
    "bg-red-600 text-white hover:bg-red-500 focus-visible:ring-red-600",
} as const;

export function buttonClass(
  variant: keyof typeof buttonVariants = "secondary",
  full = false,
) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md px-4 h-11 min-h-11 text-[15px] font-medium transition-colors cursor-pointer",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
    "disabled:cursor-not-allowed disabled:opacity-60",
    buttonVariants[variant],
    full && "w-full",
  );
}

export function Button({
  variant = "secondary",
  full = false,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariants;
  full?: boolean;
}) {
  return <button className={cn(buttonClass(variant, full), className)} {...props} />;
}

const fieldControl =
  "h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldControl, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(fieldControl, "h-auto min-h-24 py-2 leading-relaxed", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldControl, "cursor-pointer", className)} {...props} />;
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "font-condensed text-[13px] font-medium tracking-wide text-slate-600",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  htmlFor,
  error,
  children,
  hint,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-[13px] text-slate-500">{hint}</p>}
      {error && (
        <p role="alert" className="text-[13px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

// Section label — condensed, tracked, never ALL CAPS (DESIGN.md).
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-condensed text-[13px] font-medium tracking-wide text-slate-600">
      {children}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
      {icon && <div className="text-slate-400">{icon}</div>}
      <p className="text-slate-600">{title}</p>
      {action}
    </div>
  );
}

// Mono tabular figure — the instrument-readout treatment for codes and numbers.
export function Mono({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("font-mono tabular-nums", className)}>{children}</span>
  );
}
