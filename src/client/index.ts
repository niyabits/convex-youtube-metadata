import {
  queryGeneric,
} from "convex/server";
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
) {
  return {
    list: queryGeneric({
      handler: async (ctx, _) => {
        return await ctx.runQuery(component.lib.list, {});
      },
    }),
  };
}

