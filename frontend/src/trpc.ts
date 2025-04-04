import { createTRPCReact } from '@trpc/react-query';
// Import inference helpers from @trpc/server
import type { inferProcedureInput, inferProcedureOutput } from '@trpc/server';
import type { AppRouter } from '../../backend/src/router'; // Import from the new router file

export const trpc = createTRPCReact<AppRouter>();

// Export inferred types for easier use in components (using renamed schemas)
export type AgentRequestInput = inferProcedureInput<AppRouter['generateResponse']>;
export type AgentResponseOutput = inferProcedureOutput<AppRouter['generateResponse']>;
