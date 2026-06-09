// @walrus-vault/sdk — Walrus HTTP API client
//
// Wraps fetch() calls to the Walrus publisher and aggregator.
// No Walrus SDK dependency — the HTTP API is simple enough that a
// wrapper package adds overhead without value.

import { WalrusUploadError, WalrusDownloadError } from "./errors.js";

/**
 * Result from a Walrus store operation.
 */
export interface WalrusStoreResult {
  blobId: string;
  size: number;
  alreadyExists: boolean;
}

/**
 * Lightweight HTTP client for the Walrus blob storage API.
 * Handles both newlyCreated and alreadyCertified responses.
 */
export class WalrusClient {
  private readonly publisher: string;
  private readonly aggregator: string;

  constructor(publisher: string, aggregator: string) {
    // Strip trailing slashes
    this.publisher = publisher.replace(/\/+$/, "");
    this.aggregator = aggregator.replace(/\/+$/, "");
  }

  /**
   * Upload data to Walrus.
   *
   * CRITICAL: The correct endpoint is PUT /v1/blobs?epochs={n}
   * NOT /v1/store — that endpoint does not exist and will 404.
   */
  async store(
    data: Buffer | Uint8Array,
    contentType: string,
    epochs: number,
  ): Promise<WalrusStoreResult> {
    const url = `${this.publisher}/v1/blobs?epochs=${epochs}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": contentType,
        },
        body: data as any,
      });
    } catch (err) {
      throw new WalrusUploadError(
        `Walrus upload failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new WalrusUploadError(
        `Walrus upload failed with status ${response.status}: ${body}`,
        response.status,
        body,
      );
    }

    const result = await response.json();

    // Handle both Walrus response shapes
    if (result.newlyCreated) {
      return {
        blobId: result.newlyCreated.blobObject.blobId,
        size: result.newlyCreated.blobObject.size ?? data.byteLength,
        alreadyExists: false,
      };
    }

    if (result.alreadyCertified) {
      return {
        blobId: result.alreadyCertified.blobId,
        size: data.byteLength,
        alreadyExists: true,
      };
    }

    throw new WalrusUploadError(
      `Unexpected Walrus response format: ${JSON.stringify(result)}`,
    );
  }

  /**
   * Download raw blob bytes from the Walrus aggregator.
   */
  async download(blobId: string): Promise<Uint8Array> {
    const url = this.getBlobUrl(blobId);

    let response: Response;
    try {
      response = await fetch(url);
    } catch (err) {
      throw new WalrusDownloadError(
        `Walrus download failed: ${err instanceof Error ? err.message : String(err)}`,
        blobId,
      );
    }

    if (!response.ok) {
      throw new WalrusDownloadError(
        `Walrus download failed with status ${response.status}`,
        blobId,
        response.status,
      );
    }

    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  /**
   * Get the aggregator URL for a blob (does not fetch bytes).
   */
  getBlobUrl(blobId: string): string {
    return `${this.aggregator}/v1/blobs/${blobId}`;
  }
}
