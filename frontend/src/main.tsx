import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc } from './trpc'; // Import the trpc instance
import './index.css';
import App from './App.tsx';

function Main() {
  // Create state for QueryClient and trpcClient
  // This ensures they are created only once per component instance
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: 'http://localhost:3001/trpc', // URL of your tRPC backend
          // You can pass any headers you need here, e.g., for authentication
          // headers() {
          //   return {
          //     authorization: getAuthCookie(),
          //   };
          // },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {/* The rest of your app */}
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  );
}


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Main />
  </StrictMode>,
);
