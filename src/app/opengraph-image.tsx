import { ImageResponse } from "next/og";
import { landingSamples, searchExample } from "@/lib/landing-samples";
import { siteHeadline, siteName } from "@/lib/site";

// The picture that shows up when someone shares a snippr.dev link. It's
// built at deploy time from the same copy as the landing page, so it can't
// go stale the way a hand-exported PNG would. ImageResponse supports flexbox
// and a subset of CSS, not Tailwind, hence the inline styles. Its built-in
// font is Geist, which matches the site. Stick to characters Geist has: a
// missing glyph makes it fetch a fallback font over the network at build.

export const alt = `${siteName}: an AI search for "${searchExample.query}" finding a saved snippet.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Tailwind's gray and blue values, so the image matches the landing page.
const colors = {
  page: "#030712", // gray-950
  card: "#111827", // gray-900
  border: "#1f2937", // gray-800
  heading: "#ffffff",
  body: "#9ca3af", // gray-400
  muted: "#6b7280", // gray-500
  accent: "#60a5fa", // blue-400
  accentBg: "#172554", // blue-950
};

export default function Image() {
  const result = landingSamples.find((s) => s.id === searchExample.resultId);
  if (!result) throw new Error("searchExample.resultId has no matching sample");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: colors.page,
          color: colors.body,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 32, color: colors.heading }}>{siteName}</div>
          <div
            style={{
              fontSize: 64,
              lineHeight: 1.1,
              color: colors.heading,
              maxWidth: 900,
            }}
          >
            {siteHeadline}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "16px 20px",
              background: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              fontSize: 26,
              color: "#e5e7eb", // gray-200
            }}
          >
            <span
              style={{
                fontSize: 20,
                color: colors.accent,
                background: colors.accentBg,
                padding: "4px 10px",
                borderRadius: 6,
              }}
            >
              AI
            </span>
            {searchExample.query}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "20px 24px",
              background: colors.card,
              border: "2px solid rgba(59, 130, 246, 0.6)", // ring-blue-500/60
              borderRadius: 12,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 28, color: colors.heading }}>
                {result.title}
              </div>
              <div style={{ fontSize: 22, color: colors.muted }}>
                {result.description}
              </div>
            </div>
            <span
              style={{
                fontSize: 20,
                color: colors.accent,
                background: colors.accentBg,
                padding: "4px 10px",
                borderRadius: 6,
              }}
            >
              {result.language}
            </span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
