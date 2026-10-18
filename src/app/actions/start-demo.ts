"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  clientIp,
  hashIp,
  sessionCookieName,
  startDemo,
  usesSecureCookies,
} from "@/lib/demo";
import { demoStore } from "@/lib/demo-store";

/**
 * "Try the demo": makes a guest user and signs the visitor in as it (see
 * docs/adr/0012). A Server Action rather than a Route Handler because
 * Next.js checks that the request came from our own pages (Origin against
 * Host), so another site can't quietly sign a visitor into a demo.
 */
export async function startDemoAction() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");

  const requestHeaders = await headers();
  const result = await startDemo({
    ipHash: hashIp(clientIp(requestHeaders), secret),
    store: demoStore,
  });
  if (!result.ok) redirect("/?demo=busy");

  // The same cookie NextAuth would set after an OAuth sign-in, so every
  // getServerSession call finds the guest's session from here on.
  const secure = usesSecureCookies(process.env, requestHeaders.get("x-forwarded-proto"));
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName(secure), result.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    expires: result.expires,
  });

  redirect("/dashboard");
}
