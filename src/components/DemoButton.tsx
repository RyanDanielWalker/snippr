"use client";

import { useFormStatus } from "react-dom";
import { startDemoAction } from "@/app/actions/start-demo";

function SubmitButton() {
  const { pending } = useFormStatus();
  // aria-disabled, not disabled, so focus stays on the button while the
  // demo is set up (docs/adr/0082). A second press is stopped here instead.
  return (
    <button
      type="submit"
      aria-disabled={pending || undefined}
      onClick={(e) => {
        if (pending) e.preventDefault();
      }}
      className="border border-line-strong text-fg case-control px-6 py-3 rounded-box font-medium hover:border-fg-subtle transition aria-disabled:opacity-60"
    >
      {pending ? "Setting it up..." : "Try the demo"}
    </button>
  );
}

export default function DemoButton() {
  return (
    <form action={startDemoAction}>
      <SubmitButton />
    </form>
  );
}
