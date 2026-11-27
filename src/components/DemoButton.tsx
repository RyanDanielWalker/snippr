"use client";

import { useFormStatus } from "react-dom";
import { startDemoAction } from "@/app/actions/start-demo";
import { unavailableButton } from "@/lib/unavailable-button";

function SubmitButton() {
  const { pending } = useFormStatus();
  // Stays focusable while the demo is set up, and a second press doesn't
  // send the form again (docs/adr/0082).
  return (
    <button
      type="submit"
      {...unavailableButton(pending)}
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
