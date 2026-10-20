import { describe, expect, it } from "vitest";
import {
  findRemoteUrls,
  overrideMessage,
  refusalMessage,
} from "./db-guard.mjs";

const SUPABASE =
  "postgresql://postgres.abcdefgh:s3cret%40pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres";

function at(url: string, source = ".env") {
  return { source, url };
}

describe("findRemoteUrls", () => {
  it("lets local databases through", () => {
    expect(
      findRemoteUrls([
        at("postgresql://snippr:snippr@localhost:5432/snippr"),
        at("postgresql://snippr:snippr@127.0.0.1:5432/snippr"),
        at("postgresql://snippr:snippr@[::1]:5432/snippr"),
        at("postgresql://snippr:snippr@LocalHost/snippr"),
      ]),
    ).toEqual([]);
  });

  it("catches the production pooler", () => {
    expect(findRemoteUrls([at(SUPABASE)])).toEqual([
      { source: ".env", host: "aws-0-us-east-1.pooler.supabase.com" },
    ]);
  });

  it("treats hosts it doesn't recognize as remote", () => {
    expect(
      findRemoteUrls([at("postgresql://u:p@db.example.com/x")]),
    ).toHaveLength(1);
    expect(
      findRemoteUrls([at("postgresql://u:p@localhost.example.com/x")]),
    ).toHaveLength(1);
  });

  it("refuses a URL it can't read instead of guessing", () => {
    expect(findRemoteUrls([at("not a url")])).toEqual([
      { source: ".env", host: null },
    ]);
    expect(findRemoteUrls([at("postgresql:///snippr?host=/tmp")])).toEqual([
      { source: ".env", host: null },
    ]);
  });

  it("finds a remote URL even when another source is local", () => {
    const remote = findRemoteUrls([
      at("postgresql://snippr:snippr@localhost:5432/snippr", ".env"),
      at(SUPABASE, ".env.local"),
    ]);
    expect(remote.map((r) => r.source)).toEqual([".env.local"]);
  });

  it("has nothing to say when no URL is set", () => {
    expect(findRemoteUrls([])).toEqual([]);
  });
});

describe("refusalMessage", () => {
  const message = refusalMessage(findRemoteUrls([at(SUPABASE)]), "dev");

  it("says where the URL came from, where it points, and how to override", () => {
    expect(message).toContain(".env");
    expect(message).toContain("aws-0-us-east-1.pooler.supabase.com");
    expect(message).toContain("ALLOW_REMOTE_DB=1 npm run dev");
  });

  it("never prints the password or the username", () => {
    expect(message).not.toContain("s3cret");
    expect(message).not.toContain("abcdefgh");
  });

  it("explains an unreadable URL without echoing it", () => {
    const unreadable = refusalMessage(
      [{ source: ".env", host: null }],
      "db:push",
    );
    expect(unreadable).toContain("isn't a URL this check can read");
  });
});

describe("overrideMessage", () => {
  it("names each host once", () => {
    const remote = findRemoteUrls([
      at(SUPABASE, ".env"),
      at(SUPABASE, "the environment"),
    ]);
    expect(overrideMessage(remote)).toBe(
      "ALLOW_REMOTE_DB is set. Using aws-0-us-east-1.pooler.supabase.com.",
    );
  });
});
