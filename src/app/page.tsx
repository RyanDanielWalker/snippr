import Link from "next/link";
import { redirect } from "next/navigation";
import { codeToHtml } from "shiki";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import SnippetCardView from "@/components/SnippetCardView";
import DemoButton from "@/components/DemoButton";
import { landingSamples, searchExample } from "@/lib/landing-samples";
import { withCardHtml } from "@/lib/highlight";

const features = [
  {
    title: "Descriptions you didn't write",
    body: "Paste the code, press Generate, and Claude writes a one-line summary. That summary is what search reads later.",
  },
  {
    title: "Search by what it does",
    body: "Describe the snippet in a sentence. Claude reads your titles, tags, and descriptions and picks the ones you meant.",
  },
  {
    title: "Folders, if you want them",
    body: "Drag a card onto a folder to file it. Or don't. Anything unfiled waits in Unorganized.",
  },
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string | string[] }>;
}) {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  // Set by startDemoAction when one network starts too many demos in an hour.
  const demoBusy = (await searchParams).demo === "busy";
  const samples = await withCardHtml(landingSamples, codeToHtml);

  return (
    <div className="min-h-screen bg-page text-fg-muted">
      <header className="max-w-5xl mx-auto px-4 py-6 flex items-center justify-between">
        <span className="text-fg font-bold text-lg">Snippr</span>
        <Link
          href="/login"
          className="text-sm text-fg-subtle hover:text-fg transition"
        >
          Sign in
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-4">
        <section className="py-16 md:py-24 max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-bold text-fg leading-tight">
            A place for the code you keep rewriting.
          </h1>
          <p className="mt-6 text-lg text-fg-subtle">
            Save snippets, file them in folders, and find them again by
            describing what they do. Claude writes the descriptions, so you
            don&apos;t have to.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/login"
              className="bg-inverse text-inverse-fg px-6 py-3 rounded-box font-medium hover:bg-inverse-hover transition"
            >
              Sign in to start
            </Link>
            <DemoButton />
          </div>
          <p className="mt-4 text-sm text-fg-subtle">
            Sign in with GitHub or Google, free for up to 50 snippets. Or try
            the demo, no account needed. It deletes itself after 24 hours.
          </p>
          {demoBusy && (
            <p
              role="alert"
              className="mt-4 text-sm text-danger-text bg-danger-soft/60 border border-danger-line rounded-box px-4 py-3"
            >
              A lot of demos have started from your network in the last hour.
              Try again later, or sign in.
            </p>
          )}
        </section>

        <section aria-labelledby="example-heading" className="pb-16">
          <h2 id="example-heading" className="sr-only">
            Example of AI search
          </h2>
          <div className="rounded-panel border border-line bg-surface/40 p-4 md:p-6">
            <div className="flex items-start gap-3 bg-surface border border-line rounded-box px-4 py-3">
              <span className="text-xs text-accent-text bg-accent-soft px-2 py-1 rounded-chip shrink-0">
                ✦ AI
              </span>
              <span className="text-fg-muted">{searchExample.query}</span>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              {samples.map(({ id, folderName, ...snippet }) => (
                <SnippetCardView
                  key={id}
                  snippet={snippet}
                  folderName={folderName}
                  className={
                    id === searchExample.resultId
                      ? "ring-2 ring-focus/60"
                      : "opacity-40"
                  }
                />
              ))}
            </div>
          </div>
          <p className="mt-4 text-sm text-fg-subtle">
            Keyword search finds nothing for that. AI search matched what it
            meant.
          </p>
        </section>

        <section className="pb-24 grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((f) => (
            <div key={f.title}>
              <h2 className="text-fg font-medium">{f.title}</h2>
              <p className="mt-2 text-sm text-fg-subtle">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="max-w-5xl mx-auto px-4 py-8 border-t border-line text-sm text-fg-subtle flex flex-wrap gap-x-6 gap-y-2">
        <span>Built by Ryan Walker</span>
        <a
          href="https://github.com/RyanDanielWalker/snippr"
          className="hover:text-fg transition"
        >
          Source on GitHub
        </a>
      </footer>
    </div>
  );
}
