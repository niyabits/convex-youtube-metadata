import { v } from "convex/values";
import { action, query } from "./_generated/server.js";
import { api, internal } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.js";

const TRANSIENT_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

const videoDataValidator = v.object({
  videoId: v.string(),
  title: v.string(),
  channel: v.string(),
  channelId: v.string(),
  publishedAt: v.string(),
  description: v.string(),
  viewCount: v.optional(v.string()),
  likeCount: v.optional(v.string()),
  duration: v.string(),
  thumbnails: v.string(),
});

const resultItemValidator = v.object({
  videoId: v.string(),
  ok: v.boolean(),
  source: v.optional(v.union(v.literal("cache"), v.literal("youtube"))),
  data: v.optional(videoDataValidator),
  error: v.optional(v.string()),
});

const configValidator = v.object({
  apiKey: v.string(),
  ttlMs: v.optional(v.number()),
  dailyQuotaUnits: v.optional(v.number()),
  maxConcurrentReservations: v.optional(v.number()),
  reservationTimeoutMs: v.optional(v.number()),
  reservationLeaseMs: v.optional(v.number()),
  retry: v.optional(
    v.object({
      maxAttempts: v.optional(v.number()),
      initialBackoffMs: v.optional(v.number()),
      maxBackoffMs: v.optional(v.number()),
      multiplier: v.optional(v.number()),
    }),
  ),
});

function resolveConfig(config: {
  apiKey: string;
  ttlMs?: number;
  dailyQuotaUnits?: number;
  maxConcurrentReservations?: number;
  reservationTimeoutMs?: number;
  reservationLeaseMs?: number;
  retry?: {
    maxAttempts?: number;
    initialBackoffMs?: number;
    maxBackoffMs?: number;
    multiplier?: number;
  };
}) {
  return {
    apiKey: config.apiKey,
    ttlMs: config.ttlMs ?? 3_600_000,
    dailyQuotaUnits: config.dailyQuotaUnits ?? 10_000,
    maxConcurrentReservations: config.maxConcurrentReservations ?? 10,
    reservationTimeoutMs: config.reservationTimeoutMs ?? 10_000,
    reservationLeaseMs: config.reservationLeaseMs ?? 30_000,
    retry: {
      maxAttempts: config.retry?.maxAttempts ?? 3,
      initialBackoffMs: config.retry?.initialBackoffMs ?? 500,
      maxBackoffMs: config.retry?.maxBackoffMs ?? 4_000,
      multiplier: config.retry?.multiplier ?? 2,
    },
  };
}

function isTransientError(status: number): boolean {
  return TRANSIENT_STATUS_CODES.has(status);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ResolvedConfig = ReturnType<typeof resolveConfig>;

interface VideoMetadata {
  videoId: string;
  title: string;
  channel: string;
  channelId: string;
  publishedAt: string;
  description: string;
  viewCount?: string;
  likeCount?: string;
  duration: string;
  thumbnails: string;
}

interface ResultItem {
  videoId: string;
  ok: boolean;
  source?: "cache" | "youtube";
  data?: VideoMetadata;
  error?: string;
}

async function fetchChunkWithRetry(
  ctx: { runMutation: (...args: unknown[]) => Promise<unknown> },
  ids: string[],
  cfg: ResolvedConfig,
): Promise<{ fetched: VideoMetadata[]; errors: Map<string, string> }> {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${ids.join(",")}&key=${cfg.apiKey}`;
  const errors = new Map<string, string>();
  let lastError: string | null = null;

  for (let attempt = 0; attempt < cfg.retry.maxAttempts; attempt++) {
    if (attempt > 0) {
      // Charge retry quota
      const chargeResult = (await ctx.runMutation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        internal.quota.chargeRetryUnits as any,
        { dailyQuotaUnits: cfg.dailyQuotaUnits, units: 1 },
      )) as { ok: boolean };

      if (!chargeResult.ok) {
        lastError = "Quota exhausted during retry";
        break;
      }

      const backoff = Math.min(
        cfg.retry.initialBackoffMs * cfg.retry.multiplier ** (attempt - 1),
        cfg.retry.maxBackoffMs,
      );
      await sleep(backoff);
    }

    try {
      const res = await fetch(url);

      if (!res.ok) {
        if (isTransientError(res.status)) {
          lastError = `HTTP ${res.status}`;
          continue;
        }
        // Non-transient HTTP error, don't retry
        for (const id of ids) {
          errors.set(id, `HTTP ${res.status}`);
        }
        return { fetched: [], errors };
      }

      const data = await res.json();
      const items = data.items ?? [];

      const fetched: VideoMetadata[] = items.map(
        (item: {
          id: string;
          snippet: {
            title: string;
            channelTitle: string;
            channelId: string;
            publishedAt: string;
            description: string;
            thumbnails: { high?: { url: string }; default?: { url: string } };
          };
          statistics: { viewCount?: string; likeCount?: string };
          contentDetails: { duration: string };
        }) => ({
          videoId: item.id,
          title: item.snippet.title,
          channel: item.snippet.channelTitle,
          channelId: item.snippet.channelId,
          publishedAt: item.snippet.publishedAt,
          description: item.snippet.description,
          viewCount: item.statistics.viewCount,
          likeCount: item.statistics.likeCount,
          duration: item.contentDetails.duration,
          thumbnails:
            item.snippet.thumbnails.high?.url ??
            item.snippet.thumbnails.default?.url ??
            "",
        }),
      );

      // IDs not returned by YouTube are private/deleted/invalid
      const returnedIds = new Set(fetched.map((v) => v.videoId));
      for (const id of ids) {
        if (!returnedIds.has(id)) {
          errors.set(id, "Video not found or is private.");
        }
      }

      return { fetched, errors };
    } catch (e) {
      lastError = `Network error: ${e}`;
      continue;
    }
  }

  // All retries exhausted
  for (const id of ids) {
    if (!errors.has(id)) {
      errors.set(id, lastError ?? "Fetch failed after retries");
    }
  }
  return { fetched: [], errors };
}

export const fetchVideoMetadataBatch = action({
  args: {
    videoIds: v.array(v.string()),
    config: configValidator,
  },
  returns: v.object({
    items: v.array(resultItemValidator),
  }),
  handler: async (ctx, { videoIds, config }) => {
    const cfg = resolveConfig(config);

    // Deduplicate while preserving order
    const uniqueIds = [...new Set(videoIds)];

    // 1. Check cache
    const cacheResults = (await ctx.runQuery(
      internal.video.getCachedVideosByIds,
      { videoIds: uniqueIds },
    )) as {
      videoId: string;
      cached: boolean;
      fresh: boolean;
      data: VideoMetadata | null;
    }[];

    const resultMap = new Map<string, ResultItem>();
    const staleOrMissingIds: string[] = [];

    for (const entry of cacheResults) {
      if (entry.fresh && entry.data) {
        resultMap.set(entry.videoId, {
          videoId: entry.videoId,
          ok: true,
          source: "cache",
          data: entry.data,
        });
      } else {
        staleOrMissingIds.push(entry.videoId);
      }
    }

    const cacheHits = uniqueIds.length - staleOrMissingIds.length;
    const cacheMisses = staleOrMissingIds.length;

    // 2. If all fresh, record stats and return
    if (staleOrMissingIds.length === 0) {
      await ctx.runMutation(internal.quota.bumpStats, {
        cacheHits,
        cacheMisses: 0,
      });
      return {
        items: videoIds.map((id) => resultMap.get(id)!),
      };
    }

    // 3. Acquire reservation with timeout
    const unitsNeeded = Math.ceil(staleOrMissingIds.length / 50);
    const reservationKey = crypto.randomUUID();
    const deadline = Date.now() + cfg.reservationTimeoutMs;

    let reservationId: Id<"reservations"> | null = null;
    let waitMs = 200;

    while (Date.now() < deadline) {
      const result = (await ctx.runMutation(
        internal.quota.acquireReservation,
        {
          reservationKey,
          videoIds: staleOrMissingIds,
          unitsReserved: unitsNeeded,
          dailyQuotaUnits: cfg.dailyQuotaUnits,
          maxConcurrentReservations: cfg.maxConcurrentReservations,
          leaseMs: cfg.reservationLeaseMs,
        },
      )) as { ok: boolean; reservationId?: Id<"reservations">; reason?: string };

      if (result.ok && result.reservationId) {
        reservationId = result.reservationId;
        break;
      }

      await sleep(Math.min(waitMs, deadline - Date.now()));
      waitMs = Math.min(waitMs * 1.5, 2000);
    }

    if (reservationId === null) {
      // Timeout: return cached (possibly stale) data or errors
      await ctx.runMutation(internal.quota.bumpStats, {
        cacheHits,
        cacheMisses,
      });

      for (const id of staleOrMissingIds) {
        const cached = cacheResults.find((c) => c.videoId === id);
        if (cached?.data) {
          resultMap.set(id, {
            videoId: id,
            ok: true,
            source: "cache",
            data: cached.data,
          });
        } else {
          resultMap.set(id, {
            videoId: id,
            ok: false,
            error: "Reservation timeout: rate limit capacity reached",
          });
        }
      }
      return { items: videoIds.map((id) => resultMap.get(id)!) };
    }

    try {
      // 4. Re-check cache (another action may have refreshed these)
      const recheckResults = (await ctx.runQuery(
        internal.video.getCachedVideosByIds,
        { videoIds: staleOrMissingIds },
      )) as {
        videoId: string;
        cached: boolean;
        fresh: boolean;
        data: VideoMetadata | null;
      }[];

      const stillNeededIds: string[] = [];
      for (const entry of recheckResults) {
        if (entry.fresh && entry.data) {
          resultMap.set(entry.videoId, {
            videoId: entry.videoId,
            ok: true,
            source: "cache",
            data: entry.data,
          });
        } else {
          stillNeededIds.push(entry.videoId);
        }
      }

      if (stillNeededIds.length === 0) {
        await ctx.runMutation(internal.quota.bumpStats, {
          cacheHits: cacheHits + staleOrMissingIds.length,
          cacheMisses: 0,
        });
        return { items: videoIds.map((id) => resultMap.get(id)!) };
      }

      // 5. Charge the reservation
      const chargeResult = (await ctx.runMutation(
        internal.quota.chargeReservation,
        { reservationId },
      )) as { ok: boolean; unitsCharged: number };

      if (!chargeResult.ok) {
        for (const id of stillNeededIds) {
          resultMap.set(id, {
            videoId: id,
            ok: false,
            error: "Failed to charge quota reservation",
          });
        }
        await ctx.runMutation(internal.quota.bumpStats, {
          cacheHits,
          cacheMisses,
        });
        return { items: videoIds.map((id) => resultMap.get(id)!) };
      }

      // 6. Fetch from YouTube in chunks of 50
      const allFetched: VideoMetadata[] = [];
      const allErrors = new Map<string, string>();
      let apiCalls = 0;

      for (let i = 0; i < stillNeededIds.length; i += 50) {
        const chunk = stillNeededIds.slice(i, i + 50);
        apiCalls++;
        const { fetched, errors } = await fetchChunkWithRetry(
          ctx as unknown as {
            runMutation: (...args: unknown[]) => Promise<unknown>;
          },
          chunk,
          cfg,
        );
        allFetched.push(...fetched);
        for (const [k, v] of errors) {
          allErrors.set(k, v);
        }
      }

      // 7. Store fetched videos
      if (allFetched.length > 0) {
        await ctx.runMutation(internal.video.upsertVideos, {
          videos: allFetched,
          ttlMs: cfg.ttlMs,
        });
      }

      // 8. Build results for fetched + errored IDs
      for (const video of allFetched) {
        resultMap.set(video.videoId, {
          videoId: video.videoId,
          ok: true,
          source: "youtube",
          data: video,
        });
      }
      for (const [id, error] of allErrors) {
        resultMap.set(id, { videoId: id, ok: false, error });
      }

      // 9. Record stats
      await ctx.runMutation(internal.quota.bumpStats, {
        cacheHits,
        cacheMisses,
        youtubeApiCalls: apiCalls,
      });
    } finally {
      // Always release reservation
      await ctx.runMutation(internal.quota.releaseReservation, {
        reservationId,
      });
    }

    return { items: videoIds.map((id) => resultMap.get(id)!) };
  },
});

export const fetchVideoMetadata = action({
  args: {
    videoId: v.string(),
    config: configValidator,
  },
  returns: resultItemValidator,
  handler: async (ctx, { videoId, config }) => {
    const result = (await ctx.runAction(
      api.lib.fetchVideoMetadataBatch,
      { videoIds: [videoId], config },
    )) as { items: ResultItem[] };
    return result.items[0];
  },
});

export const getCacheStats = query({
  args: {},
  returns: v.object({
    cacheHits: v.number(),
    cacheMisses: v.number(),
    hitRate: v.number(),
    quota: v.object({
      dayKey: v.string(),
      quotaLimit: v.number(),
      unitsUsed: v.number(),
      remaining: v.number(),
    }),
    activeReservations: v.number(),
  }),
  handler: async (ctx) => {
    const dayKey = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Los_Angeles",
    });

    const stats = await ctx.db
      .query("cacheStats")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .first();

    const cacheHits = stats?.cacheHits ?? 0;
    const cacheMisses = stats?.cacheMisses ?? 0;
    const total = cacheHits + cacheMisses;
    const hitRate = total > 0 ? cacheHits / total : 0;

    const quotaDay = await ctx.db
      .query("quotaDays")
      .withIndex("by_dayKey", (q) => q.eq("dayKey", dayKey))
      .first();

    const quotaLimit = quotaDay?.quotaLimit ?? 10000;
    const unitsUsed = quotaDay?.unitsUsed ?? 0;

    const nowMs = Date.now();
    const allReservations = await ctx.db.query("reservations").collect();
    const activeReservations = allReservations.filter(
      (r) => Number(r.expiresAtMs) > nowMs,
    ).length;

    return {
      cacheHits,
      cacheMisses,
      hitRate,
      quota: {
        dayKey,
        quotaLimit,
        unitsUsed,
        remaining: Math.max(0, quotaLimit - unitsUsed),
      },
      activeReservations,
    };
  },
});
