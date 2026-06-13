// @walrus-vault/sdk — Metadata serialization and parsing
// Implements the ARTIFACT_VAULT_META text format from ARCHITECTURE.md
//
// WHY TEXT FORMAT? MemWal's embedding engine understands natural language
// better than JSON. "filename: q3-report.pdf tags: climate, Q3, final"
// produces better semantic search results than JSON syntax.

import { v4 as uuidv4 } from "uuid";
import type { StoredArtifact, ArtifactVersion } from "./types.js";

const META_PREFIX = "ARTIFACT_VAULT_META";

/**
 * Fast check: does this text represent artifact metadata?
 */
export function isArtifactMetadata(text: string): boolean {
  return text.trimStart().startsWith(META_PREFIX);
}

/**
 * Generate a stable artifact ID (UUID v4). Never changes across versions.
 */
export function generateArtifactId(): string {
  return uuidv4();
}

/**
 * Sanitize a metadata field value to prevent newline injection.
 * Replaces newlines and carriage returns with a space and trims leading/trailing space.
 */
export function sanitizeField(value: string): string {
  return value
    .replace(/\r?\n/g, " ")
    .replace(/\r/g, " ")
    .trim();
}

/**
 * Serialize a StoredArtifact into the ARTIFACT_VAULT_META text format.
 * This text is what gets embedded and semantically indexed by MemWal.
 */
export function serializeMetadata(artifact: StoredArtifact): string {
  const sanitizedFilename = sanitizeField(artifact.filename);
  const sanitizedDescription = artifact.description ? sanitizeField(artifact.description) : "";
  const sanitizedAgentId = artifact.agentId ? sanitizeField(artifact.agentId) : "manual";
  const sanitizedSessionId = artifact.sessionId ? sanitizeField(artifact.sessionId) : "none";
  const sanitizedDerivedFrom = artifact.derivedFrom ? sanitizeField(artifact.derivedFrom) : "none";
  
  const sanitizedTags = artifact.tags
    .map((t) => sanitizeField(t))
    .filter(Boolean)
    .join(", ");

  const sanitizedDependsOn =
    artifact.dependsOn && artifact.dependsOn.length > 0
      ? artifact.dependsOn.map((d) => sanitizeField(d)).filter(Boolean).join(", ")
      : "none";

  const lines = [
    META_PREFIX,
    `id: ${artifact.id}`,
    `filename: ${sanitizedFilename}`,
    `contentType: ${artifact.contentType}`,
    `blobId: ${artifact.blobId}`,
    `size: ${artifact.size}`,
    `version: ${artifact.version}`,
    `latestVersion: ${artifact.latestVersion}`,
    `versions: ${serializeVersionsField(artifact.versions)}`,
    `description: ${sanitizedDescription}`,
    `tags: ${sanitizedTags}`,
    `agentId: ${sanitizedAgentId}`,
    `sessionId: ${sanitizedSessionId}`,
    `derivedFrom: ${sanitizedDerivedFrom}`,
    `dependsOn: ${sanitizedDependsOn}`,
    `createdAt: ${artifact.createdAt}`,
  ];

  return lines.join("\n");
}

/**
 * Parse the ARTIFACT_VAULT_META text format back to a StoredArtifact.
 * Returns null if the text is not valid artifact metadata.
 */
export function parseMetadata(
  text: string,
  downloadUrlBase?: string,
): StoredArtifact | null {
  if (!isArtifactMetadata(text)) {
    return null;
  }

  const lines = text.split("\n");
  const fields = new Map<string, string>();

  for (const line of lines) {
    // Skip the META_PREFIX line
    if (line.trim() === META_PREFIX) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    fields.set(key, value);
  }

  const id = fields.get("id");
  const filename = fields.get("filename");
  const contentType = fields.get("contentType");
  const blobId = fields.get("blobId");

  // Required fields check
  if (!id || !filename || !contentType || !blobId) {
    return null;
  }

  const size = parseInt(fields.get("size") ?? "0", 10);
  const version = parseInt(fields.get("version") ?? "1", 10);
  const latestVersion = parseInt(fields.get("latestVersion") ?? "1", 10);

  const versionsRaw = fields.get("versions") ?? "";
  const versions = parseVersionsField(versionsRaw);

  const tagsRaw = fields.get("tags") ?? "";
  const tags =
    tagsRaw.length > 0
      ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

  const agentIdRaw = fields.get("agentId");
  const agentId =
    agentIdRaw && agentIdRaw !== "manual" ? agentIdRaw : undefined;

  const sessionIdRaw = fields.get("sessionId");
  const sessionId =
    sessionIdRaw && sessionIdRaw !== "none" ? sessionIdRaw : undefined;

  const derivedFromRaw = fields.get("derivedFrom");
  const derivedFrom =
    derivedFromRaw && derivedFromRaw !== "none" ? derivedFromRaw : undefined;

  const dependsOnRaw = fields.get("dependsOn");
  const dependsOn =
    dependsOnRaw && dependsOnRaw !== "none"
      ? dependsOnRaw.split(",").map((d) => d.trim()).filter(Boolean)
      : undefined;

  const createdAt = fields.get("createdAt") ?? new Date().toISOString();
  const description = fields.get("description") || undefined;

  const aggregator =
    downloadUrlBase ?? "https://aggregator.walrus.wal.app";
  const downloadUrl = `${aggregator}/v1/blobs/${blobId}`;

  return {
    id,
    blobId,
    filename,
    contentType,
    description,
    tags,
    agentId,
    sessionId,
    version,
    latestVersion,
    versions,
    derivedFrom,
    dependsOn,
    size,
    downloadUrl,
    createdAt,
  };
}

/**
 * Parse the versions field: "1:BlobIdA, 2:BlobIdB, 3:BlobIdC"
 * into ArtifactVersion[].
 */
export function parseVersionsField(raw: string): ArtifactVersion[] {
  if (!raw || raw.trim().length === 0) {
    return [];
  }

  return raw
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const colonIdx = pair.indexOf(":");
      if (colonIdx === -1) {
        return null;
      }
      const versionNum = parseInt(pair.slice(0, colonIdx).trim(), 10);
      const blobId = pair.slice(colonIdx + 1).trim();
      if (isNaN(versionNum) || !blobId) {
        return null;
      }
      return {
        version: versionNum,
        blobId,
        createdAt: "", // Not stored in the compact versions field
      } satisfies ArtifactVersion;
    })
    .filter((v): v is ArtifactVersion => v !== null);
}

/**
 * Serialize ArtifactVersion[] into the compact versions field format:
 * "1:BlobIdA, 2:BlobIdB, 3:BlobIdC"
 */
export function serializeVersionsField(versions: ArtifactVersion[]): string {
  return versions
    .sort((a, b) => a.version - b.version)
    .map((v) => `${v.version}:${v.blobId}`)
    .join(", ");
}
