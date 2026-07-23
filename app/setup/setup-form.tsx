"use client";

import { useActionState, useEffect, useState } from "react";
import { Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { completeSetup, type FormState } from "./actions";

export function SetupForm() {
  const [state, action] = useActionState<FormState, FormData>(completeSetup, {});
  const [tz, setTz] = useState("UTC");

  useEffect(() => {
    try {
      setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    } catch {
      /* keep UTC */
    }
  }, []);

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        <div className="font-condensed text-[13px] font-medium tracking-wide text-slate-600">
          Admin account
        </div>
        <Field label="Your name" htmlFor="name">
          <Input id="name" name="name" required autoComplete="name" />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="name@company.com"
          />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 8 characters.">
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
          />
        </Field>
      </div>

      <div className="flex flex-col gap-4 border-t border-slate-200 pt-5">
        <div className="font-condensed text-[13px] font-medium tracking-wide text-slate-600">
          Factory
        </div>
        <Field label="Factory name" htmlFor="factoryName">
          <Input id="factoryName" name="factoryName" required />
        </Field>
        <Field
          label="Timezone"
          htmlFor="timezone"
          hint="Used for every date, bucket, and scheduled job."
        >
          <Input
            id="timezone"
            name="timezone"
            required
            value={tz}
            onChange={(e) => setTz(e.target.value)}
          />
        </Field>
      </div>

      {state.error && (
        <p role="alert" className="text-[13px] text-red-600">
          {state.error}
        </p>
      )}

      <SubmitButton>Create account and continue</SubmitButton>
    </form>
  );
}
