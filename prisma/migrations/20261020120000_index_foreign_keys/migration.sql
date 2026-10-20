-- Postgres indexes the referenced side of a foreign key (the primary key) but
-- not the referencing column. Without these, every query filtered by userId or
-- folderId, and every cascade when a user or folder is deleted, reads the
-- whole table. Additive only: the code already live works with or without them.

-- CreateIndex
CREATE INDEX "Folder_userId_idx" ON "Folder"("userId");

-- CreateIndex
CREATE INDEX "Snippet_userId_idx" ON "Snippet"("userId");

-- CreateIndex
CREATE INDEX "Snippet_folderId_idx" ON "Snippet"("folderId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

