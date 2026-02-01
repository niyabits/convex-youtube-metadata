import { action, query } from "./_generated/server.js";
import { components } from "./_generated/api.js";
import { v } from "convex/values";
import { exposeApi } from "convex-youtube-metadata";

export const fetchVideoMetadata = action({
  args: { videoId: v.string() },
  handler: async (ctx, { videoId }) => {
    if (process.env.GOOGLE_API_KEY === undefined) {
      return
    }

    return await ctx.runAction(components.convexYoutubeMetadata.lib.fetchVideoMetadata, {
      apiKey: process.env.GOOGLE_API_KEY,
      videoId: videoId
    });
  },
});

export const getVideoMetadata = query({
  args: { videoId: v.string() },
  returns: v.any(),
  handler(ctx, args) {

    return ctx.runQuery(components.convexYoutubeMetadata.video.getMetadata, {
      videoId: args.videoId
    })
  },
})


// Re-exporting the component's API:
export const { list } = exposeApi(components.convexYoutubeMetadata, {
  auth: async (_, __) => {
    return ""
  },
});
