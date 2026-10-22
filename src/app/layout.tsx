import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Press_Start_2P,
  Space_Grotesk,
  VT323,
} from "next/font/google";
import { cookies } from "next/headers";
import { siteDescription, siteName, siteUrl } from "@/lib/site";
import { THEME_COOKIE, parseTheme, themeAttribute } from "@/lib/theme";
import { ThemeProvider } from "@/components/ThemeToggle";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Headings and the wordmark only, so only the bold weight (ADR 0028).
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: "700",
});

// The 8-bit theme's headings (ADR 0029). Not preloaded: a browser only
// fetches it once something on the page uses it.
const pressStart = Press_Start_2P({
  variable: "--font-press-start",
  subsets: ["latin"],
  weight: "400",
  preload: false,
});

// The 8-bit theme's UI text (ADR 0030). Not preloaded either.
const vt323 = VT323({
  variable: "--font-vt323",
  subsets: ["latin"],
  weight: "400",
  preload: false,
});

// The image itself comes from opengraph-image.tsx next to this file; Next.js
// adds its og:image tags to every page on its own.
export const metadata: Metadata = {
  // Link previews need absolute URLs. This turns "/" into https://snippr.dev/.
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    // Pages set a short title ("Sign in") and get "Sign in · Snippr".
    template: `%s · ${siteName}`,
  },
  description: siteDescription,
  openGraph: {
    type: "website",
    url: "/",
    siteName,
    title: siteName,
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read here so the first paint is already in the chosen theme.
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html
      lang="en"
      data-theme={themeAttribute(theme)}
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${pressStart.variable} ${vt323.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider initial={theme}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
