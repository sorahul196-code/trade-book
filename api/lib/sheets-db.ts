import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { env } from "./env.js";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
];

let docPromise: Promise<GoogleSpreadsheet> | null = null;
let serviceAccount: any = null;

function getServiceAccount() {
  if (serviceAccount) return serviceAccount;
  
  if (!env.googleServiceAccountJson) {
     throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON in Vercel.");
  }

  let parsed = null;

  try {
    // Try Base64 first
    const decoded = Buffer.from(env.googleServiceAccountJson, "base64").toString("utf-8");
    if (decoded.trim().startsWith("{")) {
        parsed = JSON.parse(decoded);
    }
  } catch (e) {
    // Fall through to plain JSON
  }

  if (!parsed) {
    try {
      parsed = JSON.parse(env.googleServiceAccountJson);
    } catch (e) {
      throw new Error("Failed to parse JSON. Check your Vercel settings.");
    }
  }

  // 🔥 THE CRITICAL FIX: Repair the mangled private key from Vercel
  if (parsed && parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }

  serviceAccount = parsed;
  return serviceAccount;
}

async function getDoc(): Promise<GoogleSpreadsheet> {
  const sa = getServiceAccount();
  const jwt = new JWT({
    email: sa.client_email,
    key: sa.private_key,
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