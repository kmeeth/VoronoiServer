import Constants from "expo-constants";

// Derive the dev server's base URL. On web (mobile-web / `expo start --web`),
// use the host the page was loaded from — `hostUri` is null in the browser. On
// native, use the Metro bundler host, which Expo sets to the dev machine's LAN
// IP that devices and emulators can reach (`localhost` would be the device's
// own loopback).
function deriveApiBase(): string {
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:3000`;
  }
  const apiHost = Constants.expoConfig?.hostUri?.split(":")[0] ?? "localhost";
  return `http://${apiHost}:3000`;
}

const API_BASE = deriveApiBase();

export const TRPC_URL = `${API_BASE}/api/trpc`;
export const EVENTS_URL = `${API_BASE}/api/events`;
