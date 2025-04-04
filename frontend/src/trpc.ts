import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../backend/src/router'; // Import from the new router file

export const trpc = createTRPCReact<AppRouter>();
