import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { api } from "./client";

WebBrowser.maybeCompleteAuthSession();
const base64url = (value: string) =>
  value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export async function signIn() {
  const server = api.baseUrl;
  await api.checkServer();
  const verifier =
    Crypto.randomUUID().replace(/-/g, "") +
    Crypto.randomUUID().replace(/-/g, "");
  const challenge = base64url(
    await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      verifier,
      { encoding: Crypto.CryptoEncoding.BASE64 },
    ),
  );
  const state = base64url(
    await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      Crypto.randomUUID(),
      { encoding: Crypto.CryptoEncoding.BASE64 },
    ),
  );
  const result = await WebBrowser.openAuthSessionAsync(
    `${server}/mobile/connect?challenge=${challenge}&state=${state}`,
    "upstep://auth",
  );
  if (result.type !== "success") return false;
  const callback = new URL(result.url);
  if (
    callback.protocol !== "upstep:" ||
    callback.hostname !== "auth" ||
    callback.searchParams.get("state") !== state
  )
    throw new Error("Could not verify sign-in. Please try again.");
  const code = callback.searchParams.get("code");
  if (!code) throw new Error("No sign-in code was returned.");
  if (server !== api.baseUrl)
    throw new Error("The server changed. Please sign in again.");
  await api.signIn(code, verifier);
  return true;
}
