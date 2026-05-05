// Google Sheets is used as the database — see api/lib/sheets-db.ts
// This file is kept for compatibility with the backend-building scaffold.

export function getDb() {
  throw new Error("MySQL is not configured. This app uses Google Sheets as the database.");
}
