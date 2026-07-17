import type { UpstepConfig } from "@upstep/types";
import { UpstepApiClient } from "./api";
import { UpstepWidget, type WidgetOptions } from "./widget";

export type { UpstepConfig };
export { UpstepApiClient };

let _client: UpstepApiClient | null = null;
let _widget: UpstepWidget | null = null;

const Upstep = {
  init(config: UpstepConfig) {
    _client = new UpstepApiClient(config);
    if (typeof window !== "undefined") {
      const widgetOptions: WidgetOptions = {};
      if (config.accentColor !== undefined) widgetOptions.accentColor = config.accentColor;
      if (config.position !== undefined) widgetOptions.position = config.position;
      if (config.theme !== undefined) widgetOptions.theme = config.theme;
      if (config.launcher !== undefined) widgetOptions.launcher = config.launcher;
      const mount = () => {
        _widget = new UpstepWidget(_client!, widgetOptions);
        _widget.mount();
      };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", mount);
      } else {
        mount();
      }
    }
    return _client;
  },

  /** Open the feedback widget — use this to trigger it from your own UI. */
  open() {
    _widget?.openWidget();
  },

  /** Close the feedback widget. */
  close() {
    _widget?.closeWidget();
  },

  /** Set / update the end-user id at runtime (e.g. after the user logs in). */
  identify(userId: string | undefined) {
    _client?.setUserId(userId);
  },

  get client(): UpstepApiClient {
    if (!_client) throw new Error("Upstep.init() must be called first");
    return _client;
  },
};

export default Upstep;

// CDN / script-tag auto-init
if (typeof document !== "undefined") {
  const currentScript =
    document.currentScript as HTMLScriptElement | null;
  const apiKey = currentScript?.dataset["apiKey"];
  const userId = currentScript?.dataset["userId"];
  const baseUrl = currentScript?.dataset["baseUrl"];
  const accentColor = currentScript?.dataset["accentColor"];
  const position = currentScript?.dataset["position"];
  const theme = currentScript?.dataset["theme"];
  if (apiKey) {
    const config: UpstepConfig = { apiKey };
    if (userId) config.userId = userId;
    if (baseUrl) config.baseUrl = baseUrl;
    if (accentColor) config.accentColor = accentColor;
    if (position === "left" || position === "right") config.position = position;
    if (theme === "light" || theme === "dark" || theme === "auto") config.theme = theme;
    Upstep.init(config);
  }
}
