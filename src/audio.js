// The chime Notification sounds plays.

// Browsers only let audio start after a click or key press on the page, so
// the context is created when the switch is turned on, and activate() unlocks
// it on each later one, e.g. after a reload.
let audio = null;

export function unlockAudio() {
  const Context = window.AudioContext ?? window.webkitAudioContext;
  if (!Context) return 'Your browser does not support playing sounds.';
  audio ??= new Context();
  audio.resume?.();
  return null;
}

export function closeAudio() {
  if (!audio) return;
  Promise.resolve(audio.close?.()).catch(() => {});
  audio = null;
}

// Two short falling tones, made on the fly so the app needs no sound file.
export function playChime() {
  if (unlockAudio()) return;
  const start = audio.currentTime;
  [880, 660].forEach((frequency, index) => {
    const at = start + index * 0.18;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.15, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.16);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.16);
  });
}
