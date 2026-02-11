import { action } from "./_generated/server.js";
import { components } from "./_generated/api.js";
import { v } from "convex/values";

export const fetchVideoMetadata = action({
  args: { videoId: v.string() },
  returns: v.any(),
  handler: async (ctx, { videoId }) => {
    if (process.env.GOOGLE_API_KEY === undefined) {
      console.error("GOOGLE_API_KEY Not Found")
      return
    }

    return await ctx.runAction(components.convexYoutubeMetadata.lib.fetchVideoMetadata, {
      apiKey: process.env.GOOGLE_API_KEY,
      videoId: videoId
    });
  },
});

