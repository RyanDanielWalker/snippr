import { currentUser } from "@/lib/auth";
import { withErrors } from "@/lib/api-errors";
import { folderStore } from "@/lib/library-store";
import {
  createFolder,
  deleteFolder,
  listFolders,
  renameFolder,
} from "@/lib/folders";

// The rules live in src/lib/folders.ts, where they're tested (docs/adr/0018).

export const GET = withErrors(async () =>
  listFolders(folderStore, await currentUser()),
);

export const POST = withErrors(async (req: Request) =>
  createFolder(folderStore, await currentUser(), req),
);

export const PATCH = withErrors(async (req: Request) =>
  renameFolder(folderStore, await currentUser(), req),
);

export const DELETE = withErrors(async (req: Request) =>
  deleteFolder(folderStore, await currentUser(), req),
);
