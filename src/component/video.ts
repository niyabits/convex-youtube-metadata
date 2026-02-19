import { internalMutation, internalQuery } from "./_generated/server.js";
import { v } from "convex/values";
import schema from "./schema.js";

const videoValidator = schema.tables.videos.validator.extend({
  _id: v.id("videos"),
  _creationTime: v.number(),
});

export const getVideoExpTime = internalQuery({
  args: {
    videoId: v.id("videos"),
  },
  returns: v.nullable(v.int64()),
  handler: async (ctx, { videoId }) => {
    const videoCacheTTL = await ctx.db
      .query("videoCacheTTL")
      .withIndex("by_videoId", q => q.eq("videoId", videoId))
      .first()

    return videoCacheTTL?.expirationTime
  }
})

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
  returns: v.nullable(videoValidator),
  handler: async (ctx, data) => {
    const currentISOTime = Math.floor(Date.now() / 1000);
    const expirationTime = currentISOTime + (60 * 60) // expire in 1 hour

    const existingVideo = await ctx.db
      .query("videos")
      .withIndex("by_videoId", q => q.eq("videoId", data.videoId))
      .unique()

    if (existingVideo === null) {
      const videoId = await ctx.db.insert("videos", data)
      await ctx.db.insert("videoCacheTTL", { videoId, expirationTime: BigInt(expirationTime) })

      const vid = await ctx.db.get(videoId)
      return vid
    }

    const existingTTL = await ctx.db
      .query("videoCacheTTL")
      .withIndex("by_videoId", q => q.eq("videoId", existingVideo._id))
      .unique()

    if (existingTTL === null || existingTTL._id === undefined) {
      console.error("TTL does not exist for the video ", existingVideo.videoId)
      return undefined
    }

    await ctx.db.patch("videos", existingVideo._id, data)
    await ctx.db.patch("videoCacheTTL", existingTTL?._id, { expirationTime: BigInt(expirationTime) })
    return existingVideo
  }
})

/* Get the metadata of an existing video */
export const getMetadata = internalQuery({
  args: {
    videoId: v.string(),
  },
  returns: v.union(videoValidator, v.null()),
  handler: async (ctx, { videoId }) => {
    const video = await ctx.db.query("videos").withIndex("by_videoId", (q) => q.eq("videoId", videoId)).first()
    return video
  }
})

