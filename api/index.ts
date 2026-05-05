import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router.js";
import { createContext } from "./context.js";

// Attempt to disable Vercel's automatic body parser
export const config = {
  api: { bodyParser: false },
};

export default async function handler(req: any, res: any) {
  try {
    // 1. Reconstruct the full URL
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const url = `${protocol}://${host}${req.url}`;

    // 2. Reconstruct Headers safely
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") headers.set(key, value);
      else if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    }

    // 3. Bulletproof Body Extraction (Catches Vercel regardless of its config)
    let bodyText: string | undefined = undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      if (req.body) {
        // If Vercel 'helpfully' parsed it, turn it back into a string
        bodyText = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      } else {
        // If Vercel left it alone, read the raw stream natively
        bodyText = await new Promise<string>((resolve, reject) => {
          let data = "";
          req.on("data", (chunk: any) => { data += chunk.toString(); });
          req.on("end", () => resolve(data));
          req.on("error", reject);
        });
      }
    }

    // 4. Build a pristine Web Request
    const fetchReq = new Request(url, {
      method: req.method,
      headers,
      body: bodyText || undefined,
    });

    // 5. Pass DIRECTLY to tRPC (Bypassing Hono entirely)
    const fetchRes = await fetchRequestHandler({
      endpoint: "/api/trpc",
      req: fetchReq,
      router: appRouter,
      createContext,
    });

    // 6. Send Response safely back to Vercel
    res.status(fetchRes.status);
    fetchRes.headers.forEach((value: string, key: string) => {
      if (key.toLowerCase() === "set-cookie") {
        // Ensure cookies stack properly instead of overwriting
        const current = res.getHeader("set-cookie") || [];
        const currentArr = Array.isArray(current) ? current : [current];
        res.setHeader("set-cookie", [...currentArr, value]);
      } else {
        res.setHeader(key, value);
      }
    });

    const resText = await fetchRes.text();
    res.send(resText);

  } catch (err: any) {
    console.error("FATAL tRPC BRIDGE ERROR:", err);
    res.status(500).json({ success: false, error: "Fatal Vercel Bridge", details: err.message });
  }
}