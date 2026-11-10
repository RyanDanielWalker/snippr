-- One row per UTC day, counting the AI calls of all demo guests together.
-- See docs/adr/0046. Additive only: the code already live doesn't read it.

-- CreateTable
CREATE TABLE "GuestAiDay" (
    "day" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GuestAiDay_pkey" PRIMARY KEY ("day")
);

-- Every table refuses every role except its owner. See docs/adr/0037.
ALTER TABLE "GuestAiDay" ENABLE ROW LEVEL SECURITY;
