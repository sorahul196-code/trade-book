import { z } from "zod";
import { createRouter, authedQuery } from "../middleware";
import {
  findTradesByUserId,
  createTrade,
  updateTrade,
  deleteTrade,
  findTradeById,
  findJournalByUserId,
  upsertJournalEntry,
} from "../lib/sheets-queries";
import crypto from "crypto";

// ─── Shared Zod schemas ───────────────────────────────────────────────────────

const MISTAKE_VALUES = [
  "Exceeded Position Size",
  "Emotional Decision",
  "Inadequate Research",
  "Revenge Trade",
  "Overtrading",
  "Poor Timing",
  "FOMO Entry",
  "Ignored SL",
] as const;

const SENTIMENT_VALUES = ["Bullish", "Bearish", "Volatile", "Sideways"] as const;

// ─── FIFO Matched Trade Engine ────────────────────────────────────────────────

/**
 * A single FIFO-matched row representing a (partial or full) closure of a buy lot.
 */
export type MatchedTrade = {
  id: string;           // synthetic unique key
  ticker: string;
  side: "Long" | "Short";
  buyPrice: number;
  buyDate: string;
  sellPrice: number | null;   // null → still open (remaining qty)
  sellDate: string | null;
  soldQty: number;
  remainQty: number;
  pnl: number | null;         // null → open
};

function buildMatchedTrades(trades: Awaited<ReturnType<typeof findTradesByUserId>>): MatchedTrade[] {
  // Work chronologically oldest→newest
  const sorted = [...trades].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // FIFO queues keyed by ticker
  type Lot = { qty: number; price: number; date: string };
  const buyLots: Record<string, Lot[]>   = {};
  const shortLots: Record<string, Lot[]> = {};
  const matched: MatchedTrade[] = [];
  let rowIdx = 0;

  for (const t of sorted) {
    const qty   = Number(t.quantity);
    const price = Number(t.price);
    const ticker = t.ticker;

    if (t.type === "Buy") {
      if (!buyLots[ticker]) buyLots[ticker] = [];
      buyLots[ticker].push({ qty, price, date: t.date });

    } else if (t.type === "Sell") {
      if (!buyLots[ticker]) buyLots[ticker] = [];
      let remaining = qty;

      while (remaining > 0 && buyLots[ticker].length > 0) {
        const lot = buyLots[ticker][0];
        const matched_qty = Math.min(remaining, lot.qty);
        const pnl = matched_qty * (price - lot.price);

        matched.push({
          id: `m-${rowIdx++}`,
          ticker,
          side: "Long",
          buyPrice:  lot.price,
          buyDate:   lot.date,
          sellPrice: price,
          sellDate:  t.date,
          soldQty:   matched_qty,
          remainQty: lot.qty - matched_qty,
          pnl,
        });

        lot.qty    -= matched_qty;
        remaining  -= matched_qty;
        if (lot.qty <= 0) buyLots[ticker].shift();
      }

    } else if (t.type === "Short") {
      if (!shortLots[ticker]) shortLots[ticker] = [];
      shortLots[ticker].push({ qty, price, date: t.date });

    } else if (t.type === "Cover") {
      if (!shortLots[ticker]) shortLots[ticker] = [];
      let remaining = qty;

      while (remaining > 0 && shortLots[ticker].length > 0) {
        const lot = shortLots[ticker][0];
        const matched_qty = Math.min(remaining, lot.qty);
        const pnl = matched_qty * (lot.price - price);

        matched.push({
          id: `m-${rowIdx++}`,
          ticker,
          side: "Short",
          buyPrice:  lot.price,
          buyDate:   lot.date,
          sellPrice: price,
          sellDate:  t.date,
          soldQty:   matched_qty,
          remainQty: lot.qty - matched_qty,
          pnl,
        });

        lot.qty   -= matched_qty;
        remaining -= matched_qty;
        if (lot.qty <= 0) shortLots[ticker].shift();
      }
    }
  }

  // Append all still-open lots as unmatched rows (remainQty > 0, no sell)
  for (const [ticker, lots] of Object.entries(buyLots)) {
    for (const lot of lots) {
      if (lot.qty > 0) {
        matched.push({
          id: `m-${rowIdx++}`,
          ticker,
          side: "Long",
          buyPrice: lot.price,
          buyDate:  lot.date,
          sellPrice: null,
          sellDate:  null,
          soldQty:   0,
          remainQty: lot.qty,
          pnl: null,
        });
      }
    }
  }
  for (const [ticker, lots] of Object.entries(shortLots)) {
    for (const lot of lots) {
      if (lot.qty > 0) {
        matched.push({
          id: `m-${rowIdx++}`,
          ticker,
          side: "Short",
          buyPrice: lot.price,
          buyDate:  lot.date,
          sellPrice: null,
          sellDate:  null,
          soldQty:   0,
          remainQty: lot.qty,
          pnl: null,
        });
      }
    }
  }

  return matched;
}

// ─── Trade Router ─────────────────────────────────────────────────────────────

export const tradeRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    const trades = await findTradesByUserId(ctx.user.id);
    return { trades };
  }),

  create: authedQuery
    .input(
      z.object({
        type: z.enum(["Buy", "Sell", "Short", "Cover"]),
        ticker: z.string().min(1).toUpperCase(),
        quantity: z.coerce.number().positive(),
        price: z.coerce.number().positive(),
        date: z.string().datetime(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const trade = await createTrade({
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        type: input.type,
        ticker: input.ticker,
        quantity: String(input.quantity),
        price: String(input.price),
        date: input.date,
        notes: input.notes ?? "",
        createdAt: new Date().toISOString(),
      });
      return { trade };
    }),

  update: authedQuery
    .input(
      z.object({
        id: z.string().uuid(),
        type: z.enum(["Buy", "Sell", "Short", "Cover"]).optional(),
        ticker: z.string().min(1).toUpperCase().optional(),
        quantity: z.coerce.number().positive().optional(),
        price: z.coerce.number().positive().optional(),
        date: z.string().datetime().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await findTradeById(input.id);
      if (!existing || existing.userId !== ctx.user.id) {
        return { success: false, error: "Trade not found" } as const;
      }
      const updated = await updateTrade(input.id, {
        type: input.type,
        ticker: input.ticker,
        quantity: input.quantity !== undefined ? String(input.quantity) : undefined,
        price: input.price !== undefined ? String(input.price) : undefined,
        date: input.date,
        notes: input.notes,
      });
      return { success: true, trade: updated } as const;
    }),

  delete: authedQuery
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await findTradeById(input.id);
      if (!existing || existing.userId !== ctx.user.id) {
        return { success: false, error: "Trade not found" } as const;
      }
      await deleteTrade(input.id);
      return { success: true } as const;
    }),

  /**
   * stats – returns:
   *  - matchedTrades (FIFO book rows)
   *  - openPositions (aggregate summary for stats bar)
   *  - closedPositions (historical closed tickers)
   *  - totalRealizedPnL
   *  - totalTrades
   */
  stats: authedQuery.query(async ({ ctx }) => {
    const trades = await findTradesByUserId(ctx.user.id);
    const matchedTrades = buildMatchedTrades(trades);

    // Derive aggregate open/closed positions from matchedTrades
    const positionMap: Record<string, { realizedPnL: number; openQty: number }> = {};
    for (const m of matchedTrades) {
      if (!positionMap[m.ticker]) positionMap[m.ticker] = { realizedPnL: 0, openQty: 0 };
      if (m.pnl !== null) positionMap[m.ticker].realizedPnL += m.pnl;
      positionMap[m.ticker].openQty += m.remainQty;
    }

    const openPositions = Object.entries(positionMap)
      .filter(([_, p]) => p.openQty > 0)
      .map(([ticker, p]) => ({ ticker, openQty: p.openQty, realizedPnL: p.realizedPnL }));

    const closedPositions = Object.entries(positionMap)
      .filter(([_, p]) => p.openQty === 0 && p.realizedPnL !== 0)
      .map(([ticker, p]) => ({ ticker, realizedPnL: p.realizedPnL }));

    const totalRealizedPnL = Object.values(positionMap).reduce(
      (sum, p) => sum + p.realizedPnL,
      0
    );

    return {
      trades,
      matchedTrades,
      openPositions,
      closedPositions,
      totalTrades: trades.length,
      totalRealizedPnL,
    };
  }),
});

// ─── Journal Router ────────────────────────────────────────────────────────────

export const journalRouter = createRouter({
  /** Returns all journal entries for the authenticated user */
  list: authedQuery.query(async ({ ctx }) => {
    const entries = await findJournalByUserId(ctx.user.id);
    return { entries };
  }),

  /** Create or update the journal entry for a given day */
  upsert: authedQuery
    .input(
      z.object({
        date: z.string(), // YYYY-MM-DD
        marketSentiment: z.enum(SENTIMENT_VALUES).or(z.literal("")).optional(),
        mentalState: z.coerce.number().min(1).max(10).optional(),
        energyLevel: z.coerce.number().min(1).max(10).optional(),
        mistakes: z.array(z.enum(MISTAKE_VALUES)).optional(),
        observations: z.string().optional(),
        startingBalance: z.coerce.number().optional(),
        closingBalance: z.coerce.number().optional(),
        totalBrokerage: z.coerce.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const entry = await upsertJournalEntry({
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        date: input.date,
        marketSentiment: input.marketSentiment ?? "",
        mentalState: input.mentalState !== undefined ? String(input.mentalState) : "",
        energyLevel: input.energyLevel !== undefined ? String(input.energyLevel) : "",
        // Store mistake array as comma-separated string
        mistakes: (input.mistakes ?? []).join(","),
        observations: input.observations ?? "",
        startingBalance: input.startingBalance !== undefined ? String(input.startingBalance) : "",
        closingBalance: input.closingBalance !== undefined ? String(input.closingBalance) : "",
        totalBrokerage: input.totalBrokerage !== undefined ? String(input.totalBrokerage) : "",
        createdAt: new Date().toISOString(),
      });
      return { entry };
    }),
});
