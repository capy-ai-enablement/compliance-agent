import { initTRPC } from "@trpc/server";
// Import schemas from the new central location with updated names
import { AgentRequestSchema, AgentResponseSchema } from "./schemas";
import { generateAgentResponse } from "./agentService"; // Import the new service

const t = initTRPC.create();

// Input schema is now imported
// Output schema is also defined for clarity, although mutation returns it directly

export const appRouter = t.router({
  generateResponse: t.procedure
    .input(AgentRequestSchema) // Use the renamed schema for input validation
    .output(AgentResponseSchema) // Define the renamed expected output schema
    .mutation(async ({ input }) => {
      // Call the extracted service function
      // The service function should now return data conforming to AgentResponseSchema
      const result = await generateAgentResponse(input);
      return result; // tRPC will validate this against AgentResponseSchema
    }),
});

// Export type definition of API
export type AppRouter = typeof appRouter;
