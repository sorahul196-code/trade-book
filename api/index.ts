import { handle } from '@hono/node-server/vercel';
import app from './app.js';

const honoHandler = handle(app);

export default async function(req: any, res: any) {
  // 🔥 THE LOOP BREAKER 🔥
  // If Vercel 'helpfully' parsed the JSON into an Object, we MUST turn it 
  // back into a raw string. Otherwise, the Web Request constructor deletes it!
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    if (Object.keys(req.body).length > 0) {
      req.body = JSON.stringify(req.body);
    } else {
      req.body = undefined;
    }
  }

  return honoHandler(req, res);
}