import { currentUser } from "@/lib/auth";
import { withErrors } from "@/lib/api-errors";
import { tokenStore } from "@/lib/token-store";
import { createToken, deleteToken, listTokens } from "@/lib/api-tokens";

// The rules live in src/lib/api-tokens.ts, where they're tested
// (docs/adr/0024). Only a browser session can manage tokens: a token can't
// make or revoke another one.

export const GET = withErrors(async () =>
  listTokens(tokenStore, await currentUser()),
);

export const POST = withErrors(async (req: Request) =>
  createToken(tokenStore, await currentUser(), req),
);

export const DELETE = withErrors(async (req: Request) =>
  deleteToken(tokenStore, await currentUser(), req),
);
