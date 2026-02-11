import { internalMutation, internalQuery } from "./_generated/server.js";
import { v } from "convex/values";
import schema from "./schema.js";

const videoValidator = schema.tables.videos.validator.extend({
  _id: v.id("videos"),
  _creationTime: v.number(),
});

export const storeVideo = internalMutation({
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

export const getMetadata = internalQuery({
  args: {
    videoId: v.string(),
  },
  returns: v.union(videoValidator, v.null()),
  handler: async (ctx, { videoId }) => {
    const video = ctx.db.query("videos").withIndex("by_videoId", (q) => q.eq("videoId", videoId)).first()

    return video
  }
})

