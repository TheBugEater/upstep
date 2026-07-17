import { useEffect } from "react";
import { useUpstep } from "./FeedbackContext";

// expo-sensors is a peer dependency when using Expo; skip if not available
let Accelerometer: {
  setUpdateInterval: (ms: number) => void;
  addListener: (cb: (data: { x: number; y: number; z: number }) => void) => { remove: () => void };
} | undefined;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Accelerometer = (require("expo-sensors") as { Accelerometer: typeof Accelerometer }).Accelerometer;
} catch {
  // expo-sensors not installed — shake detection unavailable
}

const SHAKE_THRESHOLD = 2.5;
const COOLDOWN_MS = 2000;

export function useShakeToFeedback() {
  const { openSheet } = useUpstep();

  useEffect(() => {
    if (!Accelerometer) return;

    let lastShake = 0;
    Accelerometer.setUpdateInterval(100);

    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      const total = Math.sqrt(x * x + y * y + z * z);
      if (total > SHAKE_THRESHOLD) {
        const now = Date.now();
        if (now - lastShake > COOLDOWN_MS) {
          lastShake = now;
          openSheet();
        }
      }
    });

    return () => subscription.remove();
  }, [openSheet]);
}
