# 0001. Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-10-17

## In plain English

From now on, any significant technical decision in Snippr gets a short written record explaining what was chosen and why. The code shows *what* the system does. These records show *why*.

## Context

Snippr was built quickly in April 2026. The code works, but most of the reasoning behind it lived in chat history. Six months later, several choices (pinning Prisma 5, how account linking works, why the dashboard renders only a header first) were hard to explain from the code alone. That's a problem for maintenance and a bigger problem for a portfolio project, where the reasoning is the point.

## Decision

We will keep Architecture Decision Records in `docs/adr/`, using the lightweight format described by Michael Nygard. Each record is numbered, short, and append-only. Decisions already in the code are recorded retroactively.

## Consequences

- **Good:** Decisions are reviewable. Trade-offs are visible instead of hidden. A reader can tell the difference between "we chose this on purpose" and "this is how it ended up."
- **Bad:** A small amount of overhead per significant change.
- **Follow-ups:** The definition of done in `DEVELOPMENT.md` includes checking whether a change needs an ADR, so the habit doesn't depend on memory.
