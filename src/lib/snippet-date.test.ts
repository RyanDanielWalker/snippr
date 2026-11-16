import { describe, expect, it } from "vitest";
import { formatCreated } from "@/lib/snippet-date";

const now = new Date("2026-11-16T12:00:00Z");

describe("formatCreated", () => {
  it("leaves the year off this year", () => {
    expect(formatCreated("2026-03-04T12:00:00Z", now, "UTC")).toBe("Mar 4");
  });

  it("shows the year before this one", () => {
    expect(formatCreated("2025-11-16T12:00:00Z", now, "UTC")).toBe(
      "Nov 16, 2025",
    );
  });

  // 9pm in New York on the 15th is 2am on the 16th in UTC.
  it("uses the day in the given time zone", () => {
    const evening = "2026-11-16T02:00:00Z";
    expect(formatCreated(evening, now, "UTC")).toBe("Nov 16");
    expect(formatCreated(evening, now, "America/New_York")).toBe("Nov 15");
  });

  it("decides the year in the given time zone too", () => {
    const newYearsEve = "2026-01-01T02:00:00Z";
    expect(formatCreated(newYearsEve, now, "America/New_York")).toBe(
      "Dec 31, 2025",
    );
  });
});
