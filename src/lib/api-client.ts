/**
 * How the interface talks to the API (see docs/adr/0017).
 *
 * Every error the API sends is `{ error }` with a message written for a
 * person, so the interface can show it as is. `callApi` turns each way a
 * request can go wrong into that one message: an error response, a
 * response that isn't the usual shape, or no response at all because the
 * connection dropped.
 */

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export const GENERIC_ERROR =
  "Couldn't reach Snippr. Check your connection and try again.";

export async function callApi<T = unknown>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  const json: unknown = await res.json().catch(() => null);
  if (res.ok) return { ok: true, data: json as T };
  return { ok: false, error: errorMessage(json) };
}

/** The `error` from an error body, or the generic message if there isn't one. */
export function errorMessage(json: unknown): string {
  if (json && typeof json === "object" && "error" in json) {
    const { error } = json;
    if (typeof error === "string" && error.trim()) return error;
  }
  return GENERIC_ERROR;
}
