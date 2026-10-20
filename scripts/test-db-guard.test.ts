import { describe, expect, it } from "vitest";
import {
  DEFAULT_TEST_DATABASE_URL,
  testDatabase,
  wipeableDatabase,
} from "./test-db-guard.mjs";

const rule = { variable: "SOME_URL", suffix: "_test" };

describe("wipeableDatabase", () => {
  it("lets a local database named for tests through", () => {
    const url = "postgresql://ci:ci@127.0.0.1:5433/snippr_test";
    expect(wipeableDatabase(url, rule)).toEqual({ ok: true, url });
  });

  it("refuses a remote database and names only the host", () => {
    const result = wipeableDatabase(
      "postgresql://postgres.abc:s3cret@aws-0-us-east-1.pooler.supabase.com:5432/snippr_test",
      rule,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("aws-0-us-east-1.pooler.supabase.com");
    expect(result.message).not.toContain("s3cret");
  });

  it("refuses a local database without the suffix", () => {
    for (const name of ["snippr", "snippr_test_backup", "snippr_e2e", ""]) {
      const result = wipeableDatabase(
        `postgresql://snippr:snippr@localhost:5432/${name}`,
        rule,
      );
      expect(result.ok, name).toBe(false);
    }
  });

  it("names the variable when the URL can't be read", () => {
    const result = wipeableDatabase("not a url", rule);
    expect(result).toEqual({
      ok: false,
      message: "SOME_URL isn't a URL this check can read.",
    });
  });
});

describe("testDatabase", () => {
  it("uses the local test database by default", () => {
    expect(testDatabase({})).toEqual({
      ok: true,
      url: DEFAULT_TEST_DATABASE_URL,
    });
  });

  it("ignores DATABASE_URL, so the dev database is never the target", () => {
    expect(
      testDatabase({
        DATABASE_URL: "postgresql://snippr:snippr@localhost:5432/snippr",
      }),
    ).toEqual({ ok: true, url: DEFAULT_TEST_DATABASE_URL });
  });

  it("won't take the e2e database, so the two runs never wipe each other", () => {
    const url = "postgresql://snippr:snippr@localhost:5432/snippr_e2e";
    expect(testDatabase({ TEST_DATABASE_URL: url }).ok).toBe(false);
  });
});
