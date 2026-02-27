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
        {
          config: {
            apiKey: string;
            dailyQuotaUnits?: number;
            maxConcurrentReservations?: number;
            reservationLeaseMs?: number;
            reservationTimeoutMs?: number;
            retry?: {
              initialBackoffMs?: number;
              maxAttempts?: number;
              maxBackoffMs?: number;
              multiplier?: number;
            };
            ttlMs?: number;
          };
          videoId: string;
        },
        {
          data?: {
            channel: string;
            channelId: string;
            description: string;
            duration: string;
            likeCount?: string;
            publishedAt: string;
            thumbnails: string;
            title: string;
            videoId: string;
            viewCount?: string;
          };
          error?: string;
          ok: boolean;
          source?: "cache" | "youtube";
          videoId: string;
        },
        Name
      >;
      fetchVideoMetadataBatch: FunctionReference<
        "action",
        "internal",
        {
          config: {
            apiKey: string;
            dailyQuotaUnits?: number;
            maxConcurrentReservations?: number;
            reservationLeaseMs?: number;
            reservationTimeoutMs?: number;
            retry?: {
              initialBackoffMs?: number;
              maxAttempts?: number;
              maxBackoffMs?: number;
              multiplier?: number;
            };
            ttlMs?: number;
          };
          videoIds: Array<string>;
        },
        {
          items: Array<{
            data?: {
              channel: string;
              channelId: string;
              description: string;
              duration: string;
              likeCount?: string;
              publishedAt: string;
              thumbnails: string;
              title: string;
              videoId: string;
              viewCount?: string;
            };
            error?: string;
            ok: boolean;
            source?: "cache" | "youtube";
            videoId: string;
          }>;
        },
        Name
      >;
      getCacheStats: FunctionReference<
        "query",
        "internal",
        {},
        {
          activeReservations: number;
          cacheHits: number;
          cacheMisses: number;
          hitRate: number;
          quota: {
            dayKey: string;
            quotaLimit: number;
            remaining: number;
            unitsUsed: number;
          };
        },
        Name
      >;
    };
  };
