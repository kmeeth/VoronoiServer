import { useEffect } from "react";
import EventSource from "react-native-sse";
import type { Point } from "@repo/api";
import { trpc } from "./trpc";
import { EVENTS_URL } from "./api";

type PointEventName = "snapshot" | "added" | "removed";

// Subscribe to the server's SSE stream and fold each event into the React Query
// cache for `getPoints`, mirroring the web client. Mutations stay fire-and-
// forget; the SSE echo is the single source of truth, so every client converges
// on the same point set. `react-native-sse` polyfills EventSource (absent in
// React Native) and works unchanged on mobile-web.
export function useRealtimePoints() {
  const utils = trpc.useUtils();

  useEffect(() => {
    const source = new EventSource<PointEventName>(EVENTS_URL);

    source.addEventListener("snapshot", (event) => {
      if (!event.data) return;
      utils.getPoints.setData(undefined, JSON.parse(event.data) as Point[]);
    });

    source.addEventListener("added", (event) => {
      if (!event.data) return;
      const { point } = JSON.parse(event.data) as { point: Point };
      utils.getPoints.setData(undefined, (prev) => {
        if (!prev) return [point];
        if (prev.some((p) => p.id === point.id)) return prev;
        return [...prev, point];
      });
    });

    source.addEventListener("removed", (event) => {
      if (!event.data) return;
      const { id } = JSON.parse(event.data) as { id: string };
      utils.getPoints.setData(undefined, (prev) =>
        prev ? prev.filter((p) => p.id !== id) : prev,
      );
    });

    return () => source.close();
  }, [utils]);
}
