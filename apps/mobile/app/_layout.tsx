import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { Stack } from "expo-router";
import { useState } from "react";
import { trpc } from "../utils/trpc";

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "http://localhost:3000/api/trpc",
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Stack />
      </QueryClientProvider>
    </trpc.Provider>
  );
}
