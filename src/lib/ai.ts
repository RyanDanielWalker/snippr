import Anthropic from "@anthropic-ai/sdk";

/**
 * The one place Snippr talks to Claude (see docs/adr/0023).
 *
 * Search and describe both send one prompt and read back text, so that's
 * all this exposes. The features take an `AskClaude` as an argument, which
 * lets their tests hand in a fake and never reach the network.
 */

/**
 * Both jobs are small: pick numbers from a list of at most 50 lines, or
 * write one sentence. The fastest, cheapest model is plenty, and the browser
 * waits for the whole reply. Changing it is a reviewed commit, not a
 * setting, so production runs what the code says.
 */
export const AI_MODEL = "claude-haiku-5-5";

/**
 * The SDK's defaults are a 10-minute timeout and 2 retries, so a stuck
 * request could hold a search open for half an hour. One retry at 15 seconds
 * caps it near 30. A timeout throws `APIConnectionTimeoutError`, an
 * `APIError`, which `withErrors` already turns into a `502`.
 */
export const AI_TIMEOUT_MS = 15_000;
export const AI_MAX_RETRIES = 1;

export type ClaudeReply = {
  /** Every text block in the reply, joined. Empty if there were none. */
  text: string;
  /** Why Claude stopped: `end_turn`, `max_tokens`, `refusal`, and so on. */
  stopReason: string | null;
};

export type AskClaude = (
  prompt: string,
  maxTokens: number,
) => Promise<ClaudeReply>;

let client: Anthropic | undefined;

// Built on first use, so importing this module never needs the key. Without
// one, the call fails with a message that says so, instead of the SDK's
// authentication error from an empty key.
function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY isn't set.");
    client = new Anthropic({
      apiKey,
      timeout: AI_TIMEOUT_MS,
      maxRetries: AI_MAX_RETRIES,
    });
  }
  return client;
}

export const askClaude: AskClaude = async (prompt, maxTokens) => {
  const message = await getClient().messages.create({
    model: AI_MODEL,
    max_tokens: maxTokens,
    // Haiku 5.5 thinks by default, and thinking counts against `max_tokens`.
    // Describe allows 100, which reasoning alone could use up.
    thinking: { type: "disabled" },
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("");
  return { text, stopReason: message.stop_reason };
};
