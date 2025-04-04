import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { generateAgentResponse } from "./agentService"; // Import the new service

const t = initTRPC.create();

// Define the schema for a single message in the conversation
const messageSchema = z.object({
  role: z.enum(["user", "assistant"]), // Adjust roles as needed based on frontend
  content: z.string(),
});

// Define the input schema for the generateResponse procedure
const generateResponseInputSchema = z.object({
  messages: z.array(messageSchema),
  repositoryUrl: z.string().optional(), // Included but not used yet
  complianceData: z.any().optional(), // Included but not used yet
});

export const appRouter = t.router({
  generateResponse: t.procedure
    .input(generateResponseInputSchema)
    .mutation(async ({ input }) => {
      // Call the extracted service function
      return generateAgentResponse(input);
    }),
});

// Export type definition of API
export type AppRouter = typeof appRouter;
