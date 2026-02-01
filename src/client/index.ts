import {
  mutationGeneric,
  queryGeneric,
} from "convex/server";
import type {
  Auth,
} from "convex/server";
import { v } from "convex/values";
import type { ComponentApi } from "../component/_generated/component.js";

// See the example/convex/example.ts file for how to use this component.


/**
 * For re-exporting of an API accessible from React clients.
 * e.g. `export const { list, add  } =
 * exposeApi(components.convexYoutubeMetadata, {
 *   auth: async (ctx, operation) => { ... },
 * });`
 * See example/convex/example.ts.
 */
export function exposeApi(
  component: ComponentApi,
  options: {
    /**
     * It's very important to authenticate any functions that users will export.
     * This function should return the authorized user's ID.
     */
    auth: (
      ctx: { auth: Auth },
      operation:
        | { type: "read"; targetId: string }
        | { type: "create"; targetId: string }
        | { type: "update"; commentId: string },
    ) => Promise<string>;
    baseUrl?: string;
  },
) {
  return {
    list: queryGeneric({
      handler: async (ctx, _) => {
        return await ctx.runQuery(component.lib.list, {});
      },
    }),
    add: mutationGeneric({
      args: { text: v.string(), targetId: v.string() },
      handler: async (ctx, args) => {
        const userId = await options.auth(ctx, {
          type: "create",
          targetId: args.targetId,
        });
        return await ctx.runMutation(component.lib.add, {
          text: args.text,
          userId: userId,
          targetId: args.targetId,
        });
      },
    }),
  };
}

