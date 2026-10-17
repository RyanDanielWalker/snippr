# 0006. Model folders as an optional one-to-many relation with `SET NULL` on delete

- **Status:** Accepted
- **Date:** Decided 2026-04-20, recorded 2026-10-17
- **Related:** `prisma/schema.prisma`, `src/app/api/folders/route.ts`

## In plain English

A folder holds snippets. A snippet can be in one folder or none. Deleting a folder never deletes the code inside it; those snippets just become "Unorganized."

## Context

Users wanted to group snippets by project. Tags already existed for cross-cutting labels ("react," "auth"), so folders didn't need to do that job too.

## Options considered

1. **Flat folders, one per snippet.** One optional foreign key. Simplest possible model.
2. **Nested folders.** A `parentId` on `Folder`, which turns every count and filter into a tree query.
3. **Collections (many-to-many).** A snippet in several groups at once. Overlaps heavily with tags.

## Decision

**Option 1.** `Snippet.folderId` is a nullable foreign key to `Folder`, with `onDelete: SetNull`. "All snippets" and "Unorganized" are views in the UI, not real folders. Folder counts come from Prisma's `_count` in the same query that loads the folders.

## Consequences

- **Good:** Simple queries, cheap counts, and deleting a folder can't destroy data.
- **Bad:** No nesting. A snippet can't live in two folders (tags cover that need).
- **Bad: a missing ownership check.** The snippet create and update endpoints accept any `folderId` without confirming the folder belongs to the signed-in user. You can't read anyone else's data through this, but you can attach your snippet to someone else's folder, which bumps their folder's count. It's the kind of gap a code reviewer looks for first.
- **Follow-ups:** Verify folder ownership in snippet POST and PATCH, and cover it with a test.
