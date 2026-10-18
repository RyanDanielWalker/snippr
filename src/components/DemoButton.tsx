"use client";

import { useFormStatus } from "react-dom";
import { startDemoAction } from "@/app/actions/start-demo";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-gray-700 text-white px-6 py-3 rounded-lg font-medium hover:border-gray-500 transition disabled:opacity-60"
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
