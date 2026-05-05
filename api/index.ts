import { handle } from 'hono/vercel';
import app from './app';

// Tell Vercel to leave the data stream alone
export const config = {
  api: {
    bodyParser: false,
  },
};

// Create the standard Hono handler
const honoHandler = handle(app);

// 🔥 THE IMPENETRABLE ROOT WRAPPER 🔥
export default async function(req: any, res: any) {
  try {
    // Attempt to run your app
    const response = await honoHandler(req);
    res.statusCode = response.status;
    for (const [key, value] of response.headers.entries()) {
      res.setHeader(key, value);
    }
    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          res.write(Buffer.from(value));
        }
      }
      res.end();
    } else {
      res.end();
    }
  } catch (err: any) {
    // If Vercel tries to violently crash, we catch it here!
    console.error("FATAL ROOT ERROR:", err);
    
    // Force Vercel to return JSON instead of plain text HTML
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ 
      success: false, 
      error: "Vercel Fatal Crash", 
      details: err?.message || String(err),
      stack: err?.stack || "No stack trace"
    }));
  }
}