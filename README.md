# Trade Diary - Portfolio Management

A comprehensive, production-ready trade diary and portfolio management web application built with React, TypeScript, Hono, tRPC, and Google Sheets as the database. Features secure authentication, trade logging with automatic P&L calculation, and a read-only social sharing system.

## Additional High-Value Features (Recommended)

### 1. Trade Tagging & Strategy Filtering
Add a "strategy" or "tags" field to trades (e.g., "Breakout", "Mean Reversion", "Swing", "Scalp"). The dashboard analytics can then be filtered by strategy, showing win-rate and P&L per strategy. This helps traders identify which setups work best for them.

### 2. Trade Psychology & Mood Journal
Track emotional state before/during/after trades (confidence level, stress, FOMO). Include a post-trade reflection field. Over time, this reveals psychological patterns that affect performance — often more valuable than the P&L itself.

### 3. Risk Management Dashboard with R-Multiples
Calculate risk per trade in R-multiples (reward/risk ratio). Track maximum drawdown, consecutive losses, and expectancy = (Win% * Avg Win) - (Loss% * Avg Loss). This transforms the app from a simple diary into a professional risk analytics tool.

### 4. Watchlist with Price Alerts
Add a pre-trade watchlist where users can set target entry prices, stop losses, and take-profit levels. Integrate with free market data APIs (like Yahoo Finance) to show current prices and trigger alerts when conditions are met.

---

## Google Sheets Structure

Your Google Sheet needs **exactly 3 tabs** with these column headers:

### Tab 1: `Users`
| Column | Description |
|--------|-------------|
| `id` | UUID generated on signup |
| `email` | User's email (unique) |
| `passwordHash` | bcrypt-hashed password |
| `name` | User's display name |
| `shareToken` | Unique hex token for read-only sharing |
| `createdAt` | ISO timestamp |

### Tab 2: `Trades`
| Column | Description |
|--------|-------------|
| `id` | UUID for the trade |
| `userId` | Reference to Users.id |
| `type` | Buy, Sell, Short, or Cover |
| `ticker` | Stock symbol (e.g., RELIANCE) |
| `quantity` | Number of shares |
| `price` | Execution price in INR |
| `date` | ISO datetime of execution |
| `notes` | Trade logic / journal notes |
| `createdAt` | ISO timestamp |

### Tab 3: `Friends`
| Column | Description |
|--------|-------------|
| `id` | UUID for the link |
| `ownerUserId` | The friend being viewed |
| `viewerUserId` | The current user who added the friend |
| `shareToken` | The share token used to add |
| `createdAt` | ISO timestamp |

> **Note:** The backend auto-creates these tabs with correct headers on first API call if they don't exist.

---

## Setup Instructions

### 1. Google Cloud Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → Enable the **Google Sheets API** and **Google Drive API**
3. Go to **IAM & Admin > Service Accounts**
4. Create a service account with **Editor** role
5. Generate a JSON key and download it
6. Base64-encode the JSON file:
   ```bash
   cat service-account-key.json | base64 -w 0
   ```

### 2. Create the Google Sheet

1. Create a new Google Sheet (can be empty)
2. Copy the Sheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit
   ```
3. **Share the sheet** with the service account email (e.g., `your-sa@project.iam.gserviceaccount.com`) with **Editor** permissions

### 3. Environment Variables

Set these in your `.env` file or Vercel dashboard:

```env
JWT_SECRET=your-random-secret-string-min-32-chars
GOOGLE_SHEET_ID=your-google-sheet-id
GOOGLE_SERVICE_ACCOUNT_JSON=base64-encoded-service-account-json
```

### 4. Deploy to Vercel

1. Push code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add the environment variables above
4. Deploy

The included `vercel.json` handles SPA routing — page refreshes on `/dashboard` or `/friend/xxx` will correctly serve `index.html`.

---

## Architecture Overview

```
Frontend (Vite + React + Tailwind + shadcn/ui)
  ├── tRPC Client (type-safe API calls)
  ├── Auth Hook (JWT via httpOnly cookie)
  ├── Theme Provider (dark mode by default)
  └── Pages: Login, Dashboard, TradeForm, FriendView

Backend (Hono + tRPC)
  ├── Auth Router (register, login, me, logout)
  ├── Trade Router (CRUD + P&L stats)
  ├── Friend Router (read-only view, add friend)
  └── Google Sheets DB Layer (sheets-db.ts + sheets-queries.ts)

Database (Google Sheets)
  ├── Users Sheet
  ├── Trades Sheet
  └── Friends Sheet
```

### Key Files

| File | Purpose |
|------|---------|
| `api/lib/sheets-db.ts` | Google Spreadsheet connection singleton |
| `api/lib/sheets-queries.ts` | Typed CRUD operations for Users, Trades, Friends |
| `api/routers/auth.ts` | JWT authentication with bcrypt |
| `api/routers/trade.ts` | Trade management + FIFO P&L calculation |
| `api/routers/friend.ts` | Read-only sharing + friend links |
| `src/pages/Dashboard.tsx` | Main dashboard with stats, trades, friends |
| `src/pages/FriendView.tsx` | Read-only portfolio view |

### P&L Calculation Logic

The app uses **FIFO (First In, First Out)** matching for P&L:

- **Buy** trades add to a FIFO queue and increase long position
- **Sell** trades match against the oldest buys in the queue
- **Short** trades add to a short FIFO queue
- **Cover** trades match against the oldest shorts
- Realized P&L = matched quantity × (sell price − buy price)

Open positions show net quantity, average cost basis, and cumulative realized P&L per ticker.

### Security

- Passwords hashed with bcrypt (10 rounds)
- JWT tokens signed with HS256, 30-day expiry, httpOnly cookies
- Friend views are strictly read-only via separate tRPC router
- No cross-user data leakage — all trade queries include `userId` filter
- Share tokens are cryptographically random 32-byte hex strings

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui, tRPC Client, React Query
- **Backend:** Hono, tRPC 11, Zod validation, jose (JWT), bcryptjs
- **Database:** Google Sheets via `google-spreadsheet`
- **Deployment:** Vercel (SPA routing configured)

## License

MIT
