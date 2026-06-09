import { MemWal } from "@mysten-incubation/memwal";

const DEFAULT_MEMWAL_SERVER = "https://relayer.memwal.ai";

/**
 * Creates a MemWal client instance.
 * Credentials are passed dynamically from localStorage/session context.
 */
export function getMemWalClient(key: string, accountId: string, namespace = "artifact-vault") {
  return MemWal.create({
    key,
    accountId,
    serverUrl: process.env.NEXT_PUBLIC_MEMWAL_SERVER_URL ?? DEFAULT_MEMWAL_SERVER,
    namespace,
  });
}
