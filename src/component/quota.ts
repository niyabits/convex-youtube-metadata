import { internalMutation, internalQuery } from "./_generated/server.js";
import { v } from "convex/values";

function getDayKey(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles",
  });
}

export const acquireReservation = internalMutation({
  args: {
    reservationKey: v.string(),
    videoIds: v.array(v.string()),
    unitsReserved: v.number(),
    dailyQuotaUnits: v.number(),
    maxConcurrentReservations: v.number(),
    leaseMs: v.number(),
  },
  returns: v.object({
    ok: v.boolean(),
    reservationId: v.optional(v.id("reservations")),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const nowMs = Date.now();
    const dayKey = getDayKey();

    // Clean up expired reservations
    const allReservations = await ctx.db.query("reservations").collect();
    for (const res of allReservations) {
      if (Number(res.expiresAtMs) < nowMs) {
        await ctx.db.delete(res._id);
      }
    }

    // Count active reservations
    const activeReservations = await ctx.db.query("reservations").collect();
    if (activeReservations.length >= args.maxConcurrentReservations) {
      return { ok: false, reason: "slots" };
    }

    // Check quota
    let quotaDay = await ctx.db
      .query("quotaDays")
      .withIndex("by_dayKey", (q) => q.eq("dayKey", dayKey))
      .first();

    if (quotaDay === null) {
      const id = await ctx.db.insert("quotaDays", {
        dayKey,
        quotaLimit: args.dailyQuotaUnits,
        unitsUsed: 0,
        updatedAtMs: BigInt(nowMs),
      });
      quotaDay = (await ctx.db.get(id))!;
    }

    // Sum held (uncharged) reservation units
    const heldUnits = activeReservations
      .filter((r) => r.status === "held")
      .reduce((sum, r) => sum + r.unitsReserved, 0);

    const totalProjected =
      quotaDay.unitsUsed + heldUnits + args.unitsReserved;

    if (totalProjected > args.dailyQuotaUnits) {
      return { ok: false, reason: "quota" };
    }

    // Create reservation
    const reservationId = await ctx.db.insert("reservations", {
      reservationKey: args.reservationKey,
      videoIds: args.videoIds,
      unitsReserved: args.unitsReserved,
      status: "held",
      createdAtMs: BigInt(nowMs),
      expiresAtMs: BigInt(nowMs + args.leaseMs),
    });

    return { ok: true, reservationId };
  },
});

export const chargeReservation = internalMutation({
  args: { reservationId: v.id("reservations") },
  returns: v.object({ ok: v.boolean(), unitsCharged: v.number() }),
  handler: async (ctx, { reservationId }) => {
    const reservation = await ctx.db.get(reservationId);
    if (reservation === null) {
      return { ok: false, unitsCharged: 0 };
    }

    if (reservation.status === "charged") {
      return { ok: true, unitsCharged: 0 };
    }

    const dayKey = getDayKey();
    const nowMs = Date.now();

    let quotaDay = await ctx.db
      .query("quotaDays")
      .withIndex("by_dayKey", (q) => q.eq("dayKey", dayKey))
      .first();

    if (quotaDay === null) {
      const id = await ctx.db.insert("quotaDays", {
        dayKey,
        quotaLimit: 10000,
        unitsUsed: 0,
        updatedAtMs: BigInt(nowMs),
      });
      quotaDay = (await ctx.db.get(id))!;
    }

    await ctx.db.patch(quotaDay._id, {
      unitsUsed: quotaDay.unitsUsed + reservation.unitsReserved,
      updatedAtMs: BigInt(nowMs),
    });

    await ctx.db.patch(reservationId, { status: "charged" as const });

    return { ok: true, unitsCharged: reservation.unitsReserved };
  },
});

export const chargeRetryUnits = internalMutation({
  args: {
    dailyQuotaUnits: v.number(),
    units: v.number(),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, { dailyQuotaUnits, units }) => {
    const dayKey = getDayKey();
    const nowMs = Date.now();

    let quotaDay = await ctx.db
      .query("quotaDays")
      .withIndex("by_dayKey", (q) => q.eq("dayKey", dayKey))
      .first();

    if (quotaDay === null) {
      const id = await ctx.db.insert("quotaDays", {
        dayKey,
        quotaLimit: dailyQuotaUnits,
        unitsUsed: 0,
        updatedAtMs: BigInt(nowMs),
      });
      quotaDay = (await ctx.db.get(id))!;
    }

    if (quotaDay.unitsUsed + units > dailyQuotaUnits) {
      return { ok: false };
    }

    await ctx.db.patch(quotaDay._id, {
      unitsUsed: quotaDay.unitsUsed + units,
      updatedAtMs: BigInt(nowMs),
    });

    return { ok: true };
  },
});

export const releaseReservation = internalMutation({
  args: { reservationId: v.id("reservations") },
  returns: v.null(),
  handler: async (ctx, { reservationId }) => {
    const reservation = await ctx.db.get(reservationId);
    if (reservation !== null) {
      await ctx.db.delete(reservationId);
    }
  },
});

export const bumpStats = internalMutation({
  args: {
    cacheHits: v.optional(v.number()),
    cacheMisses: v.optional(v.number()),
    youtubeApiCalls: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const nowMs = Date.now();
    let stats = await ctx.db
      .query("cacheStats")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .first();

    if (stats === null) {
      await ctx.db.insert("cacheStats", {
        key: "global",
        cacheHits: args.cacheHits ?? 0,
        cacheMisses: args.cacheMisses ?? 0,
        youtubeApiCalls: args.youtubeApiCalls ?? 0,
        updatedAtMs: BigInt(nowMs),
      });
      return;
    }

    await ctx.db.patch(stats._id, {
      cacheHits: stats.cacheHits + (args.cacheHits ?? 0),
      cacheMisses: stats.cacheMisses + (args.cacheMisses ?? 0),
      youtubeApiCalls: stats.youtubeApiCalls + (args.youtubeApiCalls ?? 0),
      updatedAtMs: BigInt(nowMs),
    });
  },
});

export const getStats = internalQuery({
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
    const dayKey = getDayKey();

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
