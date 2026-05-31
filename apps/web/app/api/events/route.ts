import { listPoints, subscribePoints, type PointEvent } from "@repo/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Let any browser origin (e.g. the Expo web target under `expo start --web`)
// consume the stream. Wildcard intentional in production too, matching the tRPC
// route — public, unauthenticated, non-sensitive data. The `react-native-sse`
// polyfill sends a `Cache-Control` request header, which is not CORS-safelisted
// and so triggers a preflight — hence the OPTIONS handler and Allow-Headers.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function GET(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      send("snapshot", listPoints());

      const unsubscribe = subscribePoints((event: PointEvent) => {
        send(event.type, event);
      });

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": ping\n\n"));
      }, 25_000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      ...CORS_HEADERS,
    },
  });
}
