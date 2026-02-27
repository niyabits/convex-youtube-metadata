import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  videos: defineTable({
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
    lastFetchedAtMs: v.int64(),
  }).index("by_videoId", ["videoId"]),

  videoCacheTTL: defineTable({
    videoId: v.id("videos"),
    expiresAtMs: v.int64(),
  }).index("by_videoId", ["videoId"]),

  quotaDays: defineTable({
    dayKey: v.string(),
    quotaLimit: v.number(),
    unitsUsed: v.number(),
    updatedAtMs: v.int64(),
  }).index("by_dayKey", ["dayKey"]),

  reservations: defineTable({
    reservationKey: v.string(),
    videoIds: v.array(v.string()),
    unitsReserved: v.number(),
    status: v.union(v.literal("held"), v.literal("charged")),
    createdAtMs: v.int64(),
    expiresAtMs: v.int64(),
  })
    .index("by_reservationKey", ["reservationKey"])
    .index("by_status", ["status"]),

  cacheStats: defineTable({
    key: v.string(),
    cacheHits: v.number(),
    cacheMisses: v.number(),
    youtubeApiCalls: v.number(),
    updatedAtMs: v.int64(),
  }).index("by_key", ["key"]),
});
