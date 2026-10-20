/**
 * Reads a Route Handler's JSON body and checks it against a schema.
 *
 * Returns the parsed data, or a 400 response ready to send back with the
 * first problem as `{ error }`. Malformed JSON gets the same treatment
 * instead of throwing, which used to surface as a 500.
 *
 * Uses the plain `Response`, not `NextResponse`, so tests don't need Next.
 */

import type { z } from "zod";

export type ParsedBody<T> =
  { ok: true; data: T } | { ok: false; response: Response };

export async function parseBody<Schema extends z.ZodType>(
  req: Request,
  schema: Schema,
): Promise<ParsedBody<z.output<Schema>>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return invalid("Expected a JSON body.");
  }

  const result = schema.safeParse(json);
  if (!result.success) return invalid(result.error.issues[0].message);
  return { ok: true, data: result.data };
}

function invalid(error: string): ParsedBody<never> {
  return { ok: false, response: Response.json({ error }, { status: 400 }) };
}
