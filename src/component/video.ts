import { internalMutation, internalQuery } from "./_generated/server.js";
import { v } from "convex/values";

export const getCachedVideosByIds = internalQuery({
  args: { videoIds: v.array(v.string()) },
  returns: v.array(
    v.object({
      videoId: v.string(),
      cached: v.boolean(),
      fresh: v.boolean(),
      data: v.union(
        v.object({
          videoId: v.string(),
          title: v.string(),
          channel: v.string(),
          channelId: v.string(),
          publishedAt: v.string(),
          description: v.string(),
          viewCount: v.optional(v.string()),
          likeCount: v.optional(v.string()),
          duration: v.string(),
          thumbnails: v.string(),
        }),
        v.null(),
      ),
    }),
  ),
  handler: async (ctx, { videoIds }) => {
    const nowMs = Date.now();
    const results = [];

    for (const videoId of videoIds) {
      const video = await ctx.db
        .query("videos")
        .withIndex("by_videoId", (q) => q.eq("videoId", videoId))
        .first();

      if (video === null) {
        results.push({ videoId, cached: false, fresh: false, data: null });
        continue;
      }

      const ttlEntry = await ctx.db
        .query("videoCacheTTL")
        .withIndex("by_videoId", (q) => q.eq("videoId", video._id))
        .first();

      const isFresh =
        ttlEntry !== null && Number(ttlEntry.expiresAtMs) > nowMs;

      const { _id, _creationTime, lastFetchedAtMs, ...data } = video;

      results.push({ videoId, cached: true, fresh: isFresh, data });
    }

    return results;
  },
});

export const upsertVideos = internalMutation({
  args: {
    videos: v.array(
      v.object({
        videoId: v.string(),
        title: v.string(),
        channel: v.string(),
        channelId: v.string(),
        publishedAt: v.string(),
        description: v.string(),
        viewCount: v.optional(v.string()),
        likeCount: v.optional(v.string()),
        duration: v.string(),
        thumbnails: v.string(),
      }),
    ),
    ttlMs: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { videos, ttlMs }) => {
    const nowMs = Date.now();
    const expiresAtMs = BigInt(nowMs + ttlMs);
    const lastFetchedAtMs = BigInt(nowMs);

    for (const videoData of videos) {
      const existing = await ctx.db
        .query("videos")
        .withIndex("by_videoId", (q) => q.eq("videoId", videoData.videoId))
        .first();

      if (existing === null) {
        const videoDocId = await ctx.db.insert("videos", {
          ...videoData,
          lastFetchedAtMs,
        });
        await ctx.db.insert("videoCacheTTL", {
          videoId: videoDocId,
          expiresAtMs,
        });
      } else {
        await ctx.db.patch(existing._id, { ...videoData, lastFetchedAtMs });

        const ttlEntry = await ctx.db
          .query("videoCacheTTL")
          .withIndex("by_videoId", (q) => q.eq("videoId", existing._id))
          .first();

        if (ttlEntry !== null) {
          await ctx.db.patch(ttlEntry._id, { expiresAtMs });
        } else {
          await ctx.db.insert("videoCacheTTL", {
            videoId: existing._id,
            expiresAtMs,
          });
        }
      }
    }
  },
});
