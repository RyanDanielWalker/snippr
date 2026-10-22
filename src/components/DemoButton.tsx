"use client";

import { useFormStatus } from "react-dom";
import { startDemoAction } from "@/app/actions/start-demo";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-line-strong text-fg case-control px-6 py-3 rounded-box font-medium hover:border-fg-subtle transition disabled:opacity-60"
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
