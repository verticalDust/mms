"use client";

import { useActionState, useEffect, useState } from "react";
import { Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useT } from "@/lib/i18n/client";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { completeSetup, type FormState } from "./actions";

export function SetupForm() {
  const [state, action] = useActionState<FormState, FormData>(completeSetup, {});
  const [tz, setTz] = useState("UTC");
  const t = useT();

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
          {t.setup.adminSection}
        </div>
        <Field label={t.setup.name} htmlFor="name">
          <Input id="name" name="name" required autoComplete="name" />
        </Field>
        <Field label={t.auth.email} htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder={t.auth.emailPlaceholder}
          />
        </Field>
        <Field
          label={t.auth.password}
          htmlFor="password"
          hint={t.setup.passwordHint(PASSWORD_MIN_LENGTH)}
        >
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
          {t.setup.factorySection}
        </div>
        <Field label={t.setup.factoryName} htmlFor="factoryName">
          <Input id="factoryName" name="factoryName" required />
        </Field>
        <Field
          label={t.setup.timezone}
          htmlFor="timezone"
          hint={t.setup.timezoneHint}
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

      <SubmitButton>{t.setup.submit}</SubmitButton>
    </form>
  );
}
