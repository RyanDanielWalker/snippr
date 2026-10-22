import { ImageResponse } from "next/og";
import LogoMark from "@/components/LogoMark";
import { defaultTheme } from "@/lib/theme-tokens";

// The home screen icon on iPhones and iPads. Square, because iOS rounds the
// corners itself, with room around the mark so the rounding doesn't clip it.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: defaultTheme.page,
      }}
    >
      <LogoMark size={120} braces={defaultTheme.fg} cut={defaultTheme.accent} />
    </div>,
    size,
  );
}
