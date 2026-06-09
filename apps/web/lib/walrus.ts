import { WalrusClient } from "@walrus-vault/sdk";

const DEFAULT_PUBLISHER = "https://publisher.walrus.wal.app";
const DEFAULT_AGGREGATOR = "https://aggregator.walrus.wal.app";

/**
 * Instantiate the Walrus client.
 */
export function getWalrusClient() {
  const publisher = process.env.WALRUS_PUBLISHER ?? process.env.NEXT_PUBLIC_WALRUS_PUBLISHER ?? DEFAULT_PUBLISHER;
  const aggregator = process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR ?? DEFAULT_AGGREGATOR;
  return new WalrusClient(publisher, aggregator);
}
