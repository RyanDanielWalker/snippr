import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { tokenStore } from "@/lib/token-store";
import ConnectClient from "@/components/ConnectClient";
import { ToastProvider } from "@/components/Toaster";

export const metadata: Metadata = { title: "Connect an MCP client" };

// Dates are formatted here, once, so the server's render and the browser's
// can't disagree about the time zone.
const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export default async function ConnectPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  // Guests can't make tokens (docs/adr/0024), so they have none to list.
  const tokens = session.user.isGuest
    ? []
    : await tokenStore.list(session.user.id);

  return (
    <ToastProvider>
      <ConnectClient
        isGuest={session.user.isGuest}
        tokens={tokens.map((t) => ({
          id: t.id,
          name: t.name,
          created: dateFormat.format(t.createdAt),
        }))}
      />
    </ToastProvider>
  );
}
