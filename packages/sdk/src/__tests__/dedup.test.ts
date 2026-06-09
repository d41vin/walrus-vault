import { describe, it, expect } from "vitest";
import { groupByLatestVersion } from "../dedup.js";
import type { StoredArtifact } from "../types.js";

describe("groupByLatestVersion deduplication utility", () => {
  it("should keep only the highest version for each artifact id", () => {
    const baseArtifact = {
      filename: "test.txt",
      contentType: "text/plain",
      tags: [],
      size: 100,
      downloadUrl: "http://aggregator/v1/blobs/dummy",
      createdAt: "2026-06-09T12:00:00Z",
      versions: [],
    };

    const artifacts: StoredArtifact[] = [
      {
        ...baseArtifact,
        id: "artifact-1",
        blobId: "blob-1-v1",
        version: 1,
        latestVersion: 1,
      },
      {
        ...baseArtifact,
        id: "artifact-1",
        blobId: "blob-1-v3",
        version: 3,
        latestVersion: 3,
      },
      {
        ...baseArtifact,
        id: "artifact-2",
        blobId: "blob-2-v2",
        version: 2,
        latestVersion: 2,
      },
      {
        ...baseArtifact,
        id: "artifact-1",
        blobId: "blob-1-v2",
        version: 2,
        latestVersion: 2,
      },
      {
        ...baseArtifact,
        id: "artifact-2",
        blobId: "blob-2-v1",
        version: 1,
        latestVersion: 1,
      },
    ];

    const result = groupByLatestVersion(artifacts);
    expect(result.length).toBe(2);

    const art1 = result.find((r) => r.id === "artifact-1");
    const art2 = result.find((r) => r.id === "artifact-2");

    expect(art1).toBeDefined();
    expect(art1!.version).toBe(3);
    expect(art1!.blobId).toBe("blob-1-v3");

    expect(art2).toBeDefined();
    expect(art2!.version).toBe(2);
    expect(art2!.blobId).toBe("blob-2-v2");
  });

  it("should return empty array for empty inputs", () => {
    expect(groupByLatestVersion([])).toEqual([]);
  });
});
