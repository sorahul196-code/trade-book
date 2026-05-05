import { handle } from 'hono/vercel';
import app from './app.js';

// Clean, standard official Vercel handler
export default handle(app);