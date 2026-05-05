import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { env } from "./env";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
];

let docPromise: Promise<GoogleSpreadsheet> | null = null;
let serviceAccount: any = null;

// This function safely checks your keys ONLY when you click a button
function getServiceAccount() {
  if (serviceAccount) return serviceAccount;
  
  if (!env.googleServiceAccountJson) {
     throw new Error("CRITICAL: GOOGLE_SERVICE_ACCOUNT_JSON is totally missing in Vercel settings.");
  }

  try {
    // 1. Try decoding as Base64 first
    const json = Buffer.from(env.googleServiceAccountJson, "base64").toString("utf-8");
    if (json.trim().startsWith("{")) {
        serviceAccount = JSON.parse(json);
        return serviceAccount;
    }
  } catch (e) {
    // Ignore base64 error and fall through to plain JSON check
  }

  try {
    // 2. Fallback to plain JSON string
    serviceAccount = JSON.parse(env.googleServiceAccountJson);
  } catch (e) {
     throw new Error("CRITICAL: Vercel failed to parse your GOOGLE_SERVICE_ACCOUNT_JSON. Make sure it is valid JSON and you didn't accidentally include quotation marks around the whole thing in your Vercel settings.");
  }

  return serviceAccount;
}

async function getDoc(): Promise<GoogleSpreadsheet> {
  const sa = getServiceAccount();
  if (!sa.client_email || !sa.private_key) {
      throw new Error("CRITICAL: Invalid Service Account. Your JSON is missing the 'client_email' or 'private_key' properties.");
  }

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