import { v } from "convex/values";
import {
  action,
  query,
} from "./_generated/server.js";
import { api } from "./_generated/api.js";
import schema from "./schema.js";


const videoValidator = schema.tables.videos.validator.extend({
  _id: v.id("videos"),
  _creationTime: v.number(),
});


// Test Video URL: dQw4w9WgXcQ
export const fetchVideoMetadata = action({
  args: { videoId: v.string(), apiKey: v.string() },
  returns: v.any(),
  /*
   * Convex Runtime does not complete Node.js support, so we need to avoid Node.js libs and directly call the API.
   * */
  handler: async (ctx, { videoId, apiKey }) => {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=${apiKey}`;

    try {
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`[HTTP Error] status: ${res.status}`);
      }

      const data = await res.json();

      if (!data.items || data.items.length === 0) {
        return { error: "Video not found or is private." };
      }

      const video = data.items[0];
      const metadata = {
        videoId,
        title: video.snippet.title,
        channel: video.snippet.channelTitle,
        publishedAt: video.snippet.publishedAt,
        description: video.snippet.description,
        viewCount: video.statistics.viewCount,
        likeCount: video.statistics.likeCount,
        duration: video.contentDetails.duration, // Note: This is in ISO 8601 format (e.g., PT3M33S)
        thumbnails: video.snippet.thumbnails.high.url
      };

      await ctx.runMutation(api.video.storeVideo, metadata)

    } catch (error) {
      console.error("Failed to fetch metadata:", error);
    }
  }
})

export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(videoValidator),
  handler: async (ctx, { limit }) => {
    const video = ctx.db.query("videos").order("desc").take(limit ?? 100)

    return video
  }
})

