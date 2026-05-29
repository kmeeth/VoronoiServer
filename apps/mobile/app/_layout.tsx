import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import Constants from "expo-constants";
import { Stack } from "expo-router";
import { useState } from "react";
import { trpc } from "../utils/trpc";

// On native, derive the API host from the Metro bundler URL (Expo sets it to
// the dev machine's LAN IP, which devices and Android emulators can reach —
// `localhost` would resolve to the device's own loopback). On web, use the URL
// the page was loaded from, since `hostUri` is null in the browser.
function deriveApiUrl(): string {
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:3000/api/trpc`;
  }
  const apiHost = Constants.expoConfig?.hostUri?.split(":")[0] ?? "localhost";
  return `http://${apiHost}:3000/api/trpc`;
}

const API_URL = deriveApiUrl();

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
