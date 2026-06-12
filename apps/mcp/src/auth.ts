import type { ArtifactVaultConfig } from "@walrus-vault/sdk";

export function loadConfig(): ArtifactVaultConfig {
  const key = process.env.MEMWAL_PRIVATE_KEY;
  const accountId = process.env.MEMWAL_ACCOUNT_ID;

  if (!key || !accountId) {
    throw new Error(
      "MEMWAL_PRIVATE_KEY and MEMWAL_ACCOUNT_ID environment variables are required to run the WalrusVault MCP server."
    );
  }

  return {
    memwalKey: key,
    memwalAccountId: accountId,
    memwalServerUrl: process.env.MEMWAL_SERVER_URL || undefined,
    walrusPublisher: process.env.WALRUS_PUBLISHER || undefined,
    walrusAggregator: process.env.WALRUS_AGGREGATOR || undefined,
    walrusEpochs: process.env.WALRUS_EPOCHS ? parseInt(process.env.WALRUS_EPOCHS, 10) : 10,
    metadataNamespace: process.env.VAULT_NAMESPACE || "artifact-vault",
    inspectorUrl: process.env.INSPECTOR_URL || undefined,
  };
}
