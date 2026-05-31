import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@repo/api";
import type { NextRequest } from "next/server";

// Allow any browser origin (e.g. the Expo web target, a different origin under
// `expo start --web`) to call the tRPC endpoint. The wildcard is intentional in
// production too: this is a public, unauthenticated API over non-sensitive data
// (a shared set of points), so there's nothing to protect by restricting origins.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

const handler = async (req: NextRequest) => {
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ({}),
  });
  for (const [k, v] of Object.entries(CORS_HEADERS)) response.headers.set(k, v);
  return response;
};

const options = () => new Response(null, { status: 204, headers: CORS_HEADERS });

export { handler as GET, handler as POST, options as OPTIONS };
