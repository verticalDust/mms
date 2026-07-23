"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { login, type FormState } from "./actions";

export function LoginForm() {
  const [state, action] = useActionState<FormState, FormData>(login, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoFocus
          autoComplete="email"
          placeholder="name@company.com"
        />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </Field>
      {state.error && (
        <p role="alert" className="text-[13px] text-red-600">
          {state.error}
        </p>
      )}
      <SubmitButton>Sign in</SubmitButton>
      <Link
        href="/forgot"
        className="text-center text-[13px] text-slate-500 hover:text-slate-700"
      >
        Forgot password?
      </Link>
    </form>
  );
}
