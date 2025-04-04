import { initTRPC } from '@trpc/server';

const t = initTRPC.create();

import { z } from 'zod';

export const appRouter = t.router({
  // Define your procedures here
  // Example hello procedure from original index.ts:
  hello: t.procedure
    .input(z.object({ name: z.string().optional() }))
    .query(({ input }) => {
      return `Hello ${input?.name || 'world'} from backend router!`;
    }),
});

// Export type definition of API
export type AppRouter = typeof appRouter;
