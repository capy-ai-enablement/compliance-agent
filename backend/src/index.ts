import express, { Express } from 'express';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import cors from 'cors'; // Need CORS for frontend interaction
import { appRouter } from './router'; // Import the router

const app: Express = express();
const port = process.env.PORT || 3001; // Use 3001 to avoid conflict with frontend default (5173)

// Enable CORS for all origins (adjust in production)
app.use(cors());

// Mount tRPC router
app.use(
  '/trpc', // Mount point for tRPC API
  createExpressMiddleware({
    router: appRouter,
    // createContext, // Optional: Define context for requests
  })
);

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
  console.log(`[trpc]: tRPC endpoint available at http://localhost:${port}/trpc`);
});
