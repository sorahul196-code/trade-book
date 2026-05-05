import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { env } from "./env";

// Decode service account JSON from base64
let serviceAccount: any;
try {
  const json = Buffer.from(env.googleServiceAccountJson, "base64").toString("utf-8");
  serviceAccount = JSON.parse(json);
} catch {
  // Try plain JSON if not base64
  serviceAccount = JSON.parse(env.googleServiceAccountJson);
}

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
];

let docPromise: Promise<GoogleSpreadsheet> | null = null;

async function getDoc(): Promise<GoogleSpreadsheet> {
  const jwt = new JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: SCOPES,
  });
  const doc = new GoogleSpreadsheet(env.googleSheetId, jwt);
  await doc.loadInfo();
  return doc;
}

export async function getSpreadsheet() {
  if (!docPromise) {
    docPromise = getDoc();
  }
  return docPromise;
}

export async function resetSpreadsheetCache() {
  docPromise = null;
}

// Sheet names
export const SHEET_USERS   = "Users";
export const SHEET_TRADES  = "Trades";
export const SHEET_FRIENDS = "Friends";
export const SHEET_JOURNAL = "Journal";

// Ensure headers exist on a sheet
export async function ensureHeaders(
  doc: GoogleSpreadsheet,
  sheetTitle: string,
  headers: string[]
) {
  let sheet = doc.sheetsByTitle[sheetTitle];
  if (!sheet) {
    sheet = await doc.addSheet({ title: sheetTitle, headerValues: headers });
  } else {
    await sheet.loadHeaderRow();
    const existing = sheet.headerValues || [];
    const missing = headers.filter((h) => !existing.includes(h));
    if (missing.length > 0) {
      await sheet.setHeaderRow([...existing, ...missing]);
    }
  }
  return sheet;
}
