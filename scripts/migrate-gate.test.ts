import { describe, expect, it } from "vitest";
import { migrationDecision } from "./migrate-gate.mjs";

describe("migrationDecision", () => {
  it("migrates on production builds", () => {
    expect(migrationDecision("production").migrate).toBe(true);
  });

  it("skips preview builds, which may still hold production's URL", () => {
    const decision = migrationDecision("preview");
    expect(decision.migrate).toBe(false);
    expect(decision.reason).toContain("a preview build");
  });

  it("skips development builds", () => {
    expect(migrationDecision("development").migrate).toBe(false);
  });

  it("skips builds outside Vercel", () => {
    const decision = migrationDecision(undefined);
    expect(decision.migrate).toBe(false);
    expect(decision.reason).toContain("not a Vercel build");
  });

  it("skips anything that isn't exactly production", () => {
    for (const value of ["", "Production", "production ", "prod"]) {
      expect(migrationDecision(value).migrate).toBe(false);
    }
  });
});
