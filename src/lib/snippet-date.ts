/**
 * How a card says when its snippet was made: "Nov 16" this year, and
 * "Nov 16, 2025" before it. The year only shows when it isn't this one, so
 * the common case stays short.
 *
 * `timeZone` decides which day a moment falls on. A snippet saved at 9pm in
 * New York is already the next day in UTC, so the browser passes its own
 * zone. The server, which can't know it, passes "UTC" (see useTimeZone).
 */
export function formatCreated(
  iso: string,
  now: Date,
  timeZone: string | undefined,
): string {
  const date = new Date(iso);
  const year = (d: Date) =>
    new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone }).format(d);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(year(date) === year(now) ? {} : { year: "numeric" }),
    timeZone,
  }).format(date);
}
