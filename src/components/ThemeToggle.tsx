"use client";

import { createContext, use, useState } from "react";
import {
  nextTheme,
  themeAttribute,
  themeCookie,
  type Theme,
} from "@/lib/theme";

// The theme the layout read from the cookie, so the toggle's first render
// already says the right thing (ADR 0029).
const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>({ theme: "default", setTheme: () => {} });

export function ThemeProvider({
  initial,
  children,
}: {
  initial: Theme;
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState(initial);
  return <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>;
}

/**
 * Switches between the default identity and the 8-bit theme. Everything
 * happens in the browser: the cookie is for the server's next render, the
 * attribute restyles this page now.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = use(ThemeContext);
  const on = theme === "8bit";

  function toggle() {
    const next = nextTheme(theme);
    document.cookie = themeCookie(next);
    const attribute = themeAttribute(next);
    if (attribute) document.documentElement.dataset.theme = attribute;
    else delete document.documentElement.dataset.theme;
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      className={`text-fg-subtle hover:text-fg aria-pressed:text-accent-text transition ${className}`}
    >
      <span aria-hidden="true">{on ? "■" : "□"}</span> 8-bit
    </button>
  );
}
