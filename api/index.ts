import { handle } from 'hono/vercel';
import app from './app';

// 🔥 THIS IS THE MAGIC FIX 🔥
// It forces Vercel to leave the data stream alone so tRPC can read it!
export const config = {
  api: {
    bodyParser: false,
  },
};

export default handle(app);