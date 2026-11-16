"use client";

import { formatCreated } from "@/lib/snippet-date";
import { useTimeZone } from "@/components/useTimeZone";

/** When a snippet was made. `<time>` keeps the exact moment in the markup. */
export default function CreatedDate({
  iso,
  className = "",
}: {
  iso: string;
  className?: string;
}) {
  const timeZone = useTimeZone();
  return (
    <time dateTime={iso} className={className}>
      {formatCreated(iso, new Date(), timeZone)}
    </time>
  );
}
