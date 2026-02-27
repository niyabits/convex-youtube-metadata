/// <reference types="vite/client" />

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api.js";
import { initConvexTest } from "./setup.test.js";

describe("component: video caching", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("getCachedVideosByIds returns empty for unknown IDs", async () => {
    const t = initConvexTest();
    const result = await t.query(internal.video.getCachedVideosByIds, {
      videoIds: ["nonexistent"],
    });
    expect(result).toHaveLength(1);
    expect(result[0].cached).toBe(false);
    expect(result[0].fresh).toBe(false);
    expect(result[0].data).toBeNull();
  });

  test("upsertVideos stores and getCachedVideosByIds retrieves them", async () => {
    const t = initConvexTest();
    const videos = [
      {
        videoId: "test123",
        title: "Test Video",
        channel: "Test Channel",
        channelId: "UC123",
        publishedAt: "2024-01-01T00:00:00Z",
        description: "A test video",
        viewCount: "100",
        likeCount: "10",
        duration: "PT5M",
        thumbnails: "https://example.com/thumb.jpg",
      },
    ];

    await t.mutation(internal.video.upsertVideos, {
      videos,
      ttlMs: 3_600_000,
    });

    const result = await t.query(internal.video.getCachedVideosByIds, {
      videoIds: ["test123"],
    });

    expect(result).toHaveLength(1);
    expect(result[0].cached).toBe(true);
    expect(result[0].fresh).toBe(true);
    expect(result[0].data?.title).toBe("Test Video");
    expect(result[0].data?.channelId).toBe("UC123");
  });

  test("upsertVideos updates existing video", async () => {
    const t = initConvexTest();
    const video = {
      videoId: "test123",
      title: "Original Title",
      channel: "Test Channel",
      channelId: "UC123",
      publishedAt: "2024-01-01T00:00:00Z",
      description: "A test video",
      duration: "PT5M",
      thumbnails: "https://example.com/thumb.jpg",
    };

    await t.mutation(internal.video.upsertVideos, {
      videos: [video],
      ttlMs: 3_600_000,
    });

    await t.mutation(internal.video.upsertVideos, {
      videos: [{ ...video, title: "Updated Title" }],
      ttlMs: 3_600_000,
    });

    const result = await t.query(internal.video.getCachedVideosByIds, {
      videoIds: ["test123"],
    });

    expect(result[0].data?.title).toBe("Updated Title");
  });
});

describe("component: quota and reservations", () => {
  test("acquireReservation succeeds when under limits", async () => {
    const t = initConvexTest();
    const result = await t.mutation(internal.quota.acquireReservation, {
      reservationKey: "test-key",
      videoIds: ["vid1"],
      unitsReserved: 1,
      dailyQuotaUnits: 10000,
      maxConcurrentReservations: 10,
      leaseMs: 30000,
    });
    expect(result.ok).toBe(true);
    expect(result.reservationId).toBeDefined();
  });

  test("acquireReservation rejects when at max concurrent slots", async () => {
    const t = initConvexTest();
    // Fill up all slots
    for (let i = 0; i < 2; i++) {
      await t.mutation(internal.quota.acquireReservation, {
        reservationKey: `key-${i}`,
        videoIds: ["vid1"],
        unitsReserved: 1,
        dailyQuotaUnits: 10000,
        maxConcurrentReservations: 2,
        leaseMs: 30000,
      });
    }
    const result = await t.mutation(internal.quota.acquireReservation, {
      reservationKey: "key-overflow",
      videoIds: ["vid1"],
      unitsReserved: 1,
      dailyQuotaUnits: 10000,
      maxConcurrentReservations: 2,
      leaseMs: 30000,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("slots");
  });

  test("acquireReservation rejects when quota exceeded", async () => {
    const t = initConvexTest();
    const result = await t.mutation(internal.quota.acquireReservation, {
      reservationKey: "key-1",
      videoIds: ["vid1"],
      unitsReserved: 100,
      dailyQuotaUnits: 50,
      maxConcurrentReservations: 10,
      leaseMs: 30000,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("quota");
  });

  test("releaseReservation removes reservation", async () => {
    const t = initConvexTest();
    const acq = await t.mutation(internal.quota.acquireReservation, {
      reservationKey: "key-1",
      videoIds: ["vid1"],
      unitsReserved: 1,
      dailyQuotaUnits: 10000,
      maxConcurrentReservations: 1,
      leaseMs: 30000,
    });
    expect(acq.ok).toBe(true);

    await t.mutation(internal.quota.releaseReservation, {
      reservationId: acq.reservationId!,
    });

    // Should be able to acquire again
    const acq2 = await t.mutation(internal.quota.acquireReservation, {
      reservationKey: "key-2",
      videoIds: ["vid1"],
      unitsReserved: 1,
      dailyQuotaUnits: 10000,
      maxConcurrentReservations: 1,
      leaseMs: 30000,
    });
    expect(acq2.ok).toBe(true);
  });

  test("bumpStats increments cache stats", async () => {
    const t = initConvexTest();

    await t.mutation(internal.quota.bumpStats, {
      cacheHits: 5,
      cacheMisses: 2,
      youtubeApiCalls: 1,
    });

    const stats = await t.query(internal.quota.getStats, {});
    expect(stats.cacheHits).toBe(5);
    expect(stats.cacheMisses).toBe(2);
    expect(stats.hitRate).toBeCloseTo(5 / 7);
  });

  test("chargeReservation charges quota and updates status", async () => {
    const t = initConvexTest();
    const acq = await t.mutation(internal.quota.acquireReservation, {
      reservationKey: "key-1",
      videoIds: ["vid1"],
      unitsReserved: 3,
      dailyQuotaUnits: 10000,
      maxConcurrentReservations: 10,
      leaseMs: 30000,
    });

    const charge = await t.mutation(internal.quota.chargeReservation, {
      reservationId: acq.reservationId!,
    });
    expect(charge.ok).toBe(true);
    expect(charge.unitsCharged).toBe(3);

    const stats = await t.query(internal.quota.getStats, {});
    expect(stats.quota.unitsUsed).toBe(3);
  });
});
