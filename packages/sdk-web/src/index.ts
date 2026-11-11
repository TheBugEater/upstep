import type { UpstepColorOverrides, UpstepConfig } from "@upstep/types";
import { UpstepApiClient } from "./api";
import { UpstepWidget, type WidgetOptions } from "./widget";

export type {
  UpstepConfig,
  UpstepColorOverrides,
  UpstepThemeColors,
} from "@upstep/types";
export { UpstepApiClient };
export { readableTextOn, buildWidgetPalette } from "./theme";

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
      if (config.colors !== undefined) widgetOptions.colors = config.colors;
      if (config.radius !== undefined) widgetOptions.radius = config.radius;
      if (config.fontFamily !== undefined) widgetOptions.fontFamily = config.fontFamily;
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

  /** Change or clear verified support identity after login/logout. */
  identifySupport(token: string | undefined) {
    if (_client) _client.supportIdentityToken = token;
    const frame = document.querySelector<HTMLIFrameElement>("#upstep-support-frame");
    if (frame && _client) frame.contentWindow?.postMessage({type: "upstep:support:identity", token, visible: _widget?.isChatVisible() ?? true}, new URL(_client.baseUrl).origin);
  },

  /** Subscribe to the number of unread support messages, e.g. to drive your own launcher badge. */
  onUnread(listener: (count: number) => void) {
    return _widget?.onUnread(listener) ?? (() => {});
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
    if (currentScript?.dataset["chat"] !== undefined) config.chat = currentScript.dataset["chat"] !== "false";
    if (baseUrl) config.baseUrl = baseUrl;
    if (accentColor) config.accentColor = accentColor;
    if (position === "left" || position === "right") config.position = position;
    if (theme === "light" || theme === "dark" || theme === "auto") config.theme = theme;
    // data-colors='{"background":"#0f172a"}', data-radius="8", data-font-family="Inter, sans-serif"
    const colors = currentScript?.dataset["colors"];
    if (colors) {
      try {
        const parsed: unknown = JSON.parse(colors);
        if (parsed && typeof parsed === "object") config.colors = parsed as UpstepColorOverrides;
      } catch {
        console.warn("Upstep: data-colors must be JSON");
      }
    }
    const radius = currentScript?.dataset["radius"];
    if (radius && Number.isFinite(Number(radius))) config.radius = Number(radius);
    const fontFamily = currentScript?.dataset["fontFamily"];
    if (fontFamily) config.fontFamily = fontFamily;
    Upstep.init(config);
  }
}
