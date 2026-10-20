import { currentUser } from "@/lib/auth";
import { withErrors } from "@/lib/api-errors";
import { incrementAiUsage } from "@/lib/ai-usage";
import { askClaude } from "@/lib/ai";
import { describeSnippet } from "@/lib/ai-describe";

// The rules live in src/lib/ai-describe.ts, where they're tested
// (docs/adr/0023).

export const POST = withErrors(async (req: Request) =>
  describeSnippet(
    { increment: incrementAiUsage, ask: askClaude },
    await currentUser(),
    req,
  ),
);
