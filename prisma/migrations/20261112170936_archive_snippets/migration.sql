-- When a snippet was archived, or null while it is in the library.
-- See docs/adr/0056. Additive only: a nullable column the code already
-- live never reads, so it is safe to run before the new build is ready.

-- AlterTable
ALTER TABLE "Snippet" ADD COLUMN     "archivedAt" TIMESTAMP(3);
