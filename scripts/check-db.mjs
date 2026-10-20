// Runs before every npm script that connects to the database, and stops it
// if DATABASE_URL points anywhere but this machine. See ADR 0015.
//
// Checks every place Next.js or Prisma might read DATABASE_URL from, not just
// the one that wins, so a stray .env.local can't slip past.

import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import {
  findRemoteUrls,
  overrideMessage,
  refusalMessage,
} from "./db-guard.mjs";

const ENV_FILES = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
  ".env.production",
  ".env.production.local",
  "prisma/.env",
];

const found = [];
if (process.env.DATABASE_URL) {
  found.push({ source: "the environment", url: process.env.DATABASE_URL });
}
for (const file of ENV_FILES) {
  if (!existsSync(file)) continue;
  const url = parseEnv(readFileSync(file, "utf8")).DATABASE_URL;
  if (url) found.push({ source: file, url });
}

const remote = findRemoteUrls(found);
if (remote.length > 0) {
  // Only the shell can grant the override. Reading it from .env would let
  // one forgotten line switch the check off for good.
  if (process.env.ALLOW_REMOTE_DB === "1") {
    console.warn(overrideMessage(remote));
  } else {
    console.error(
      refusalMessage(remote, process.env.npm_lifecycle_event ?? "<script>"),
    );
    process.exit(1);
  }
}
