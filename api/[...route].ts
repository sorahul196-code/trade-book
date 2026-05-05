import { handle } from 'hono/vercel';
import app from './app.js';

// 🔥 Turn off Vercel's body parser so tRPC can read the raw data stream!
export const config = {
  api: {
    bodyParser: false,
  },
};

export default handle(app);