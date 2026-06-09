// @walrus-vault/sdk — Version deduplication utility
//
// This is called at the end of both search() and list() before returning.
// It is the single most important correctness guarantee in the SDK.
//
// Because MemWal memories are immutable, when a new version is stored,
// a new metadata memory is written but the old one still exists.
// A semantic recall may return both V1 and V3 metadata for the same artifact.
// This function ensures only the highest version per artifactId is returned.

import type { StoredArtifact } from "./types.js";

/**
 * Groups recall results by artifactId and keeps only the highest version
 * of each artifact. Agents and developers always receive only the latest
 * version — stale versions never surface unless explicitly requested
 * via getVersions().
 */
export function groupByLatestVersion(
  artifacts: StoredArtifact[],
): StoredArtifact[] {
  const byId = new Map<string, StoredArtifact>();

  for (const artifact of artifacts) {
    const existing = byId.get(artifact.id);
    if (!existing || artifact.version > existing.version) {
      byId.set(artifact.id, artifact);
    }
  }

  return Array.from(byId.values());
}
