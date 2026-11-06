-- Clear the GitHub and Google tokens already stored on Account. Snippr never
-- reads them back, and new sign-ins stopped storing them in an earlier push, so
-- they're only something a leaked backup could use. See docs/adr/0039.
--
-- This can't be undone, and nothing depends on undoing it: the columns stay, and
-- signing in still works, because a sign-in gets fresh tokens from the provider.

UPDATE "Account"
SET "access_token" = NULL,
    "refresh_token" = NULL,
    "id_token" = NULL
WHERE "access_token" IS NOT NULL
   OR "refresh_token" IS NOT NULL
   OR "id_token" IS NOT NULL;
