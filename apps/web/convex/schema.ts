import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Local cache of artifact metadata for fast Inspector loads
  // Updated by /api/sync-artifact webhook (from MCP uploads) and directly (from web uploads)
  artifactCache: defineTable({
    artifactId: v.string(),
    blobId: v.string(),
    filename: v.string(),
    contentType: v.string(),
    description: v.optional(v.string()),
    tags: v.array(v.string()),
    agentId: v.optional(v.string()),
    size: v.number(),
    version: v.number(),
    latestVersion: v.number(),
    derivedFrom: v.optional(v.string()),
    createdAt: v.string(),
    cachedAt: v.number(),    // unix ms, for cache invalidation
    accountId: v.string(),   // which account this belongs to
  })
    .index("by_account", ["accountId"])
    .index("by_account_content_type", ["accountId", "contentType"])
    .searchIndex("search_artifacts", {
      searchField: "filename",
      filterFields: ["accountId", "contentType"],
    }),

  // Real-time activity feed for dashboard overview
  activityFeed: defineTable({
    accountId: v.string(),
    type: v.union(
      v.literal("artifact_stored"),
      v.literal("artifact_searched"),
      v.literal("memory_recalled"),
      v.literal("version_stored")
    ),
    artifactId: v.optional(v.string()),
    filename: v.optional(v.string()),
    query: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_account", ["accountId"])
    .index("by_account_time", ["accountId", "timestamp"]),
});
