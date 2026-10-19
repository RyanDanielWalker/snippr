// The rule behind deploy-migrations.mjs: which builds apply migrations.
// Kept free of process.env so tests can feed it whatever they like.
// See ADR 0016.

/**
 * @typedef {{ migrate: boolean, reason: string }} Decision
 */

/**
 * Only Vercel's production builds migrate. Preview and development builds
 * might have production's DATABASE_URL (Vercel copies variables between
 * environments easily), and a branch's migration must never reach real data
 * before it's merged. Anything that isn't exactly "production" is skipped,
 * including a missing or misspelled value: when in doubt, don't touch it.
 *
 * @param {string | undefined} vercelEnv the VERCEL_ENV Vercel sets on builds
 * @returns {Decision}
 */
export function migrationDecision(vercelEnv) {
  if (vercelEnv === "production") {
    return { migrate: true, reason: "Production build. Applying migrations." };
  }
  const where = vercelEnv ? `a ${vercelEnv} build` : "not a Vercel build";
  return {
    migrate: false,
    reason: `Skipping migrations: ${where}. Only production builds apply them.`,
  };
}
