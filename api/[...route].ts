import { handle } from '@hono/node-server/vercel';
import app from './app.js';

// This forces Vercel to leave the data stream alone so tRPC can read it
export const config = {
  api: {
    bodyParser: false,
  },
};

// The official, stable Vercel Node handler.
// This guarantees Vercel won't "hang up the phone" early!
export default handle(app);