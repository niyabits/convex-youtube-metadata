import { v, type Infer } from "convex/values";
import {
  action
} from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import schema from "./schema.js";

const videoValidator = schema.tables.videos.validator.extend({
  _id: v.id("videos"),
  _creationTime: v.number(),
});

// Test Video URL: dQw4w9WgXcQ
export const fetchVideoMetadata = action({
  args: { videoId: v.string(), apiKey: v.string() },
  returns: schema.tables.videos.validator,
  handler: async (ctx, { videoId, apiKey }) => {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=${apiKey}`;

    // Check if video is in the Database 
    const video = await ctx.runQuery(internal.video.getMetadata, { videoId }) as Infer<typeof videoValidator>
    if (video !== null) {
      const { _id, _creationTime, ...videoData } = video
      return videoData
    }

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

      await ctx.runMutation(internal.video.storeVideo, metadata)
      return video
    } catch (error) {
      console.error("Failed to fetch metadata:", error);
    }
  }
})

