"use client";

import clsx from "clsx";
import { useState, type FormEvent } from "react";
import { ArrowRightIcon } from "@/components/ui/icons";

const LIMITS = { name: 120, company: 160, email: 254, message: 4000 } as const;
const FIELD =
  "rounded-lg bg-white/10 hover:bg-white/15 -outline-offset-2! focus:bg-white/15 px-3 py-2 text-d-body-s text-white placeholder-white/50 transition-colors backdrop-blur-sm";
const EMAIL = /^[\w.!#$%&'*+/=?^`{|}~-]+@[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?)*$/i;

type Field = keyof typeof LIMITS;
type Errors = Partial<Record<Field, string>>;

/**
 * Contact form with the shipped fields and validation (module 98317). This
 * reconstruction has no backend: submission validates, then states plainly
 * that nothing was sent instead of faking a successful delivery.
 */
export function ContactForm({ className }: { className?: string }) {
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<string | null>(null);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const next: Errors = {};
    (Object.keys(LIMITS) as Field[]).forEach((k) => {
      const v = String(data.get(k) ?? "").trim();
      if (!v) next[k] = "This field is required";
    });
    const email = String(data.get("email") ?? "");
    if (email && !EMAIL.test(email)) next.email = "Invalid email address";
    setErrors(next);
    if (Object.keys(next).length) return;
    setNotice("Not sent: this local reconstruction has no form backend configured.");
  };

  const input = (name: Exclude<Field, "message">, label: string, autoComplete: string, extra?: string) => (
    <div className="relative flex w-full flex-col justify-end gap-0.5">
      <input
        name={name}
        className={clsx(FIELD, errors[name] && "outline-red! outline-1!", extra)}
        placeholder={label}
        aria-label={label}
        aria-invalid={!!errors[name] || undefined}
        autoComplete={autoComplete}
        maxLength={LIMITS[name]}
        type={name === "email" ? "email" : "text"}
      />
      <p aria-hidden={!errors[name]} className={clsx("text-red text-m-mono font-mono", !errors[name] && "invisible")}>
        {errors[name] || "This field is required"}
      </p>
    </div>
  );

  return (
    <form noValidate className={clsx("flex w-full flex-col gap-2 md:max-w-94", className)} onSubmit={onSubmit}>
      <div className="flex w-full gap-6">
        {input("name", "Name", "name", "w-full")}
        {input("company", "Company", "organization", "w-full")}
      </div>
      {input("email", "E-Mail", "email")}
      <div className="relative flex flex-col justify-end gap-0.5">
        <textarea
          name="message"
          className={clsx(FIELD, "min-h-12 resize-none outline-offset-0!", errors.message && "outline-red! outline-1!")}
          placeholder="Message"
          aria-label="Message"
          aria-invalid={!!errors.message || undefined}
          maxLength={LIMITS.message}
        />
        <p aria-hidden={!errors.message} className={clsx("text-red text-m-mono font-mono", !errors.message && "invisible")}>
          This field is required
        </p>
      </div>
      <button
        type="submit"
        className="text-d-cta flex h-11 cursor-pointer items-center justify-between rounded-full border border-white/20 bg-transparent! px-5 text-white/40 backdrop-blur-sm transition-colors hover:text-white/100"
      >
        Submit Form
        <ArrowRightIcon className="size-4.5" />
      </button>
      <p role="status" aria-live="polite" className={clsx("text-yellow text-m-mono font-mono", !notice && "sr-only")}>
        {notice}
      </p>
    </form>
  );
}
