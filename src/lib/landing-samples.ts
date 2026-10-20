import type { SnippetCardData } from "@/components/SnippetCardView";

export type LandingSample = SnippetCardData & {
  id: string;
  folderName: string;
};

// Hand-written snippets for the landing page. Nothing here touches the
// database or Claude; it only has to look like a real library.
export const landingSamples: LandingSample[] = [
  {
    id: "debounce",
    title: "Debounce",
    language: "typescript",
    folderName: "Frontend",
    description:
      "Runs a function only after calls have paused for a given delay.",
    tags: ["timing", "utils"],
    code: `export function debounce<T extends unknown[]>(
  fn: (...args: T) => void,
  ms = 300,
) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: T) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}`,
  },
  {
    id: "duplicate-rows",
    title: "Find duplicate rows",
    language: "sql",
    folderName: "Database",
    description:
      "Lists values that appear more than once in a column, with counts.",
    tags: ["postgres", "cleanup"],
    code: `SELECT email, COUNT(*) AS copies
FROM users
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY copies DESC;`,
  },
  {
    id: "free-port",
    title: "Free up a port",
    language: "bash",
    folderName: "Shell",
    description: "Kills whatever process is listening on the given port.",
    tags: ["macos", "dev server"],
    code: `# usage: freeport 3000
freeport() {
  lsof -ti tcp:"$1" | xargs kill -9
}`,
  },
];

// A search a person would actually type, and the sample AI search finds.
export const searchExample = {
  query: "wait for the user to stop typing before firing a request",
  resultId: "debounce",
};
