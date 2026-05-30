import { useEffect } from "react";
import { Platform } from "react-native";
import RNEventSource from "react-native-sse";
import type { Point } from "@repo/api";
import { trpc } from "./trpc";
import { EVENTS_URL } from "./api";

type PointEventName = "snapshot" | "added" | "removed";

// Subscribe to the server's SSE stream and fold each event into the React Query
// cache for `getPoints`, mirroring the web client. Mutations stay fire-and-
// forget; the SSE echo is the single source of truth, so every client converges
// on the same point set.
//
// React Native has no global EventSource, so on native we use the
// `react-native-sse` XHR polyfill. On web (including mobile-web) we use the
// browser's native EventSource — the polyfill reconnect-loops there.
export function useRealtimePoints() {
  const utils = trpc.useUtils();

  useEffect(() => {
    const applySnapshot = (data: string) => {
      utils.getPoints.setData(undefined, JSON.parse(data) as Point[]);
    };
    const applyAdded = (data: string) => {
      const { point } = JSON.parse(data) as { point: Point };
      utils.getPoints.setData(undefined, (prev) => {
        if (!prev) return [point];
        if (prev.some((p) => p.id === point.id)) return prev;
        return [...prev, point];
      });
    };
    const applyRemoved = (data: string) => {
      const { id } = JSON.parse(data) as { id: string };
      utils.getPoints.setData(undefined, (prev) =>
        prev ? prev.filter((p) => p.id !== id) : prev,
      );
    };

    if (Platform.OS === "web") {
      const source = new EventSource(EVENTS_URL);
      const onSnapshot = (e: Event) => applySnapshot((e as MessageEvent).data);
      const onAdded = (e: Event) => applyAdded((e as MessageEvent).data);
      const onRemoved = (e: Event) => applyRemoved((e as MessageEvent).data);
      source.addEventListener("snapshot", onSnapshot);
      source.addEventListener("added", onAdded);
      source.addEventListener("removed", onRemoved);
      return () => source.close();
    }

    const source = new RNEventSource<PointEventName>(EVENTS_URL);
    source.addEventListener("snapshot", (e) => {
      if (e.data) applySnapshot(e.data);
    });
    source.addEventListener("added", (e) => {
      if (e.data) applyAdded(e.data);
    });
    source.addEventListener("removed", (e) => {
      if (e.data) applyRemoved(e.data);
    });
    return () => source.close();
  }, [utils]);
}
