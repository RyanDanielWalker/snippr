import { describe, expect, it } from "vitest";
import { DEFAULT_E2E_DATABASE_URL, e2eDatabase } from "./e2e-guard.mjs";

describe("e2eDatabase", () => {
  it("uses the local e2e database by default", () => {
    expect(e2eDatabase({})).toEqual({ ok: true, url: DEFAULT_E2E_DATABASE_URL });
  });

  it("takes E2E_DATABASE_URL when it's local and named for tests", () => {
    const url = "postgresql://ci:ci@127.0.0.1:5433/snippr_e2e";
    expect(e2eDatabase({ E2E_DATABASE_URL: url })).toEqual({ ok: true, url });
  });

  it("ignores DATABASE_URL, so the dev database is never the target", () => {
    expect(
      e2eDatabase({ DATABASE_URL: "postgresql://snippr:snippr@localhost:5432/snippr" }),
    ).toEqual({ ok: true, url: DEFAULT_E2E_DATABASE_URL });
  });

  it("refuses a remote database and names only the host", () => {
    const result = e2eDatabase({
      E2E_DATABASE_URL:
        "postgresql://postgres.abc:s3cret@aws-0-us-east-1.pooler.supabase.com:5432/snippr_e2e",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("aws-0-us-east-1.pooler.supabase.com");
    expect(result.message).not.toContain("s3cret");
  });

  it("refuses a local database that isn't named for tests", () => {
    for (const name of ["snippr", "snippr_e2e_backup", "e2e", ""]) {
      const result = e2eDatabase({
        E2E_DATABASE_URL: `postgresql://snippr:snippr@localhost:5432/${name}`,
      });
      expect(result.ok, name).toBe(false);
    }
  });

  it("refuses a URL it can't read", () => {
    expect(e2eDatabase({ E2E_DATABASE_URL: "not a url" }).ok).toBe(false);
  });
});
