-- When a snippet was deleted, or null while it is in the library or the
-- archive. See docs/adr/0067. Additive only: a nullable column the code
-- already live never reads, so it is safe to run before the new build is ready.

-- AlterTable
ALTER TABLE "Snippet" ADD COLUMN     "deletedAt" TIMESTAMP(3);
