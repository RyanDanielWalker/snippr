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
