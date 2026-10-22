import { ImageResponse } from "next/og";
import LogoMark from "@/components/LogoMark";
import { defaultTheme } from "@/lib/theme-tokens";

// The browser tab icon, drawn from the same mark as the header (ADR 0028).
// A PNG rather than icon.svg, because not every browser takes an SVG icon.

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: defaultTheme.page,
        borderRadius: 7,
      }}
    >
      <LogoMark size={30} braces={defaultTheme.fg} cut={defaultTheme.accent} />
    </div>,
    size,
  );
}
