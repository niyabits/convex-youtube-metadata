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
      add: FunctionReference<
        "mutation",
        "internal",
        { targetId: string; text: string; userId: string },
        string,
        Name
      >;
      fetchVideoMetadata: FunctionReference<
        "action",
        "internal",
        { apiKey: string; videoId: string },
        any,
        Name
      >;
      list: FunctionReference<
        "query",
        "internal",
        { limit?: number; targetId: string },
        Array<{
          _creationTime: number;
          _id: string;
          targetId: string;
          text: string;
          userId: string;
        }>,
        Name
      >;
      translate: FunctionReference<
        "action",
        "internal",
        { baseUrl: string; commentId: string },
        string,
        Name
      >;
    };
    video: {
      getVideoMetadata: FunctionReference<
        "query",
        "internal",
        { videoId: string },
        any,
        Name
      >;
      storeVideo: FunctionReference<
        "mutation",
        "internal",
        {
          channel: string;
          description: string;
          duration: string;
          likeCount: string;
          publishedAt: string;
          thumbnails: string;
          title: string;
          videoId: string;
          viewCount: string;
        },
        any,
        Name
      >;
    };
  };
