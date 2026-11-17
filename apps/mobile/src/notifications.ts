import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./client";
import { parseNotificationTarget } from "./api";

let activeConversation: string | null = null;
export function setActiveConversation(id: string | null) {
  activeConversation = id;
}
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const target = parseNotificationTarget(
      notification.request.content.data,
      api.baseUrl,
    );
    const viewing = !!target && activeConversation === target.conversationId;
    return {
      shouldPlaySound: !viewing,
      shouldSetBadge: false,
      shouldShowBanner: !viewing,
      shouldShowList: !viewing,
    };
  },
});
export function notificationTarget(
  response: Notifications.NotificationResponse | null,
) {
  const data = response?.notification.request.content.data;
  return parseNotificationTarget(data, api.baseUrl);
}
export async function registerNotifications() {
  const projectId =
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId)
    throw new Error(
      "Push notifications need an Expo project ID and a configured development build.",
    );
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("support", {
      name: "Customer support",
      importance: Notifications.AndroidImportance.HIGH,
    });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted)
    permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      "Notifications are off. Enable them in your phone’s settings; your inbox still works.",
    );
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  await api.request("/api/mobile/device", "PUT", {
    pushToken: token.data,
    platform: Platform.OS,
  });
}
// Reinstallation/token rotation must not leave an opted-in phone silently unregistered.
// This path never opens the OS permission prompt.
export async function refreshNotificationRegistration() {
  if ((await Notifications.getPermissionsAsync()).granted)
    await registerNotifications();
}
