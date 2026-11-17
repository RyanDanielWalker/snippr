-- Sign everyone out once, because session tokens are now stored as their
-- SHA-256 instead of as the cookie holds them (docs/adr/0061). The rows here
-- hold raw tokens, and the new code looks sessions up by hash, so they would
-- never match again. Deleting them is the choice in docs/adr/0052: members
-- sign in again, and a demo in progress ends. Guests keep their User row
-- until it expires and the next demo start cleans it up.
--
-- Hand-written: the schema doesn't change, only what the column holds.
-- Works with the code already live: the old code just finds no session and
-- sends the visitor to sign in. A sign-in on the old code in the minutes the
-- build takes leaves a raw row the new code never matches. That row is dead,
-- not dangerous: its value isn't the hash of anything a cookie holds. It
-- stays until its user is deleted, since NextAuth only deletes an expired
-- session it finds, and it never finds this one.
-- Can't be undone, so push it to a branch first (docs/adr/0038).

DELETE FROM "Session";
