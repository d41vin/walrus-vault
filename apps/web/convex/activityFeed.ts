import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Append an activity item to the feed.
 */
export const append = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("activityFeed", args);
  },
});

/**
 * List the most recent activity feed items for an account.
 */
export const list = query({
  args: {
    accountId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    return await ctx.db
      .query("activityFeed")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .order("desc") // Order by timestamp desc if index by_account handles sorting or we filter and sort
      .take(limit);
  },
});
