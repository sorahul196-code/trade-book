import { Hono } from "hono";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router.js";
import { createContext } from "./context.js";

const app = new Hono();

app.all("/api/trpc/*", async (c) => {
  try {
    // 🔥 THE SILVER BULLET: Forcefully read the data into memory 
    // so Vercel's weird stream handling doesn't choke tRPC!
    const bodyText = c.req.method === "POST" ? await c.req.text() : undefined;
    
    // Rebuild a completely clean Request object for tRPC
    const cleanReq = new Request(c.req.url, {
      method: c.req.method,
      headers: c.req.raw.headers,
      body: bodyText,
    });

    return await fetchRequestHandler({
      endpoint: "/api/trpc",
      req: cleanReq,
      router: appRouter,
      createContext,
    });
  } catch (e: any) {
    console.error("tRPC Error:", e);
    return c.json({ success: false, error: e.message || "Internal Server Error" }, 500);
  }
});

app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

app.onError((err, c) => {
  console.error("Hono Global Error:", err);
  return c.json({ success: false, error: err.message }, 500);
});

export default app;