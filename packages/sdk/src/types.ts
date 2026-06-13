// @walrus-vault/sdk — Type definitions
// All interfaces from ARCHITECTURE.md

/**
 * Configuration for ArtifactVault.
 * MemWal credentials are required; Walrus endpoints have sensible defaults.
 */
export interface ArtifactVaultConfig {
  // MemWal credentials (used internally for artifact metadata storage and search)
  memwalKey: string;              // Ed25519 delegate private key hex
  memwalAccountId: string;        // MemWalAccount object ID on Sui
  memwalServerUrl?: string;       // Default: https://relayer.memwal.ai

  // Walrus endpoints
  walrusPublisher?: string;       // Default: https://publisher.walrus.wal.app
  walrusAggregator?: string;      // Default: https://aggregator.walrus.wal.app
  walrusEpochs?: number;          // Default: 10 (Walrus epochs to store blob)

  // Namespace for artifact metadata in MemWal
  // Default: "artifact-vault" — fully isolated from developer's own namespaces
  metadataNamespace?: string;

  // Optional: Inspector URL for real-time sync when SDK runs headlessly (e.g. via MCP)
  // When set, SDK fires POST {inspectorUrl}/api/sync-artifact after every store()
  // Fire-and-forget — never blocks or throws if this call fails
  inspectorUrl?: string;
}

/**
 * A stored artifact — the primary return type from store(), get(), list().
 */
export interface StoredArtifact {
  id: string;                     // Stable artifact ID (UUID v4) — never changes across versions
  blobId: string;                 // Walrus blob ID for this specific version
  filename: string;
  contentType: string;
  description?: string;
  tags: string[];
  agentId?: string;
  sessionId?: string;
  version: number;                // Current version number (1-based)
  latestVersion: number;          // Highest version — equals version if this is latest
  versions: ArtifactVersion[];    // Full version chain (all blob IDs in order)
  parentArtifactId?: string;      // Set only if artifact is a version of another (rare)
  derivedFrom?: string;           // artifactId this was generated from
  dependsOn?: string[];           // artifactIds this artifact depends on
  size: number;                   // Bytes
  downloadUrl: string;            // Walrus aggregator URL for this version's blob
  createdAt: string;              // ISO timestamp of this version
  metaMemoryId?: string;          // MemWal blob ID of the metadata memory
}

/**
 * Search result extends StoredArtifact with relevance scoring.
 */
export interface ArtifactSearchResult extends StoredArtifact {
  distance: number;               // Cosine distance from query (lower = more relevant)
  relevanceScore: number;         // 1 - distance, normalized 0-1
}

/**
 * Detailed artifact view with Walrus blob metadata.
 */
export interface ArtifactDetail extends StoredArtifact {
  walrusBlobInfo: {
    blobId: string;
    size: number;
  };
}

/**
 * A single version in an artifact's version chain.
 */
export interface ArtifactVersion {
  version: number;
  blobId: string;
  description?: string;
  createdAt: string;
  size?: number;
}

/**
 * Paginated artifact list result.
 */
export interface ArtifactListResult {
  artifacts: StoredArtifact[];
  total: number;
  cursor?: string;
}

/**
 * Options for store().
 */
export interface StoreOptions {
  filename: string;
  contentType: string;
  description?: string;
  tags?: string[];
  agentId?: string;
  sessionId?: string;
  derivedFrom?: string;           // artifactId this was derived/generated from
  dependsOn?: string[];           // artifactIds this artifact depends on
  epochs?: number;                // Optional override for Walrus storage epochs (default: config.walrusEpochs)
}

/**
 * Options for search().
 */
export interface SearchOptions {
  tags?: string[];
  contentType?: string;
  agentId?: string;
  limit?: number;
  maxDistance?: number;
}

/**
 * Options for list().
 */
export interface ListOptions {
  tags?: string[];
  contentType?: string;
  agentId?: string;
  limit?: number;
  cursor?: string;
}

/**
 * Partial store result — returned when Walrus upload succeeds but MemWal metadata storage fails.
 * The developer can retry metadata storage without re-uploading the file.
 */
export interface PartialStoreResult {
  partial: true;
  blobId: string;
  size: number;
  downloadUrl: string;
  error: Error;
}
