import type { ExpoConfig } from "expo/config";

// EAS file environment variable: the path exists on the native build worker.
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;

const config: ExpoConfig = {
  name: "Upstep",
  slug: "upstep-support",
  owner: "dilhangeeth",
  scheme: "upstep",
  version: "0.1.0",
  icon: "./assets/icon.png",
  orientation: "portrait",
  platforms: ["ios", "android"],
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "dev.upstep.support",
    supportsTablet: true,
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: "dev.upstep.support",
    ...(googleServicesFile ? { googleServicesFile } : {}),
  },
  plugins: ["expo-secure-store", "expo-notifications", "expo-web-browser"],
  extra: {
    eas: {
      projectId:
        process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
        "b52aff91-14dc-44ed-a25d-1d3d20d57000",
    },
  },
};
export default config;
