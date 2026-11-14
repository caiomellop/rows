"use client";

import { useState, useTransition } from "react";

export function ContactButton({ reveal }: { reveal: () => Promise<string | null> }) {
  const [email, setEmail] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (email) {
    return (
      <a href={`mailto:${email}`} className="btn-primary h-10 rounded-xl px-5 text-[15px]">
        {email}
      </a>
    );
  }
  return (
    <button
      type="button"
      className="btn-primary h-10 rounded-xl px-5 text-[15px]"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const value = await reveal();
          if (value) {
            setEmail(value);
            window.location.href = `mailto:${value}`;
          }
        })
      }
    >
      {pending ? "…" : "Contact"}
    </button>
  );
}
