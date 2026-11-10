-- One row per hashed client IP and UTC day, counting demo guests' AI calls
-- from that address. See docs/adr/0047. Additive only: the code already
-- live doesn't read it.

-- CreateTable
CREATE TABLE "GuestAiAddressDay" (
    "ipHash" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GuestAiAddressDay_pkey" PRIMARY KEY ("ipHash","day")
);

-- Every table refuses every role except its owner. See docs/adr/0037.
ALTER TABLE "GuestAiAddressDay" ENABLE ROW LEVEL SECURITY;
