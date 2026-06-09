import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Validator for a StoredArtifact object matching StoredArtifact in SDK
const storedArtifactValidator = v.object({
  id: v.string(),
  blobId: v.string(),
  filename: v.string(),
  contentType: v.string(),
  description: v.optional(v.string()),
  tags: v.array(v.string()),
  agentId: v.optional(v.string()),
  sessionId: v.optional(v.string()),
  version: v.number(),
  latestVersion: v.number(),
  versions: v.array(
    v.object({
      version: v.number(),
      blobId: v.string(),
      description: v.optional(v.string()),
      createdAt: v.string(),
      size: v.optional(v.number()),
    })
  ),
  derivedFrom: v.optional(v.string()),
  dependsOn: v.optional(v.array(v.string())),
  size: v.number(),
  downloadUrl: v.string(),
  createdAt: v.string(),
  metaMemoryId: v.optional(v.string()),
});

/**
 * Upsert artifact metadata into the Convex cache.
 * Called by SDK sync-artifact webhook or directly from web uploads.
 */
export const upsertCache = mutation({
  args: {
    accountId: v.string(),
    artifact: storedArtifactValidator,
  },
  handler: async (ctx, args) => {
    const { accountId, artifact } = args;

    // Check if we already have this artifact cached for this account
    const existing = await ctx.db
      .query("artifactCache")
      .withIndex("by_account", (q) => q.eq("accountId", accountId))
      .filter((q) => q.eq(q.field("artifactId"), artifact.id))
      .unique();

    const cacheEntry = {
      accountId,
      artifactId: artifact.id,
      blobId: artifact.blobId,
      filename: artifact.filename,
      contentType: artifact.contentType,
      description: artifact.description,
      tags: artifact.tags,
      agentId: artifact.agentId,
      size: artifact.size,
      version: artifact.version,
      latestVersion: artifact.latestVersion,
      derivedFrom: artifact.derivedFrom,
      createdAt: artifact.createdAt,
      cachedAt: Date.now(),
    };

    if (existing) {
      // Update existing cache entry
      await ctx.db.patch(existing._id, cacheEntry);
      return existing._id;
    } else {
      // Insert new cache entry
      return await ctx.db.insert("artifactCache", cacheEntry);
    }
  },
});

/**
 * Retrieve a cached artifact by ID.
 */
export const getCachedArtifact = query({
  args: {
    accountId: v.string(),
    artifactId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("artifactCache")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .filter((q) => q.eq(q.field("artifactId"), args.artifactId))
      .unique();
  },
});

/**
 * List all cached artifacts for a given account.
 * Allows optional filtering by content type.
 */
export const listCachedArtifacts = query({
  args: {
    accountId: v.string(),
    contentType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.contentType) {
      return await ctx.db
        .query("artifactCache")
        .withIndex("by_account_content_type", (q) =>
          q.eq("accountId", args.accountId).eq("contentType", args.contentType!)
        )
        .collect();
    }

    return await ctx.db
      .query("artifactCache")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .collect();
  },
});

/**
 * Search cached artifacts by filename.
 */
export const searchCachedArtifacts = query({
  args: {
    accountId: v.string(),
    queryText: v.string(),
    contentType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.queryText.trim().length === 0) {
      return [];
    }

    let search = ctx.db
      .query("artifactCache")
      .withSearchIndex("search_artifacts", (q) => {
        let sq = q.search("filename", args.queryText).eq("accountId", args.accountId);
        if (args.contentType) {
          sq = sq.eq("contentType", args.contentType);
        }
        return sq;
      });

    return await search.take(50);
  },
});
