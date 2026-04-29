import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import { trpc, createTrpcClient } from "./lib/api/client";
import { createQueryClient } from "./lib/query-client";
import { subscribeStore } from "./data/store";
import { registerServiceWorker } from "./lib/pwa";

registerServiceWorker();

function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());
  const [trpcClient] = useState(() => createTrpcClient());

  // Mock-mode glue: when direct `actions.*` calls mutate the store, nuke the
  // React Query cache so hooks refetch. On real backend this becomes a no-op.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return subscribeStore(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        queryClient.invalidateQueries();
      }, 30);
    });
  }, [queryClient]);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Providers>
        <App />
      </Providers>
    </BrowserRouter>
  </React.StrictMode>
);
