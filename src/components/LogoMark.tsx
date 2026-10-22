// Snippr's mark: a pair of braces with a cut between them (ADR 0028). The
// colors are props because the site passes CSS variables and the generated
// images (icon.tsx, apple-icon.tsx, opengraph-image.tsx) pass hex, since
// next/og can't read CSS. No hooks or client code, so all of them can use it.

type LogoMarkProps = {
  /** A number of pixels, or any CSS length ("1.2em" scales with the text). */
  size: number | string;
  braces: string;
  cut: string;
  className?: string;
};

export default function LogoMark({
  size,
  braces,
  cut,
  className,
}: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M11 6C8.5 6 8 7.5 8 10v3c0 1.8-1 3-2.5 3C7 16 8 17.2 8 19v3c0 2.5.5 4 3 4"
        stroke={braces}
      />
      <path
        d="M21 6c2.5 0 3 1.5 3 4v3c0 1.8 1 3 2.5 3-1.5 0-2.5 1.2-2.5 3v3c0 2.5-.5 4-3 4"
        stroke={braces}
      />
      <path d="M13.5 21.5 18.5 10.5" stroke={cut} />
    </svg>
  );
}

/** The mark and the name together, for page headers. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 font-display font-bold ${className}`}
    >
      <LogoMark size="1.2em" braces="currentColor" cut="var(--accent)" />
      Snippr
    </span>
  );
}
