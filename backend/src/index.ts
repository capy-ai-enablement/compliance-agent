import express, { Express } from 'express';
import { initTRPC } from '@trpc/server';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { z } from 'zod';
import cors from 'cors'; // Need CORS for frontend interaction

// Initialize tRPC
const t = initTRPC.create();

// Create router and procedure
const appRouter = t.router({
  hello: t.procedure
    .input(z.object({ name: z.string().optional() }))
    .query(({ input }) => {
      return `Hello ${input.name || 'world'}!`;
    }),
  // Add more procedures here as needed
});

// Export the router type
export type AppRouter = typeof appRouter;

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
