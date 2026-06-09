// @walrus-vault/sdk — Custom error types

/**
 * Walrus blob upload failed (non-2xx from publisher).
 */
export class WalrusUploadError extends Error {
  public readonly statusCode?: number;
  public readonly responseBody?: string;

  constructor(message: string, statusCode?: number, responseBody?: string) {
    super(message);
    this.name = "WalrusUploadError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

/**
 * Walrus blob download failed.
 */
export class WalrusDownloadError extends Error {
  public readonly statusCode?: number;
  public readonly blobId: string;

  constructor(message: string, blobId: string, statusCode?: number) {
    super(message);
    this.name = "WalrusDownloadError";
    this.blobId = blobId;
    this.statusCode = statusCode;
  }
}

/**
 * MemWal metadata storage failed (remember() or waitForRememberJob()).
 */
export class MetadataStoreError extends Error {
  public readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = "MetadataStoreError";
    this.cause = cause;
  }
}

/**
 * Artifact not found by ID.
 */
export class ArtifactNotFoundError extends Error {
  public readonly artifactId: string;

  constructor(artifactId: string) {
    super(`Artifact not found: ${artifactId}`);
    this.name = "ArtifactNotFoundError";
    this.artifactId = artifactId;
  }
}

/**
 * Invalid configuration (missing required fields).
 */
export class InvalidConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidConfigError";
  }
}

/**
 * Partial failure — Walrus upload succeeded but MemWal metadata storage failed.
 * Contains the blobId so the developer can retry metadata storage without re-uploading.
 */
export class WalrusVaultPartialError extends Error {
  public readonly partial = true as const;
  public readonly blobId: string;
  public readonly size: number;
  public readonly downloadUrl: string;
  public readonly cause?: Error;

  constructor(
    message: string,
    blobId: string,
    size: number,
    downloadUrl: string,
    cause?: Error,
  ) {
    super(message);
    this.name = "WalrusVaultPartialError";
    this.blobId = blobId;
    this.size = size;
    this.downloadUrl = downloadUrl;
    this.cause = cause;
  }
}
