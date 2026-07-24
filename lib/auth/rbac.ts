import type { SessionUser } from "./session";

// Two roles, one policy module (DESIGN/PLAN §1.5). Called at the top of every
// mutating server action / route handler — never rely on hidden UI alone.
export type Action =
  // read
  | "machine:view"
  | "part:view"
  | "work:view"
  // technician daily work
  | "work:start"
  | "work:complete"
  | "work:log-parts"
  | "work:check"
  | "stock:receive"
  | "stock:issue"
  | "machine:set-status"
  // admin only
  | "user:manage"
  | "settings:manage"
  | "machine:manage"
  | "part:manage"
  | "stock:adjust"
  | "pm:manage"
  | "work:create"
  | "work:reassign"
  | "work:manage-checklist"
  | "work:cancel"
  | "work:reopen"
  | "report:triage"
  | "delete:any";

const TECHNICIAN_ALLOWED = new Set<Action>([
  "machine:view",
  "part:view",
  "work:view",
  "work:start",
  "work:complete",
  "work:log-parts",
  "work:check",
  "stock:receive",
  "stock:issue",
  "machine:set-status",
]);

export function can(
  user: SessionUser | null | undefined,
  action: Action,
): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return TECHNICIAN_ALLOWED.has(action);
}

/** Throws (→ 403 boundary) when a user lacks permission. Use in actions. */
export function authorize(user: SessionUser | null, action: Action): void {
  if (!can(user, action)) {
    throw new Error("FORBIDDEN");
  }
}
