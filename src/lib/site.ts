// What Snippr says about itself to the outside world: browser tabs, search
// results, and link previews in Slack, iMessage, LinkedIn, and so on. The
// root layout's metadata and the generated Open Graph image both read from
// here, so the preview and the page can't drift apart.

// Hard-coded rather than read from the environment: a shared link should
// always preview as the production site, even when it was copied from a
// Vercel preview deployment.
export const siteUrl = "https://snippr.dev";

export const siteName = "Snippr";

// Matches the landing page headline.
export const siteHeadline = "A place for the code you keep rewriting.";

// Search results cut descriptions off around 155 characters; keep it under.
export const siteDescription =
  "Save code snippets, file them in folders, and find them again by describing what they do. Claude writes the descriptions.";
