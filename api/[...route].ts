import app from './app.js';

export default async function handler(req: any, res: any) {
  try {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const url = `${protocol}://${host}${req.url}`;

    // Safely transfer headers
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        value.forEach(v => headers.append(key, v));
      } else if (typeof value === 'string') {
        headers.set(key, value);
      }
    }

    // 🚀 THE NUCLEAR FIX: Manually rebuild the body if Vercel hijacked it
    let bodyInit: string | undefined = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (Buffer.isBuffer(req.body)) {
        bodyInit = req.body.toString('utf-8');
      } else if (typeof req.body === 'object' && req.body !== null) {
        if (Object.keys(req.body).length > 0) {
          bodyInit = JSON.stringify(req.body);
        }
      } else if (typeof req.body === 'string' && req.body.length > 0) {
        bodyInit = req.body;
      }
    }

    // Create a pristine Web Request
    const fetchReq = new Request(url, {
      method: req.method,
      headers,
      body: bodyInit,
    });

    // Run the app
    const fetchRes = await app.fetch(fetchReq);

    // Safely transfer the response back to Vercel
    res.status(fetchRes.status);
    fetchRes.headers.forEach((value: string, key: string) => {
      res.setHeader(key, value);
    });

    // Wait for the ENTIRE response to load so Vercel can't chop it off
    const buffer = await fetchRes.arrayBuffer();
    res.send(Buffer.from(buffer));
    
  } catch (err: any) {
    // If absolutely anything goes wrong, guarantee a clean JSON error
    console.error("FATAL HANDLER ERROR:", err);
    res.status(500).json({ success: false, error: "Fatal Vercel Crash", details: err.message });
  }
}