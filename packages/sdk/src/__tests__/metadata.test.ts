import { describe, it, expect } from "vitest";
import {
  serializeMetadata,
  parseMetadata,
  isArtifactMetadata,
  generateArtifactId,
  parseVersionsField,
  serializeVersionsField,
} from "../metadata.js";
import type { StoredArtifact, ArtifactVersion } from "../types.js";

describe("Metadata Serializer & Parser", () => {
  it("should generate valid artifact id", () => {
    const id = generateArtifactId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("should identify artifact metadata correctly", () => {
    expect(isArtifactMetadata("ARTIFACT_VAULT_META\nid: 123")).toBe(true);
    expect(isArtifactMetadata("  ARTIFACT_VAULT_META\nid: 123")).toBe(true);
    expect(isArtifactMetadata("OTHER_TEXT\nid: 123")).toBe(false);
  });

  it("should serialize and parse versions field correctly", () => {
    const versions: ArtifactVersion[] = [
      { version: 1, blobId: "BlobA", createdAt: "" },
      { version: 3, blobId: "BlobC", createdAt: "" },
      { version: 2, blobId: "BlobB", createdAt: "" },
    ];
    const serialized = serializeVersionsField(versions);
    expect(serialized).toBe("1:BlobA, 2:BlobB, 3:BlobC");

    const parsed = parseVersionsField(serialized);
    expect(parsed).toEqual([
      { version: 1, blobId: "BlobA", createdAt: "" },
      { version: 2, blobId: "BlobB", createdAt: "" },
      { version: 3, blobId: "BlobC", createdAt: "" },
    ]);
  });

  it("should return empty array for empty versions field", () => {
    expect(parseVersionsField("")).toEqual([]);
    expect(parseVersionsField("   ")).toEqual([]);
  });

  it("should perform a complete round-trip serialization and parsing", () => {
    const artifact: StoredArtifact = {
      id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      filename: "test-report.pdf",
      contentType: "application/pdf",
      blobId: "some-walrus-blob-id",
      size: 1024,
      version: 2,
      latestVersion: 2,
      versions: [
        { version: 1, blobId: "first-blob-id", createdAt: "" },
        { version: 2, blobId: "some-walrus-blob-id", createdAt: "" },
      ],
      description: "A cool report about walruses",
      tags: ["walrus", "report", "cool"],
      agentId: "agent-alpha",
      sessionId: "session-xyz",
      derivedFrom: "parent-id",
      dependsOn: ["dep-1", "dep-2"],
      downloadUrl: "https://aggregator.walrus.wal.app/v1/blobs/some-walrus-blob-id",
      createdAt: "2026-06-09T12:00:00Z",
    };

    const serialized = serializeMetadata(artifact);
    expect(serialized).toContain("ARTIFACT_VAULT_META");
    expect(serialized).toContain("filename: test-report.pdf");

    const parsed = parseMetadata(serialized);
    expect(parsed).not.toBeNull();
    expect(parsed!.id).toBe(artifact.id);
    expect(parsed!.filename).toBe(artifact.filename);
    expect(parsed!.contentType).toBe(artifact.contentType);
    expect(parsed!.blobId).toBe(artifact.blobId);
    expect(parsed!.size).toBe(artifact.size);
    expect(parsed!.version).toBe(artifact.version);
    expect(parsed!.latestVersion).toBe(artifact.latestVersion);
    expect(parsed!.description).toBe(artifact.description);
    expect(parsed!.tags).toEqual(artifact.tags);
    expect(parsed!.agentId).toBe(artifact.agentId);
    expect(parsed!.sessionId).toBe(artifact.sessionId);
    expect(parsed!.derivedFrom).toBe(artifact.derivedFrom);
    expect(parsed!.dependsOn).toEqual(artifact.dependsOn);
    expect(parsed!.createdAt).toBe(artifact.createdAt);
    expect(parsed!.downloadUrl).toBe(artifact.downloadUrl);
    
    // Check versions inside parsed
    expect(parsed!.versions).toEqual([
      { version: 1, blobId: "first-blob-id", createdAt: "" },
      { version: 2, blobId: "some-walrus-blob-id", createdAt: "" },
    ]);
  });

  it("should sanitize user-supplied fields with newlines and carriage returns to prevent injection", () => {
    const artifact: StoredArtifact = {
      id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      filename: "test\nfilename.pdf",
      contentType: "application/pdf",
      blobId: "some-walrus-blob-id",
      size: 1024,
      version: 1,
      latestVersion: 1,
      versions: [{ version: 1, blobId: "some-walrus-blob-id", createdAt: "" }],
      description: "A cool description\nwith newlines\rand carriage returns",
      tags: ["walrus\nclean", "report"],
      agentId: "agent-alpha\ninjection",
      sessionId: "session-xyz\ninjection",
      derivedFrom: "parent-id\ninjection",
      dependsOn: ["dep-1\ninjection"],
      downloadUrl: "https://aggregator.walrus.wal.app/v1/blobs/some-walrus-blob-id",
      createdAt: "2026-06-09T12:00:00Z",
    };

    const serialized = serializeMetadata(artifact);

    const parsed = parseMetadata(serialized);
    expect(parsed).not.toBeNull();
    expect(parsed!.filename).toBe("test filename.pdf");
    expect(parsed!.description).toBe("A cool description with newlines and carriage returns");
    expect(parsed!.tags).toEqual(["walrus clean", "report"]);
    expect(parsed!.agentId).toBe("agent-alpha injection");
    expect(parsed!.sessionId).toBe("session-xyz injection");
    expect(parsed!.derivedFrom).toBe("parent-id injection");
    expect(parsed!.dependsOn).toEqual(["dep-1 injection"]);
  });
});
