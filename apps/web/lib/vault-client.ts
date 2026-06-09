import { ArtifactVault } from "@walrus-vault/sdk";

const DEFAULT_PUBLISHER = "https://publisher.walrus.wal.app";
const DEFAULT_AGGREGATOR = "https://aggregator.walrus.wal.app";
const DEFAULT_MEMWAL_SERVER = "https://relayer.memwal.ai";

/**
 * Creates an ArtifactVault instance using the provided credentials.
 */
export function getArtifactVault(key: string, accountId: string) {
  return ArtifactVault.create({
    memwalKey: key,
    memwalAccountId: accountId,
    memwalServerUrl: process.env.NEXT_PUBLIC_MEMWAL_SERVER_URL ?? DEFAULT_MEMWAL_SERVER,
    walrusPublisher: process.env.WALRUS_PUBLISHER ?? process.env.NEXT_PUBLIC_WALRUS_PUBLISHER ?? DEFAULT_PUBLISHER,
    walrusAggregator: process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR ?? DEFAULT_AGGREGATOR,
  });
}
