import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { codeToHtml } from "shiki";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACTIVE, snippetStore } from "@/lib/library-store";
import { trashCutoff } from "@/lib/trash";
import { withCardHtml } from "@/lib/highlight";
import { SIDEBAR_COOKIE, parseSidebarCollapsed } from "@/lib/sidebar";
import { TRY_COOKIE } from "@/lib/things-to-try";
import DashboardClient from "@/components/DashboardClient";
import { TryProvider } from "@/components/ThingsToTry";
import { ToastProvider } from "@/components/Toaster";

export const metadata: Metadata = { title: "Your snippets" };

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  // Emptying the trash: this user's snippets deleted over 30 days ago go
  // before anything is read. There's no scheduled job (docs/adr/0067).
  const now = new Date();
  const cutoff = trashCutoff(now);
  await snippetStore.purgeExpiredTrash(session.user.id, cutoff);

  const [snippets, folders] = await Promise.all([
    prisma.snippet.findMany({
      // Recently deleted too, for its own view. The date check repeats the
      // purge's, so an expired snippet can't show even if the purge missed it.
      where: {
        userId: session.user.id,
        OR: [{ deletedAt: null }, { deletedAt: { gte: cutoff } }],
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.folder.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { snippets: ACTIVE } },
      },
    }),
  ]);
  // Highlighted here so the cards arrive in color and the browser never
  // loads Shiki for them (docs/adr/0022).
  const cards = await withCardHtml(snippets, codeToHtml);
  const cookieStore = await cookies();
  const sidebarCollapsed = parseSidebarCollapsed(
    cookieStore.get(SIDEBAR_COOKIE)?.value,
  );
  const isGuest = session.user.isGuest;
  // Only guests get the checklist (docs/adr/0049).
  const tryCookie = isGuest ? cookieStore.get(TRY_COOKIE)?.value : undefined;

  return (
    <ToastProvider>
      <TryProvider enabled={isGuest}>
        <DashboardClient
          snippets={JSON.parse(JSON.stringify(cards))}
          folders={JSON.parse(JSON.stringify(folders))}
          user={{
            email: session.user.email ?? "",
            image: session.user.image ?? "",
            isGuest,
          }}
          sidebarCollapsed={sidebarCollapsed}
          tryCookie={tryCookie}
          now={now.getTime()}
        />
      </TryProvider>
    </ToastProvider>
  );
}
