import * as SecureStore from "expo-secure-store";
import { MobileApi, normalizeServerUrl } from "./api";

export const DEFAULT_API_URL = normalizeServerUrl(
  process.env.EXPO_PUBLIC_API_URL || "https://upstep.dev",
  __DEV__,
);
const serverKey = "upstep.mobile.server";
const key = "upstep.mobile.session";
export const api = new MobileApi(DEFAULT_API_URL, {
  get: () => SecureStore.getItemAsync(key),
  set: (value) =>
    SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
  clear: () => SecureStore.deleteItemAsync(key),
});

export async function restoreClient() {
  const server = await SecureStore.getItemAsync(serverKey);
  if (server) api.configureServer(normalizeServerUrl(server, __DEV__));
  return api.restore();
}

export async function changeServerUrl(value: string, forgetPrevious = false) {
  const origin = normalizeServerUrl(value, __DEV__);
  if (origin === api.baseUrl) return origin;
  if (api.hasSession) {
    if (forgetPrevious) await api.clear();
    else await api.signOut();
  }
  await SecureStore.setItemAsync(serverKey, origin);
  api.configureServer(origin);
  return origin;
}
