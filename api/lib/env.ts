import "dotenv/config";

export const env = {
  isProduction: process.env.NODE_ENV === "production",
  jwtSecret: process.env.JWT_SECRET || "default_local_secret_key_123",
  googleSheetId: process.env.GOOGLE_SHEET_ID || "",
  googleServiceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "",
};