import { action } from "./_generated/server.js";
import { components } from "./_generated/api.js";
import { v } from "convex/values";

export const fetchVideoMetadata = action({
  args: { videoId: v.string() },
  returns: v.any(),
  handler: async (ctx, { videoId }) => {
    if (process.env.GOOGLE_API_KEY === undefined) {
      console.error("GOOGLE_API_KEY Not Found");
      return;
    }

    return await ctx.runAction(
      components.convexYoutubeMetadata.lib.fetchVideoMetadata,
      {
        videoId,
        config: {
          apiKey: process.env.GOOGLE_API_KEY,
          ttlMs: 24 * 60 * 60 * 1000,
        },
      },
    );
  },
});

export const fetchVideoMetadataBatch = action({
  args: { videoIds: v.array(v.string()) },
  returns: v.any(),
  handler: async (ctx, { videoIds }) => {
    if (process.env.GOOGLE_API_KEY === undefined) {
      console.error("GOOGLE_API_KEY Not Found");
      return;
    }

    return await ctx.runAction(
      components.convexYoutubeMetadata.lib.fetchVideoMetadataBatch,
      {
        videoIds,
        config: {
          apiKey: process.env.GOOGLE_API_KEY,
          ttlMs: 24 * 60 * 60 * 1000,
        },
      },
    );
  },
});
