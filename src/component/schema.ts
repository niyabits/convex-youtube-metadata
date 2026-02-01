import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // @todo: use better types at some points?
  videos: defineTable({
    videoId: v.string(),
    title: v.string(),
    channel: v.string(),
    publishedAt: v.string(),
    description: v.string(),
    viewCount: v.string(),
    likeCount: v.string(),
    duration: v.string(),
    thumbnails: v.string()
  }).index("by_videoId", ["videoId"])
});
