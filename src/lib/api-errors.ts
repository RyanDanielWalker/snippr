/**
 * The one error shape every Route Handler sends (see docs/adr/0017).
 *
 * Every error is `{ error: string }` with a status code. The status is the
 * part a program reads; the message is written for a person and shown in
 * the interface as is, so it's written by hand, never an exception's text.
 *
 * Uses the plain `Response`, not `NextResponse`, so tests don't need Next.
 */

import { APIError } from "@anthropic-ai/sdk";
import type { AiLimitReason } from "@/lib/rate-limit";

export function apiError(
  status: number,
  error: string,
  headers?: HeadersInit,
): Response {
  return Response.json({ error }, { status, headers });
}

export function unauthorized(): Response {
  return apiError(401, "You're signed out. Sign in again.");
}

export function tooManyRequests(retryAfterSeconds: number): Response {
  return apiError(429, "That's a lot of AI for one hour. Try again in a bit.", {
    "Retry-After": String(retryAfterSeconds),
  });
}

/**
 * When something comes back, in words that hold in any time zone: "in about
 * 7 hours" rather than a clock time (docs/adr/0047). Rounded to the hour,
 * since the daily limits reset at midnight UTC and nobody needs minutes.
 */
export function backIn(seconds: number): string {
  const hours = Math.round(seconds / 3600);
  if (hours < 1) return "in under an hour";
  if (hours === 1) return "in about an hour";
  return `in about ${hours} hours`;
}

/** Every demo guest together has used the day's AI calls (docs/adr/0046). */
export function guestAiCeilingReached(retryAfterSeconds: number): Response {
  return apiError(
    429,
    `The demo has used up its AI for today. It's back ${backIn(retryAfterSeconds)}, or sign in to keep going.`,
    { "Retry-After": String(retryAfterSeconds) },
  );
}

/** Guests from one address have used its share of the day (docs/adr/0047). */
export function guestAiAddressLimitReached(
  retryAfterSeconds: number,
): Response {
  return apiError(
    429,
    `Your network has used up its share of the demo's AI for today. It's back ${backIn(retryAfterSeconds)}, or sign in to keep going.`,
    { "Retry-After": String(retryAfterSeconds) },
  );
}

/** The response for an AI call that a limit stopped. */
export function aiLimitResponse(limit: {
  retryAfterSeconds: number;
  reason: AiLimitReason;
}): Response {
  switch (limit.reason) {
    case "guest-ceiling":
      return guestAiCeilingReached(limit.retryAfterSeconds);
    case "address-limit":
      return guestAiAddressLimitReached(limit.retryAfterSeconds);
    case "own-limit":
      return tooManyRequests(limit.retryAfterSeconds);
  }
}

/**
 * The response for something that threw. A failed Claude call is a `502`
 * (the problem is upstream, not in the request or our database); anything
 * else is a `500`. The details go to the server log, never to the client.
 */
export function unexpectedError(
  err: unknown,
  log: (...args: unknown[]) => void = console.error,
): Response {
  log("Route Handler threw:", err);
  if (err instanceof APIError) {
    return apiError(502, "Claude didn't answer. Try again in a minute.");
  }
  return apiError(500, "Something broke on our end. Try again.");
}

/**
 * Wraps a Route Handler so anything it throws becomes an error in the usual
 * shape, instead of Next's empty `500`.
 */
export function withErrors<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (err) {
      return unexpectedError(err);
    }
  };
}
