let context: AudioContext | null = null;
/** Soft two-note chime. Browsers only allow audio after the customer has interacted with the page. */
export function playChime() {
  try {
    const Context =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Context) return;
    context = context || new Context();
    if (context.state === "suspended") void context.resume();
    const start = context.currentTime;
    for (const [frequency, offset] of [
      [880, 0],
      [1318, 0.12],
    ] as const) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.14, start + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.5);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + 0.55);
    }
  } catch {
    /* sound is optional */
  }
}
