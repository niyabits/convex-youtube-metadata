import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // @todo: remove as this type is from the template
  comments: defineTable({
    text: v.string(),
    userId: v.string(), // Note: you can't use v.id referring to external tables
    targetId: v.string(),
  }).index("targetId", ["targetId"]),
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
