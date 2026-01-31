import { v } from "convex/values";
import { httpActionGeneric } from "convex/server";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server.js";
import { api, internal } from "./_generated/api.js";
import schema from "./schema.js";

const commentValidator = schema.tables.comments.validator.extend({
  _id: v.id("comments"),
  _creationTime: v.number(),
});

export const list = query({
  args: {
    targetId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(commentValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("comments")
      .withIndex("targetId", (q) => q.eq("targetId", args.targetId))
      .order("desc")
      .take(args.limit ?? 100);
  },
});

export const getComment = internalQuery({
  args: {
    commentId: v.id("comments"),
  },
  returns: v.union(v.null(), commentValidator),
  handler: async (ctx, args) => {
    return await ctx.db.get("comments", args.commentId);
  },
});
export const add = mutation({
  args: {
    text: v.string(),
    userId: v.string(),
    targetId: v.string(),
  },
  returns: v.id("comments"),
  handler: async (ctx, args) => {
    const commentId = await ctx.db.insert("comments", {
      text: args.text,
      userId: args.userId,
      targetId: args.targetId,
    });
    return commentId;
  },
});
export const updateComment = internalMutation({
  args: {
    commentId: v.id("comments"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("comments", args.commentId, { text: args.text });
  },
});

export const translate = action({
  args: {
    commentId: v.id("comments"),
    baseUrl: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const comment = (await ctx.runQuery(internal.lib.getComment, {
      commentId: args.commentId,
    })) as { text: string; userId: string } | null;
    if (!comment) {
      throw new Error("Comment not found");
    }
    const response = await fetch(
      `${args.baseUrl}/api/translate?english=${encodeURIComponent(comment.text)}`,
    );
    const data = await response.text();
    await ctx.runMutation(internal.lib.updateComment, {
      commentId: args.commentId,
      text: data,
    });
    return data;
  },
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


