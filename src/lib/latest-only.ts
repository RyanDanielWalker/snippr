/**
 * Keeps only the answer to the most recent request.
 *
 * `start()` marks a new request and returns a check to run when its answer
 * arrives: true while it's still the latest, false once a newer request has
 * started or `cancel()` was called. AI search uses it so a slow reply can't
 * land on top of a newer search, or after AI mode was switched off.
 */
export function latestOnly() {
  let latest = 0;
  return {
    start(): () => boolean {
      const id = ++latest;
      return () => id === latest;
    },
    cancel(): void {
      latest++;
    },
  };
}
