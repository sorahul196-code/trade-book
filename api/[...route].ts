import { handle } from 'hono/vercel';
import app from './app';

// The brackets in the filename tell Vercel to catch EVERY API route
// and perfectly preserve the URL so Hono and tRPC can read it.
export default handle(app);