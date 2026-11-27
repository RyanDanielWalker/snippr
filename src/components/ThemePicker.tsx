"use client";

import { createContext, use, useState } from "react";
import {
  THEME_NAMES,
  THEMES,
  themeAttribute,
  themeCookie,
  type Theme,
} from "@/lib/theme";
import { useDisclosureMenu } from "./useDisclosureMenu";

// The theme the layout read from the cookie, so the picker's first render
// already ticks the right one (ADR 0029).
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
 * The Theme button in the dashboard and landing page headers, and the list of
 * themes it opens (ADR 0078). It's a disclosure menu, like Move on a card:
 * see useDisclosureMenu for how the keyboard works.
 *
 * Everything happens in the browser, with no request (applyTheme below).
 */
export function ThemePicker({ className = "" }: { className?: string }) {
  const { theme, setTheme } = use(ThemeContext);
  const { open, close, toggle, buttonRef, listRef, listId, wrapperProps } =
    useDisclosureMenu();

  function pick(next: Theme) {
    close();
    if (next === theme) return;
    applyTheme(next);
    setTheme(next);
  }

  return (
    <span {...wrapperProps} className="relative flex">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className={`text-fg-subtle hover:text-fg transition ${className}`}
      >
        Theme
      </button>
      {open && (
        <div
          ref={listRef}
          id={listId}
          role="group"
          aria-label="Theme"
          // Below the button and lined up with its right edge, since the
          // button sits at the right of a header.
          className="absolute right-0 top-full mt-2 z-30 min-w-36 bg-surface-raised border border-line-strong rounded-box shadow-popover py-1"
        >
          {THEMES.map((choice) => {
            const current = choice === theme;
            return (
              <button
                key={choice}
                type="button"
                onClick={() => pick(choice)}
                aria-current={current ? "true" : undefined}
                className={`flex w-full items-center gap-3 text-left px-4 py-2 text-sm hover:bg-surface-hover ${
                  current ? "text-fg" : "text-fg-muted"
                }`}
              >
                <Swatch theme={choice} />
                <span className="flex-1">{THEME_NAMES[choice]}</span>
                {/* For the eye. A screen reader hears "current" instead. */}
                <span aria-hidden className={current ? "" : "invisible"}>
                  ✓
                </span>
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}

/**
 * Restyles the page now, and remembers the choice for the server's next
 * render. Outside the component, since it writes to the document rather than
 * to React state.
 */
function applyTheme(theme: Theme) {
  document.cookie = themeCookie(theme);
  const attribute = themeAttribute(theme);
  if (attribute) document.documentElement.dataset.theme = attribute;
  else delete document.documentElement.dataset.theme;
}

/**
 * A small square of a theme's page color with its accent beside it. The
 * inner span carries that theme's data-theme, so globals.css gives it that
 * theme's tokens and no color is copied here. The outer span keeps the
 * current theme's corners and line, so every swatch in the list matches.
 */
function Swatch({ theme }: { theme: Theme }) {
  return (
    <span
      aria-hidden
      className="flex w-5 h-5 shrink-0 overflow-hidden rounded-chip border border-line-strong"
    >
      <span data-theme={theme} className="flex w-full">
        <span className="flex-1 bg-page" />
        <span className="w-2 bg-accent" />
      </span>
    </span>
  );
}
