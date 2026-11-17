-- Refuse two users whose emails differ only in capital letters, so
-- `Me@x.com` can't join if `me@x.com` is already here. The app lowercases
-- emails before saving them (docs/adr/0010); this is the database's backstop
-- for any write that skips that. See docs/adr/0060.
--
-- Hand-written: schema.prisma can't describe an index on an expression, so
-- Prisma doesn't know this index exists and won't write or drop it.
-- Additive only: the code already live never writes a case-only duplicate.
-- It fails if production already holds one, so run the check in 0060 first.
-- Emails that are null (demo guests) never collide: a unique index lets any
-- number of nulls through.

CREATE UNIQUE INDEX "User_lower_email_key" ON "User" (lower("email"));
