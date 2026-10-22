"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useToast } from "@/components/Toaster";
import { useCopy } from "@/components/useCopy";
import { callApi } from "@/lib/api-client";
import { TOKEN_NAME_MAX } from "@/lib/field-limits";
import { clientSetups } from "@/lib/mcp-config";

/** How long the first press stays armed before Revoke resets. */
const CONFIRM_MS = 3000;

type TokenRow = { id: string; name: string; created: string };

/**
 * Make and revoke personal access tokens for MCP clients (docs/adr/0024).
 * A new token is shown once, with what to paste into each client; after
 * that only its name is ever shown again.
 */
export default function ConnectClient({
  tokens,
  isGuest,
}: {
  tokens: TokenRow[];
  isGuest: boolean;
}) {
  const [created, setCreated] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-page text-fg">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6 sm:py-8 space-y-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Connect an MCP client</h1>
          <Link
            href="/dashboard"
            className="text-sm text-fg-subtle hover:text-fg transition"
          >
            Back to snippets
          </Link>
        </div>

        <p className="text-fg-muted">
          Claude Code, Cursor, and other MCP clients can search your snippets,
          read one, and save new ones. Make a token, paste it into the client,
          and it works as you. Revoke it here when you&apos;re done with it.
        </p>

        {isGuest ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm bg-accent-soft/50 border border-accent-line text-fg-muted rounded-box px-4 py-3">
            <span>
              Demo guests can&apos;t make tokens, since the demo is gone in 24
              hours.
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-fg underline underline-offset-4 hover:text-accent-text"
            >
              Sign in to connect a client
            </button>
          </div>
        ) : (
          <>
            {created ? (
              <NewToken token={created} onDone={() => setCreated(null)} />
            ) : (
              <CreateToken onCreated={setCreated} />
            )}
            <TokenList tokens={tokens} />
          </>
        )}
      </div>
    </main>
  );
}

function CreateToken({ onCreated }: { onCreated: (token: string) => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError(null);
    startSaving(async () => {
      const result = await callApi<{ token: string }>("/api/tokens", "POST", {
        name,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      startSaving(() => {
        setName("");
        onCreated(result.data.token);
        router.refresh();
      });
    });
  }

  return (
    <form
      onSubmit={submit}
      className="bg-surface border border-line rounded-panel p-4 space-y-3"
    >
      <label htmlFor="token-name" className="block text-sm text-fg-muted">
        Name it after where it&apos;ll live
      </label>
      <div className="flex flex-wrap gap-3">
        <input
          id="token-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={TOKEN_NAME_MAX}
          placeholder="Claude Code on my laptop"
          className="flex-1 min-w-0 bg-page border border-line rounded-box px-3 py-2 text-sm focus:outline-none focus:border-focus"
        />
        <button
          type="submit"
          disabled={saving}
          className="bg-accent text-accent-fg hover:bg-accent-hover disabled:opacity-60 text-sm font-medium rounded-box px-4 py-2 transition"
        >
          {saving ? "Making..." : "Make a token"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger-text">
          {error}
        </p>
      )}
    </form>
  );
}

function NewToken({ token, onDone }: { token: string; onDone: () => void }) {
  return (
    <section className="bg-surface border border-accent-line rounded-panel p-4 space-y-4">
      <div className="space-y-1">
        <h2 className="font-semibold">Here&apos;s your token</h2>
        <p className="text-sm text-fg-subtle">
          Copy it now. Snippr only keeps a fingerprint of it, so it can&apos;t
          show it to you again.
        </p>
      </div>
      <CopyBlock text={token} label="token" />
      {clientSetups(token).map((setup) => (
        <div key={setup.client} className="space-y-2">
          <h3 className="text-sm font-medium">{setup.client}</h3>
          <p className="text-sm text-fg-subtle">{setup.where}</p>
          <CopyBlock text={setup.text} label={`${setup.client} setup`} />
        </div>
      ))}
      <button
        onClick={onDone}
        className="text-sm text-fg-muted hover:text-fg bg-surface-raised rounded-box px-4 py-2 transition"
      >
        Done
      </button>
    </section>
  );
}

function CopyBlock({ text, label }: { text: string; label: string }) {
  const { copy, copied } = useCopy(text);
  return (
    <div className="relative">
      <pre className="bg-code border border-line rounded-box p-3 pr-20 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
        {text}
      </pre>
      <button
        onClick={copy}
        aria-label={`Copy ${label}`}
        className="absolute top-2 right-2 text-xs text-fg-muted hover:text-fg bg-surface-raised rounded-chip px-2 py-1"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function TokenList({ tokens }: { tokens: TokenRow[] }) {
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Your tokens</h2>
      {tokens.length === 0 ? (
        <p className="text-sm text-fg-subtle">
          None yet. Nothing outside this browser can reach your snippets.
        </p>
      ) : (
        <ul className="divide-y divide-line border border-line rounded-panel">
          {tokens.map((token) => (
            <TokenItem key={token.id} token={token} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Two-step revoke, like a snippet's delete: the first press arms it. */
function TokenItem({ token }: { token: TokenRow }) {
  const router = useRouter();
  const toast = useToast();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revoking, startRevoking] = useTransition();
  const disarmTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(disarmTimer.current), []);

  function press() {
    if (revoking) return;
    if (!armed) {
      setArmed(true);
      disarmTimer.current = setTimeout(() => setArmed(false), CONFIRM_MS);
      return;
    }
    clearTimeout(disarmTimer.current);
    setError(null);
    startRevoking(async () => {
      const result = await callApi("/api/tokens", "DELETE", { id: token.id });
      if (!result.ok) {
        setArmed(false);
        setError(result.error);
        return;
      }
      startRevoking(() => {
        toast("Token revoked. Anything using it is signed out.");
        router.refresh();
      });
    });
  }

  const label = revoking ? "Revoking..." : armed ? "Confirm revoke" : "Revoke";

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm truncate">{token.name}</p>
        <p className="text-xs text-fg-subtle">Made {token.created}</p>
        {error && (
          <p role="alert" className="text-xs text-danger-text mt-1">
            {error}
          </p>
        )}
      </div>
      <button
        onClick={press}
        disabled={revoking}
        // The visible label plus which token, so a screen reader hears both.
        aria-label={`${label} ${token.name}`}
        className={`text-xs rounded-box px-3 py-1.5 transition ${
          armed
            ? "bg-danger hover:bg-danger-hover text-danger-fg"
            : "text-fg-muted hover:text-fg bg-surface-raised"
        }`}
      >
        {label}
      </button>
    </li>
  );
}
