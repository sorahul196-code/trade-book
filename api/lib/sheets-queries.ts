import {
  getSpreadsheet,
  ensureHeaders,
  SHEET_USERS,
  SHEET_TRADES,
  SHEET_FRIENDS,
  SHEET_JOURNAL,
} from "./sheets-db";
import type { GoogleSpreadsheetRow } from "google-spreadsheet";

// ─── Types ───────────────────────────────────────────────────────────────────

export type UserRow = {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  shareToken: string;
  createdAt: string;
};

export type TradeRow = {
  id: string;
  userId: string;
  type: "Buy" | "Sell" | "Short" | "Cover";
  ticker: string;
  quantity: string;
  price: string;
  date: string;
  notes: string;
  createdAt: string;
};

export type FriendRow = {
  id: string;
  ownerUserId: string;
  viewerUserId: string;
  shareToken: string;
  createdAt: string;
};

/**
 * JournalRow — one row per trading day.
 * Arrays (mistakes) are stored as comma-separated strings in a single cell.
 */
export type JournalRow = {
  id: string;
  userId: string;
  /** ISO date string – date portion only used as key (YYYY-MM-DD) */
  date: string;
  marketSentiment: "Bullish" | "Bearish" | "Volatile" | "Sideways" | "";
  /** 1-10 */
  mentalState: string;
  /** 1-10 */
  energyLevel: string;
  /** Comma-separated list of mistake keys */
  mistakes: string;
  /** Free-form observation text */
  observations: string;
  /** Starting balance for the day */
  startingBalance: string;
  /** Closing balance for the day */
  closingBalance: string;
  /** Total brokerage paid for the day */
  totalBrokerage: string;
  createdAt: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rowToObject<T extends Record<string, string>>(row: GoogleSpreadsheetRow<T>): T {
  const obj: any = {};
  for (const key of Object.keys(row.toObject())) {
    obj[key] = row.get(key) ?? "";
  }
  return obj as T;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function getUsersSheet() {
  const doc = await getSpreadsheet();
  return ensureHeaders(doc, SHEET_USERS, [
    "id",
    "email",
    "passwordHash",
    "name",
    "shareToken",
    "createdAt",
  ]);
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const sheet = await getUsersSheet();
  const rows = await sheet.getRows<UserRow>();
  const row = rows.find((r) => r.get("email")?.toLowerCase() === email.toLowerCase());
  return row ? rowToObject(row) : null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const sheet = await getUsersSheet();
  const rows = await sheet.getRows<UserRow>();
  const row = rows.find((r) => r.get("id") === id);
  return row ? rowToObject(row) : null;
}

export async function findUserByShareToken(token: string): Promise<UserRow | null> {
  const sheet = await getUsersSheet();
  const rows = await sheet.getRows<UserRow>();
  const row = rows.find((r) => r.get("shareToken") === token);
  return row ? rowToObject(row) : null;
}

export async function createUser(
  data: Omit<UserRow, "id" | "createdAt"> & { id: string; createdAt: string }
) {
  const sheet = await getUsersSheet();
  await sheet.addRow(data as any);
  return data;
}

// ─── Trades ──────────────────────────────────────────────────────────────────

export async function getTradesSheet() {
  const doc = await getSpreadsheet();
  return ensureHeaders(doc, SHEET_TRADES, [
    "id",
    "userId",
    "type",
    "ticker",
    "quantity",
    "price",
    "date",
    "notes",
    "createdAt",
  ]);
}

export async function findTradesByUserId(userId: string): Promise<TradeRow[]> {
  const sheet = await getTradesSheet();
  const rows = await sheet.getRows<TradeRow>();
  return rows
    .filter((r) => r.get("userId") === userId)
    .map((r) => rowToObject(r))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function findTradeById(id: string): Promise<TradeRow | null> {
  const sheet = await getTradesSheet();
  const rows = await sheet.getRows<TradeRow>();
  const row = rows.find((r) => r.get("id") === id);
  return row ? rowToObject(row) : null;
}

export async function createTrade(data: TradeRow) {
  const sheet = await getTradesSheet();
  await sheet.addRow(data as any);
  return data;
}

export async function updateTrade(
  id: string,
  data: Partial<Omit<TradeRow, "id" | "userId" | "createdAt">>
) {
  const sheet = await getTradesSheet();
  const rows = await sheet.getRows<TradeRow>();
  const row = rows.find((r) => r.get("id") === id);
  if (!row) return null;
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) row.set(key as keyof TradeRow, String(value));
  }
  await row.save();
  return rowToObject(row);
}

export async function deleteTrade(id: string) {
  const sheet = await getTradesSheet();
  const rows = await sheet.getRows<TradeRow>();
  const row = rows.find((r) => r.get("id") === id);
  if (!row) return false;
  await row.delete();
  return true;
}

// ─── Friends ─────────────────────────────────────────────────────────────────

export async function getFriendsSheet() {
  const doc = await getSpreadsheet();
  return ensureHeaders(doc, SHEET_FRIENDS, [
    "id",
    "ownerUserId",
    "viewerUserId",
    "shareToken",
    "createdAt",
  ]);
}

export async function findFriendLinksByViewer(viewerUserId: string): Promise<FriendRow[]> {
  const sheet = await getFriendsSheet();
  const rows = await sheet.getRows<FriendRow>();
  return rows
    .filter((r) => r.get("viewerUserId") === viewerUserId)
    .map((r) => rowToObject(r));
}

export async function createFriendLink(data: FriendRow) {
  const sheet = await getFriendsSheet();
  await sheet.addRow(data as any);
  return data;
}

export async function deleteFriendLink(id: string) {
  const sheet = await getFriendsSheet();
  const rows = await sheet.getRows<FriendRow>();
  const row = rows.find((r) => r.get("id") === id);
  if (!row) return false;
  await row.delete();
  return true;
}

// ─── Journal ─────────────────────────────────────────────────────────────────

export async function getJournalSheet() {
  const doc = await getSpreadsheet();
  return ensureHeaders(doc, SHEET_JOURNAL, [
    "id",
    "userId",
    "date",
    "marketSentiment",
    "mentalState",
    "energyLevel",
    "mistakes",
    "observations",
    "startingBalance",
    "closingBalance",
    "totalBrokerage",
    "createdAt",
  ]);
}

export async function findJournalByUserId(userId: string): Promise<JournalRow[]> {
  const sheet = await getJournalSheet();
  const rows = await sheet.getRows<JournalRow>();
  return rows
    .filter((r) => r.get("userId") === userId)
    .map((r) => rowToObject(r));
}

export async function findJournalEntryByDate(
  userId: string,
  dateKey: string // YYYY-MM-DD
): Promise<JournalRow | null> {
  const sheet = await getJournalSheet();
  const rows = await sheet.getRows<JournalRow>();
  const row = rows.find(
    (r) => r.get("userId") === userId && r.get("date").slice(0, 10) === dateKey
  );
  return row ? rowToObject(row) : null;
}

export async function upsertJournalEntry(data: JournalRow): Promise<JournalRow> {
  const sheet = await getJournalSheet();
  const rows = await sheet.getRows<JournalRow>();
  const existing = rows.find(
    (r) =>
      r.get("userId") === data.userId && r.get("date").slice(0, 10) === data.date.slice(0, 10)
  );
  if (existing) {
    // Update in place
    const updatableKeys: (keyof JournalRow)[] = [
      "marketSentiment",
      "mentalState",
      "energyLevel",
      "mistakes",
      "observations",
      "startingBalance",
      "closingBalance",
      "totalBrokerage",
    ];
    for (const key of updatableKeys) {
      existing.set(key, String(data[key] ?? ""));
    }
    await existing.save();
    return rowToObject(existing);
  } else {
    await sheet.addRow(data as any);
    return data;
  }
}
