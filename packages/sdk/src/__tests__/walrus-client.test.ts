import { describe, it, expect, vi, beforeEach } from "vitest";
import { WalrusClient } from "../walrus-client.js";
import { WalrusUploadError, WalrusDownloadError } from "../errors.js";

describe("WalrusClient", () => {
  const publisherUrl = "https://publisher.example.com";
  const aggregatorUrl = "https://aggregator.example.com";
  let client: WalrusClient;

  beforeEach(() => {
    client = new WalrusClient(publisherUrl, aggregatorUrl);
    vi.restoreAllMocks();
  });

  it("should construct with normalized urls", () => {
    const customClient = new WalrusClient("https://pub.com/", "https://agg.com///");
    expect(customClient.getBlobUrl("my-blob")).toBe("https://agg.com/v1/blobs/my-blob");
  });

  it("should upload new blob successfully", async () => {
    const mockResponse = {
      newlyCreated: {
        blobObject: {
          id: "0xobjectid",
          blobId: "newly-created-blob-id",
          size: 500,
        },
      },
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const data = new Uint8Array([1, 2, 3, 4]);
    const result = await client.store(data, "text/plain", 5);

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://publisher.example.com/v1/blobs?epochs=5",
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "text/plain" },
        body: data,
      })
    );

    expect(result).toEqual({
      blobId: "newly-created-blob-id",
      size: 500,
      alreadyExists: false,
    });
  });

  it("should handle alreadyCertified response when uploading identical bytes", async () => {
    const mockResponse = {
      alreadyCertified: {
        blobId: "already-certified-blob-id",
      },
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const data = new Uint8Array([1, 2, 3, 4]);
    const result = await client.store(data, "text/plain", 10);

    expect(result).toEqual({
      blobId: "already-certified-blob-id",
      size: 4, // falls back to data.byteLength
      alreadyExists: true,
    });
  });

  it("should throw WalrusUploadError on fetch network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network Error"));

    const data = new Uint8Array([1, 2, 3]);
    await expect(client.store(data, "text/plain", 10)).rejects.toThrow(WalrusUploadError);
  });

  it("should throw WalrusUploadError on non-ok status code", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    } as Response);

    const data = new Uint8Array([1, 2, 3]);
    await expect(client.store(data, "text/plain", 10)).rejects.toThrow(WalrusUploadError);
  });

  it("should download raw blob bytes successfully", async () => {
    const arrayBuffer = new ArrayBuffer(4);
    const view = new Uint8Array(arrayBuffer);
    view.set([10, 20, 30, 40]);

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      arrayBuffer: async () => arrayBuffer,
    } as Response);

    const bytes = await client.download("test-blob-id");
    expect(bytes).toEqual(new Uint8Array([10, 20, 30, 40]));
  });

  it("should throw WalrusDownloadError on download status failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    await expect(client.download("non-existent-blob")).rejects.toThrow(WalrusDownloadError);
  });
});
