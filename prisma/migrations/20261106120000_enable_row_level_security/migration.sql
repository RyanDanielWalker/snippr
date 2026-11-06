-- Row-level security makes Postgres check every read and write against the
-- table's policies, and with no policies it refuses them all. The table owner
-- skips the check unless FORCE is set, and the app connects as the owner, so
-- Snippr doesn't notice. Anyone else, such as Supabase's anon and authenticated
-- roles behind its Data API, gets nothing. See docs/adr/0037.
-- Additive only: the code already live works with or without it.

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Folder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Snippet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApiToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AiUsage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DemoStart" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationToken" ENABLE ROW LEVEL SECURITY;

-- Prisma's own bookkeeping table sits in the same schema. It doesn't exist in
-- the shadow database Prisma uses to check migrations, so this one is conditional.
DO $$
BEGIN
  IF to_regclass('"_prisma_migrations"') IS NOT NULL THEN
    ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
