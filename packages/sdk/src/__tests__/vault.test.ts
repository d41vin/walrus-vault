import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArtifactVault } from "../vault.js";
import {
  InvalidConfigError,
  ArtifactNotFoundError,
  WalrusVaultPartialError,
} from "../errors.js";
import { serializeMetadata } from "../metadata.js";
import type { StoredArtifact } from "../types.js";

// Mock MemWal SDK
const mockRemember = vi.fn();
const mockWaitForRememberJob = vi.fn();
const mockRecall = vi.fn();

vi.mock("@mysten-incubation/memwal", () => {
  return {
    MemWal: {
      create: vi.fn(() => ({
        remember: mockRemember,
        waitForRememberJob: mockWaitForRememberJob,
        recall: mockRecall,
      })),
    },
  };
});

// Mock WalrusClient
const mockStore = vi.fn();
const mockDownload = vi.fn();
const mockGetBlobUrl = vi.fn((blobId) => `https://aggregator.walrus.wal.app/v1/blobs/${blobId}`);

vi.mock("../walrus-client.js", () => {
  return {
    WalrusClient: class {
      store = mockStore;
      download = mockDownload;
      getBlobUrl = mockGetBlobUrl;
    },
  };
});

describe("ArtifactVault", () => {
  const config = {
    memwalKey: "ed25519-key-hex-value-here",
    memwalAccountId: "0x123abc456def",
    inspectorUrl: "https://inspector.example.com",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Initialization", () => {
    it("should throw error if memwalKey is missing", () => {
      expect(() =>
        ArtifactVault.create({ ...config, memwalKey: "" })
      ).toThrow(InvalidConfigError);
    });

    it("should throw error if memwalAccountId is missing", () => {
      expect(() =>
        ArtifactVault.create({ ...config, memwalAccountId: "" })
      ).toThrow(InvalidConfigError);
    });

    it("should initialize successfully with valid config", () => {
      const vault = ArtifactVault.create(config);
      expect(vault).toBeInstanceOf(ArtifactVault);
    });
  });

  describe("store", () => {
    it("should store artifact successfully", async () => {
      mockStore.mockResolvedValue({
        blobId: "my-uploaded-blob-id",
        size: 1234,
        alreadyExists: false,
      });

      mockRemember.mockResolvedValue({ job_id: "job-123" });
      mockWaitForRememberJob.mockResolvedValue({ blob_id: "memory-blob-id" });

      const inspectorFetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
      } as Response);

      const vault = ArtifactVault.create(config);
      const fileBytes = new Uint8Array([1, 2, 3]);
      const meta = {
        filename: "hello.txt",
        contentType: "text/plain",
        tags: ["tagA"],
      };

      const result = await vault.store(fileBytes, meta);

      expect(mockStore).toHaveBeenCalledWith(fileBytes, "text/plain", 10);
      expect(mockRemember).toHaveBeenCalledWith(
        expect.stringContaining("filename: hello.txt"),
        "artifact-vault"
      );
      expect(mockWaitForRememberJob).toHaveBeenCalledWith("job-123");

      expect(result.id).toBeDefined();
      expect(result.blobId).toBe("my-uploaded-blob-id");
      expect(result.metaMemoryId).toBe("memory-blob-id");
      expect(result.version).toBe(1);

      // Verify inspector sync was fired (fire-and-forget)
      expect(inspectorFetchSpy).toHaveBeenCalledWith(
        "https://inspector.example.com/api/sync-artifact",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("hello.txt"),
        })
      );
    });

    it("should throw WalrusVaultPartialError if MemWal remember fails", async () => {
      mockStore.mockResolvedValue({
        blobId: "my-uploaded-blob-id",
        size: 1234,
        alreadyExists: false,
      });

      mockRemember.mockRejectedValue(new Error("MemWal database offline"));

      const vault = ArtifactVault.create(config);
      const fileBytes = new Uint8Array([1, 2, 3]);
      const meta = {
        filename: "hello.txt",
        contentType: "text/plain",
      };

      await expect(vault.store(fileBytes, meta)).rejects.toThrow(WalrusVaultPartialError);
    });
  });

  describe("search", () => {
    it("should return deduplicated latest version results", async () => {
      const artV1: StoredArtifact = {
        id: "art-1",
        blobId: "blob-1-v1",
        filename: "data.csv",
        contentType: "text/csv",
        tags: [],
        version: 1,
        latestVersion: 1,
        versions: [{ version: 1, blobId: "blob-1-v1", createdAt: "" }],
        size: 50,
        downloadUrl: "http://aggregator/v1/blobs/blob-1-v1",
        createdAt: "2026-06-09T10:00:00Z",
      };
      
      const artV2: StoredArtifact = {
        id: "art-1",
        blobId: "blob-1-v2",
        filename: "data.csv",
        contentType: "text/csv",
        tags: [],
        version: 2,
        latestVersion: 2,
        versions: [
          { version: 1, blobId: "blob-1-v1", createdAt: "" },
          { version: 2, blobId: "blob-1-v2", createdAt: "" },
        ],
        size: 60,
        downloadUrl: "http://aggregator/v1/blobs/blob-1-v2",
        createdAt: "2026-06-09T11:00:00Z",
      };

      const rawMetadataV1 = serializeMetadata(artV1);
      const rawMetadataV2 = serializeMetadata(artV2);

      mockRecall.mockResolvedValue({
        results: [
          { text: rawMetadataV2, distance: 0.1 },
          { text: rawMetadataV1, distance: 0.3 },
          { text: "random-non-artifact-memory", distance: 0.5 },
        ],
      });

      const vault = ArtifactVault.create(config);
      const results = await vault.search("data");

      expect(mockRecall).toHaveBeenCalledWith({
        query: "data",
        limit: 50,
        namespace: "artifact-vault",
        maxDistance: undefined,
      });

      expect(results.length).toBe(1);
      expect(results[0].id).toBe("art-1");
      expect(results[0].version).toBe(2);
      expect(results[0].blobId).toBe("blob-1-v2");
    });
  });

  describe("get and storeVersion", () => {
    it("should return single artifact", async () => {
      const art: StoredArtifact = {
        id: "art-1",
        blobId: "blob-1-v1",
        filename: "data.csv",
        contentType: "text/csv",
        tags: [],
        version: 1,
        latestVersion: 1,
        versions: [{ version: 1, blobId: "blob-1-v1", createdAt: "" }],
        size: 50,
        downloadUrl: "http://aggregator/v1/blobs/blob-1-v1",
        createdAt: "2026-06-09T10:00:00Z",
      };

      mockRecall.mockResolvedValue({
        results: [{ text: serializeMetadata(art), distance: 0.0 }],
      });

      const vault = ArtifactVault.create(config);
      const detail = await vault.get("art-1");

      expect(detail).not.toBeNull();
      expect(detail!.id).toBe("art-1");
      expect(detail!.walrusBlobInfo.blobId).toBe("blob-1-v1");
    });

    it("should store a new version of an existing artifact", async () => {
      const artV1: StoredArtifact = {
        id: "art-1",
        blobId: "blob-1-v1",
        filename: "data.csv",
        contentType: "text/csv",
        tags: ["data"],
        version: 1,
        latestVersion: 1,
        versions: [{ version: 1, blobId: "blob-1-v1", createdAt: "2026-06-09T10:00:00Z", size: 50 }],
        size: 50,
        downloadUrl: "http://aggregator/v1/blobs/blob-1-v1",
        createdAt: "2026-06-09T10:00:00Z",
      };

      // Mock recall for get() inside storeVersion
      mockRecall.mockResolvedValue({
        results: [{ text: serializeMetadata(artV1), distance: 0.0 }],
      });

      mockStore.mockResolvedValue({
        blobId: "blob-1-v2",
        size: 75,
        alreadyExists: false,
      });

      mockRemember.mockResolvedValue({ job_id: "job-v2" });
      mockWaitForRememberJob.mockResolvedValue({ blob_id: "memory-v2-blob-id" });

      const vault = ArtifactVault.create(config);
      const updated = await vault.storeVersion("art-1", new Uint8Array([1, 2, 3]), {
        description: "Updated CSV with new rows",
      });

      expect(updated.version).toBe(2);
      expect(updated.latestVersion).toBe(2);
      expect(updated.blobId).toBe("blob-1-v2");
      expect(updated.versions.length).toBe(2);
      expect(updated.versions[1].version).toBe(2);
      expect(updated.versions[1].blobId).toBe("blob-1-v2");
      expect(updated.versions[1].description).toBe("Updated CSV with new rows");
    });

    it("should throw ArtifactNotFoundError if trying to store version of non-existent artifact", async () => {
      mockRecall.mockResolvedValue({ results: [] });

      const vault = ArtifactVault.create(config);
      await expect(
        vault.storeVersion("non-existent", new Uint8Array([1]))
      ).rejects.toThrow(ArtifactNotFoundError);
    });
  });
});
