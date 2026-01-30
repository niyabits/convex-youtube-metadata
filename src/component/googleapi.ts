import { action } from "./_generated/server"
import { api } from "./_generated/api"
import { v } from "convex/values"

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

