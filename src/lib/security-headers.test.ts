import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { securityHeaders } from "./security-headers";

function header(key: string) {
  return securityHeaders.find((h) => h.key === key)?.value;
}

describe("security headers", () => {
  it("refuses to be framed by any site", () => {
    expect(header("Content-Security-Policy")).toBe("frame-ancestors 'none'");
    expect(header("X-Frame-Options")).toBe("DENY");
  });

  it("turns off content sniffing", () => {
    expect(header("X-Content-Type-Options")).toBe("nosniff");
  });

  it("sends each header once", () => {
    const keys = securityHeaders.map((h) => h.key.toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("applies them to every path in next.config.ts", async () => {
    const rules = await nextConfig.headers!();
    const everyPath = rules.find((r) => r.source === "/:path*");
    expect(everyPath?.headers).toEqual(securityHeaders);
  });
});
