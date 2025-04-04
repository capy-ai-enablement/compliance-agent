import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../backend/src/index'; // Adjust path if backend structure changes

export const trpc = createTRPCReact<AppRouter>();
