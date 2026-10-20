import "next-auth";
import "next-auth/adapters";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      // True for demo guests (docs/adr/0012).
      isGuest: boolean;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/adapters" {
  interface AdapterUser {
    guestExpiresAt?: Date | null;
  }
}
