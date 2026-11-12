# 0051. Close 1.1, and scope the next milestone to three security fixes

- **Status:** Accepted
- **Date:** 2026-11-12
- **Related:** `docs/ROADMAP.md`, [0040](./0040-close-1-0-and-scope-1-1-to-two-demo-items.md), [0041](./0041-give-1-1-a-version-bump-and-a-tag.md), [0050](./0050-publish-1-1-as-a-github-release-with-notes-kept-in-the-repo.md), [0009](./0009-require-verified-email-for-new-accounts.md), [0010](./0010-store-emails-lowercased.md), [0039](./0039-stop-storing-provider-tokens.md)

## In plain English

1.1 is finished. The next milestone, called 1.2 for now, is three security fixes taken from Parked: a database rule that refuses two users whose emails differ only in capital letters, session tokens stored hashed instead of as they are, and a one-off check of sign-in accounts linked before Snippr checked for verified emails. Everything else stays in Parked.

## Context

1.1 was tagged `v1.1` on `2e0da03` on 2026-11-12, and its GitHub Release was published the same day. That was the last 1.1 item, so `/next` had nothing left to pick.

A *milestone* is a named set of work with a finish line ([0040](./0040-close-1-0-and-scope-1-1-to-two-demo-items.md) explains how Snippr uses them). The roadmap's phases sit inside one, and `/next` picks work only from the current one.

On 2026-11-12 Claude laid out three options. It recommended the second if Ryan wanted to keep going, and the first if he'd rather stop for now. Ryan chose the second. The option named three Parked items as examples, and he chose it without changing them. He didn't give reasons of his own. The reasoning below is the reasoning Claude gave when offering it.

## Options considered

1. **No new milestone.** 1.1 moves to Done, and Parked stays a backlog. Work happens when Ryan names an item (`/next <item>`). This costs nothing, but there's no next marker in the history.
2. **A small milestone of security fixes from Parked.** Three items: a unique index on `lower(email)`, hashed session tokens, and the `Account` audit [0009](./0009-require-verified-email-for-new-accounts.md) asked for. These are the gaps a reviewer reading the code would most likely notice. It costs an ADR now and a few sessions. Hashing session tokens is the biggest piece, because NextAuth's adapter and the demo's sign-in both write session rows.
3. **A milestone of visitor-facing features.** For example, OAuth for MCP clients, or search built on embeddings. These make better demos, but each is a bigger build with several decisions of its own.

The time estimates were rough guesses when the options were written.

## Decision

Option 2.

- **The reason is who reads the code.** Snippr is a portfolio project. Someone who opens `prisma/schema.prisma` sees `sessionToken String @unique` and can tell it's stored as it is. Someone who reads [0010](./0010-store-emails-lowercased.md) sees that only the app, not the database, keeps emails unique regardless of case. Someone who reads [0009](./0009-require-verified-email-for-new-accounts.md) sees an audit it asked for and nothing saying it ran. Each one is small, and each one is the kind of thing a careful reviewer asks about.
- **The three items, and what each means:**
  - **A unique index on `lower(email)`.** An *index* is a lookup structure the database keeps next to a table. A *unique* index also refuses a row that would duplicate one already there. On `lower(email)`, it compares emails with capitals ignored, so `Me@x.com` is refused if `me@x.com` exists. The app already lowercases emails before saving them ([0010](./0010-store-emails-lowercased.md)). The index is a backstop for any path that forgets.
  - **Hashed session tokens.** When you sign in, your browser gets a cookie holding a random token, and the `Session` table stores the same token to recognize you. Today it's stored exactly as the cookie holds it, so anyone who can read that table, say from a leaked backup, can copy a token into a cookie and be signed in as that user. A *hash* is a one-way scramble: the same input always gives the same output, but the output can't be turned back into the input. If the table stores the hash, the server hashes the cookie it receives and looks that up, and a leaked row is useless on its own. [0039](./0039-stop-storing-provider-tokens.md) left this in Parked for later.
  - **The `Account` audit.** [0009](./0009-require-verified-email-for-new-accounts.md) made Snippr refuse to link a new sign-in account unless its email is verified. Accounts linked before that change were never checked, and 0009 said a one-off look at them would close the gap. This one reads production, so it's Ryan's step. Claude writes the query, Ryan runs it in Supabase's SQL editor, and the result is recorded on the roadmap.
- **The milestone is done when all three are ticked.** Nothing else joins it without a decision to add it.
- **"1.2" is a working name.** Whether this milestone gets a version bump, a tag, and a Release isn't decided ([0041](./0041-give-1-1-a-version-bump-and-a-tag.md) and [0050](./0050-publish-1-1-as-a-github-release-with-notes-kept-in-the-repo.md) covered 1.1 only). Neither is the number. These three items fix things without adding features. The version convention in `docs/DEVELOPMENT.md` would call that `1.1.1`, a *patch*, not `1.2.0`. Both questions are under Open decisions on the roadmap.

## Consequences

- **Good:** The three gaps a reviewer is most likely to find in the code get closed, and each gets a record of how.
- **Good:** The roadmap keeps a current milestone, so `/next` has work to pick.
- **Bad:** A visitor to the site sees nothing new. OAuth for MCP and embedding search stay in Parked.
- **Bad:** Hashing session tokens may sign everyone out once, depending on how existing sessions are handled. Members would sign in again. Demo guests would lose their demo, since a guest can't sign back in.
- **Follow-ups:** Two decisions are open on the roadmap: whether this milestone gets a version, a tag, and a Release (and which number), and what happens to existing sessions when tokens start being hashed. The unique index and the hashed tokens each come with a migration, so their commits go to a branch first ([0038](./0038-push-commits-with-a-migration-to-a-branch-first.md)).
