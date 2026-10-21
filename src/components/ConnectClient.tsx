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
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6 sm:py-8 space-y-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Connect an MCP client</h1>
          <Link
            href="/dashboard"
            className="text-sm text-gray-400 hover:text-white transition"
          >
            Back to snippets
          </Link>
        </div>

        <p className="text-gray-300">
          Claude Code, Cursor, and other MCP clients can search your snippets,
          read one, and save new ones. Make a token, paste it into the client,
          and it works as you. Revoke it here when you&apos;re done with it.
        </p>

        {isGuest ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm bg-blue-950/50 border border-blue-900 text-blue-200 rounded-lg px-4 py-3">
            <span>
              Demo guests can&apos;t make tokens, since the demo is gone in 24
              hours.
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-white underline underline-offset-4 hover:text-blue-100"
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
      className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3"
    >
      <label htmlFor="token-name" className="block text-sm text-gray-300">
        Name it after where it&apos;ll live
      </label>
      <div className="flex flex-wrap gap-3">
        <input
          id="token-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={TOKEN_NAME_MAX}
          placeholder="Claude Code on my laptop"
          className="flex-1 min-w-0 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-sm font-medium rounded-lg px-4 py-2 transition"
        >
          {saving ? "Making..." : "Make a token"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
    </form>
  );
}

function NewToken({ token, onDone }: { token: string; onDone: () => void }) {
  return (
    <section className="bg-gray-900 border border-blue-900 rounded-xl p-4 space-y-4">
      <div className="space-y-1">
        <h2 className="font-semibold">Here&apos;s your token</h2>
        <p className="text-sm text-gray-400">
          Copy it now. Snippr only keeps a fingerprint of it, so it can&apos;t
          show it to you again.
        </p>
      </div>
      <CopyBlock text={token} label="token" />
      {clientSetups(token).map((setup) => (
        <div key={setup.client} className="space-y-2">
          <h3 className="text-sm font-medium">{setup.client}</h3>
          <p className="text-sm text-gray-400">{setup.where}</p>
          <CopyBlock text={setup.text} label={`${setup.client} setup`} />
        </div>
      ))}
      <button
        onClick={onDone}
        className="text-sm text-gray-300 hover:text-white bg-gray-800 rounded-lg px-4 py-2 transition"
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
      <pre className="bg-gray-950 border border-gray-800 rounded-lg p-3 pr-20 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
        {text}
      </pre>
      <button
        onClick={copy}
        aria-label={`Copy ${label}`}
        className="absolute top-2 right-2 text-xs text-gray-300 hover:text-white bg-gray-800 rounded px-2 py-1"
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
        <p className="text-sm text-gray-400">
          None yet. Nothing outside this browser can reach your snippets.
        </p>
      ) : (
        <ul className="divide-y divide-gray-800 border border-gray-800 rounded-xl">
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
        <p className="text-xs text-gray-500">Made {token.created}</p>
        {error && (
          <p role="alert" className="text-xs text-red-300 mt-1">
            {error}
          </p>
        )}
      </div>
      <button
        onClick={press}
        disabled={revoking}
        // The visible label plus which token, so a screen reader hears both.
        aria-label={`${label} ${token.name}`}
        className={`text-xs rounded-lg px-3 py-1.5 transition ${
          armed
            ? "bg-red-600 hover:bg-red-500 text-white"
            : "text-gray-300 hover:text-white bg-gray-800"
        }`}
      >
        {label}
      </button>
    </li>
  );
}
