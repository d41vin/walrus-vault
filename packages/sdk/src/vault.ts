// @walrus-vault/sdk — ArtifactVault class
//
// The main entry point for storing and retrieving artifacts.
// Files go to Walrus, metadata goes to MemWal's "artifact-vault" namespace.
//
// CRITICAL: Every memwal.remember() call MUST be followed by
// await memwal.waitForRememberJob(job.job_id). The memory is NOT
// searchable until this resolves. If this await is missing,
// vault.store() will return success but the artifact will NOT
// appear in search results. This is the single most important
// correctness requirement in the entire SDK.

import { MemWal } from "@mysten-incubation/memwal";
import type {
  ArtifactVaultConfig,
  StoredArtifact,
  ArtifactSearchResult,
  ArtifactDetail,
  ArtifactVersion,
  ArtifactListResult,
  StoreOptions,
  SearchOptions,
  ListOptions,
  PartialStoreResult,
} from "./types.js";
import { WalrusClient } from "./walrus-client.js";
import {
  serializeMetadata,
  parseMetadata,
  isArtifactMetadata,
  generateArtifactId,
} from "./metadata.js";
import { groupByLatestVersion } from "./dedup.js";
import {
  InvalidConfigError,
  ArtifactNotFoundError,
  WalrusVaultPartialError,
} from "./errors.js";

const DEFAULT_PUBLISHER = "https://publisher.walrus.wal.app";
const DEFAULT_AGGREGATOR = "https://aggregator.walrus.wal.app";
const DEFAULT_MEMWAL_SERVER = "https://relayer.memwal.ai";
const DEFAULT_NAMESPACE = "artifact-vault";
const DEFAULT_EPOCHS = 10;

export class ArtifactVault {
  private readonly memwal: MemWal;
  private readonly walrus: WalrusClient;
  private readonly config: Required<
    Pick<
      ArtifactVaultConfig,
      | "walrusAggregator"
      | "walrusEpochs"
      | "metadataNamespace"
    >
  > &
    ArtifactVaultConfig;

  private constructor(config: ArtifactVaultConfig) {
    this.config = {
      ...config,
      walrusPublisher: config.walrusPublisher ?? DEFAULT_PUBLISHER,
      walrusAggregator: config.walrusAggregator ?? DEFAULT_AGGREGATOR,
      walrusEpochs: config.walrusEpochs ?? DEFAULT_EPOCHS,
      memwalServerUrl: config.memwalServerUrl ?? DEFAULT_MEMWAL_SERVER,
      metadataNamespace: config.metadataNamespace ?? DEFAULT_NAMESPACE,
    };

    // Create MemWal client with the artifact-vault namespace
    this.memwal = MemWal.create({
      key: this.config.memwalKey,
      accountId: this.config.memwalAccountId,
      serverUrl: this.config.memwalServerUrl,
      namespace: this.config.metadataNamespace,
    });

    this.walrus = new WalrusClient(
      this.config.walrusPublisher!,
      this.config.walrusAggregator!,
    );
  }

  /**
   * Factory method — validates config and creates an ArtifactVault instance.
   */
  static create(config: ArtifactVaultConfig): ArtifactVault {
    if (!config.memwalKey) {
      throw new InvalidConfigError("memwalKey is required");
    }
    if (!config.memwalAccountId) {
      throw new InvalidConfigError("memwalAccountId is required");
    }
    return new ArtifactVault(config);
  }

  /**
   * Store a new artifact.
   *
   * 1. Upload file bytes to Walrus
   * 2. Store structured metadata in MemWal (artifact-vault namespace)
   * 3. Wait for MemWal indexing to complete (CRITICAL — never skip)
   * 4. Fire-and-forget sync to Inspector if configured
   *
   * If Walrus upload succeeds but MemWal fails, throws WalrusVaultPartialError
   * with the blobId so the developer can retry metadata storage without re-uploading.
   */
  async store(
    data: Buffer | Uint8Array | Blob,
    meta: StoreOptions,
  ): Promise<StoredArtifact> {
    // Convert Blob to Uint8Array if needed
    const bytes =
      data instanceof Blob
        ? new Uint8Array(await data.arrayBuffer())
        : data instanceof Buffer
          ? new Uint8Array(data)
          : data;

    // 1. Upload to Walrus
    const walrusResult = await this.walrus.store(
      bytes,
      meta.contentType,
      meta.epochs ?? this.config.walrusEpochs!,
    );

    // 2. Build the StoredArtifact
    const artifactId = generateArtifactId();
    const now = new Date().toISOString();
    const downloadUrl = this.walrus.getBlobUrl(walrusResult.blobId);

    const artifact: StoredArtifact = {
      id: artifactId,
      blobId: walrusResult.blobId,
      filename: meta.filename,
      contentType: meta.contentType,
      description: meta.description,
      tags: meta.tags ?? [],
      agentId: meta.agentId,
      sessionId: meta.sessionId,
      version: 1,
      latestVersion: 1,
      versions: [
        {
          version: 1,
          blobId: walrusResult.blobId,
          createdAt: now,
          size: walrusResult.size,
        },
      ],
      derivedFrom: meta.derivedFrom,
      dependsOn: meta.dependsOn,
      size: walrusResult.size,
      downloadUrl,
      createdAt: now,
    };

    // 3. Store metadata in MemWal — ALWAYS pass namespace explicitly
    const metadataText = serializeMetadata(artifact);

    try {
      // CRITICAL: remember() returns immediately — memory is NOT searchable yet
      const job = await this.memwal.remember(
        metadataText,
        this.config.metadataNamespace!, // Always pass namespace explicitly
      );

      // CRITICAL: MUST await — memory is not searchable until this resolves
      const result = await this.memwal.waitForRememberJob(job.job_id);

      // Set the metaMemoryId from the completed job
      artifact.metaMemoryId = result.blob_id;
    } catch (err) {
      // Walrus upload succeeded but MemWal failed — return partial error
      // Developer can retry metadata storage without re-uploading
      throw new WalrusVaultPartialError(
        `Artifact uploaded to Walrus but metadata storage failed: ${err instanceof Error ? err.message : String(err)}`,
        walrusResult.blobId,
        walrusResult.size,
        downloadUrl,
        err instanceof Error ? err : new Error(String(err)),
      );
    }

    // 4. Fire-and-forget sync to Inspector if configured
    this.syncToInspector(artifact);

    return artifact;
  }

  /**
   * Search artifacts by natural language query (semantic search via MemWal).
   * Returns only the LATEST version of each artifact — no duplicate stale versions.
   */
  async search(
    query: string,
    filters?: SearchOptions,
  ): Promise<ArtifactSearchResult[]> {
    // Fetch more than needed — dedup reduces final count
    const limit = Math.max((filters?.limit ?? 10) * 5, 50);

    const result = await this.memwal.recall({
      query,
      limit,
      namespace: this.config.metadataNamespace!, // Always pass namespace explicitly
      maxDistance: filters?.maxDistance,
    });

    // Parse and filter to artifact metadata only
    const artifacts: ArtifactSearchResult[] = [];

    for (const r of result.results) {
      if (!isArtifactMetadata(r.text)) continue;

      const parsed = parseMetadata(r.text, this.config.walrusAggregator);
      if (!parsed) continue;

      // Apply filters client-side
      if (filters?.contentType && parsed.contentType !== filters.contentType)
        continue;
      if (filters?.agentId && parsed.agentId !== filters.agentId) continue;
      if (
        filters?.tags &&
        filters.tags.length > 0 &&
        !filters.tags.some((t) => parsed.tags.includes(t))
      )
        continue;

      artifacts.push({
        ...parsed,
        distance: r.distance,
        relevanceScore: Math.max(0, Math.min(1, 1 - r.distance)),
      });
    }

    // Deduplicate — single most important step
    const deduped = groupByLatestVersion(
      artifacts,
    ) as ArtifactSearchResult[];

    // Sort by distance ascending (most relevant first)
    deduped.sort((a, b) => a.distance - b.distance);

    // Slice to requested limit
    return deduped.slice(0, filters?.limit ?? 10);
  }

  /**
   * Get a single artifact by ID (deterministic — reads version chain from metadata).
   */
  async get(artifactId: string): Promise<ArtifactDetail | null> {
    const result = await this.memwal.recall({
      query: artifactId,
      limit: 10,
      namespace: this.config.metadataNamespace!, // Always pass namespace explicitly
    });

    // Filter to artifact metadata, parse, find exact ID match
    const candidates: StoredArtifact[] = [];

    for (const r of result.results) {
      if (!isArtifactMetadata(r.text)) continue;

      const parsed = parseMetadata(r.text, this.config.walrusAggregator);
      if (!parsed) continue;

      if (parsed.id === artifactId) {
        candidates.push(parsed);
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    // Dedup to get latest version
    const [latest] = groupByLatestVersion(candidates);
    if (!latest) return null;

    // Build ArtifactDetail with Walrus blob info
    return {
      ...latest,
      walrusBlobInfo: {
        blobId: latest.blobId,
        size: latest.size,
      },
    };
  }

  /**
   * List artifacts — returns only LATEST version of each artifact.
   */
  async list(filters?: ListOptions): Promise<ArtifactListResult> {
    const limit = 100; // Fetch a large batch for dedup

    const result = await this.memwal.recall({
      query: META_PREFIX_QUERY,
      limit,
      namespace: this.config.metadataNamespace!, // Always pass namespace explicitly
    });

    // Parse and filter
    const artifacts: StoredArtifact[] = [];

    for (const r of result.results) {
      if (!isArtifactMetadata(r.text)) continue;

      const parsed = parseMetadata(r.text, this.config.walrusAggregator);
      if (!parsed) continue;

      // Apply filters
      if (filters?.contentType && parsed.contentType !== filters.contentType)
        continue;
      if (filters?.agentId && parsed.agentId !== filters.agentId) continue;
      if (
        filters?.tags &&
        filters.tags.length > 0 &&
        !filters.tags.some((t) => parsed.tags.includes(t))
      )
        continue;

      artifacts.push(parsed);
    }

    // Deduplicate
    const deduped = groupByLatestVersion(artifacts);

    // Client-side pagination using cursor (array index)
    const cursorIdx = filters?.cursor ? parseInt(filters.cursor, 10) : 0;
    const pageLimit = filters?.limit ?? 20;
    const page = deduped.slice(cursorIdx, cursorIdx + pageLimit);
    const nextCursor =
      cursorIdx + pageLimit < deduped.length
        ? String(cursorIdx + pageLimit)
        : undefined;

    return {
      artifacts: page,
      total: deduped.length,
      cursor: nextCursor,
    };
  }

  /**
   * Store a new version of an existing artifact.
   * Increments version, updates version chain, stores new metadata.
   */
  async storeVersion(
    artifactId: string,
    data: Buffer | Uint8Array | Blob,
    meta?: { description?: string },
  ): Promise<StoredArtifact> {
    // 1. Get current artifact — must exist
    const current = await this.get(artifactId);
    if (!current) {
      throw new ArtifactNotFoundError(artifactId);
    }

    // Convert Blob to Uint8Array if needed
    const bytes =
      data instanceof Blob
        ? new Uint8Array(await data.arrayBuffer())
        : data instanceof Buffer
          ? new Uint8Array(data)
          : data;

    // 2. Upload new blob to Walrus
    const walrusResult = await this.walrus.store(
      bytes,
      current.contentType,
      this.config.walrusEpochs!,
    );

    // 3. Build new version
    const newVersion = current.latestVersion + 1;
    const now = new Date().toISOString();
    const downloadUrl = this.walrus.getBlobUrl(walrusResult.blobId);

    const newVersionEntry: ArtifactVersion = {
      version: newVersion,
      blobId: walrusResult.blobId,
      createdAt: now,
      size: walrusResult.size,
      description: meta?.description,
    };

    const { walrusBlobInfo, ...cleanCurrent } = current;

    const artifact: StoredArtifact = {
      ...cleanCurrent,
      blobId: walrusResult.blobId,
      version: newVersion,
      latestVersion: newVersion,
      versions: [...current.versions, newVersionEntry],
      size: walrusResult.size,
      downloadUrl,
      createdAt: now,
      description: meta?.description ?? current.description,
    };

    // 4. Store new metadata in MemWal
    const metadataText = serializeMetadata(artifact);

    try {
      // CRITICAL: remember() returns immediately — memory is NOT searchable yet
      const job = await this.memwal.remember(
        metadataText,
        this.config.metadataNamespace!, // Always pass namespace explicitly
      );

      // CRITICAL: MUST await — memory is not searchable until this resolves
      const result = await this.memwal.waitForRememberJob(job.job_id);

      artifact.metaMemoryId = result.blob_id;
    } catch (err) {
      throw new WalrusVaultPartialError(
        `New version uploaded to Walrus but metadata storage failed: ${err instanceof Error ? err.message : String(err)}`,
        walrusResult.blobId,
        walrusResult.size,
        downloadUrl,
        err instanceof Error ? err : new Error(String(err)),
      );
    }

    // 5. Fire-and-forget sync to Inspector if configured
    this.syncToInspector(artifact);

    return artifact;
  }

  /**
   * Get full version history for an artifact.
   * Reads the versions field from metadata — no secondary recall calls.
   */
  async getVersions(artifactId: string): Promise<ArtifactVersion[]> {
    const detail = await this.get(artifactId);
    if (!detail) {
      throw new ArtifactNotFoundError(artifactId);
    }
    return detail.versions.sort((a, b) => a.version - b.version);
  }

  /**
   * Get download URL for a blob (does not fetch bytes).
   */
  getDownloadUrl(blobId: string): string {
    return this.walrus.getBlobUrl(blobId);
  }

  /**
   * Download raw blob bytes from Walrus.
   */
  async download(blobId: string): Promise<Uint8Array> {
    return this.walrus.download(blobId);
  }

  /**
   * Fire-and-forget POST to Inspector for real-time sync.
   * Never blocks, never throws, never awaits.
   */
  private syncToInspector(artifact: StoredArtifact): void {
    if (!this.config.inspectorUrl) return;

    fetch(`${this.config.inspectorUrl}/api/sync-artifact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artifact,
        accountId: this.config.memwalAccountId,
      }),
    }).catch(() => {
      // Silently ignore all errors — sync is best-effort
    });
  }
}

/** Query string used for listing all artifacts via recall */
const META_PREFIX_QUERY = "ARTIFACT_VAULT_META";
