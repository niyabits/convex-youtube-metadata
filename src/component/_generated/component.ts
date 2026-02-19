/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    lib: {
      fetchVideoMetadata: FunctionReference<
        "action",
        "internal",
        { apiKey: string; videoId: string },
        | {
            channel: string;
            description: string;
            duration: string;
            likeCount: string;
            publishedAt: string;
            thumbnails: string;
            title: string;
            videoId: string;
            viewCount: string;
          }
        | { error: string },
        Name
      >;
    };
  };
