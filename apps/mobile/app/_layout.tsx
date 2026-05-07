import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import Constants from "expo-constants";
import { Stack } from "expo-router";
import { useState } from "react";
import { trpc } from "../utils/trpc";

// Use the Metro bundler host (set by Expo when starting the dev server) so the
// API URL resolves to the dev machine's LAN IP on real devices and Android
// emulators, not the device's own loopback.
const debuggerHost = Constants.expoConfig?.hostUri;
const apiHost = debuggerHost?.split(":")[0] ?? "localhost";
const API_URL = `http://${apiHost}:3000/api/trpc`;

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: API_URL,
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
