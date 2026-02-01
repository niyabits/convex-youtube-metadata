import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";

export const storeVideo = mutation({
  args: {
    videoId: v.string(),
    title: v.string(),
    channel: v.string(),
    publishedAt: v.string(),
    description: v.string(),
    viewCount: v.string(),
    likeCount: v.string(),
    duration: v.string(),
    thumbnails: v.string()
  },
  handler: async (ctx, data) => {
    const existing = await ctx.db
      .query("videos")
      .withIndex("by_videoId", q => q.eq("videoId", data.videoId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("videos", data)
    }
  }
})

export const getMetadata = query({
  args: {
    videoId: v.string(),
  },
  // @todo: use schema.videos 
  returns: v.any(),
  handler: async (ctx, { videoId }) => {
    const video = ctx.db.query("videos").withIndex("by_videoId", (q) => q.eq("videoId", videoId)).collect()

    // @todo, request the video if not present?
    return video
  }
})

