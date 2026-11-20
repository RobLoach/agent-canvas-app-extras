// The chime Notification sounds plays, and what Voice chat and Hands-free
// need from the browser.

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

export function speechProblem() {
  return window.speechSynthesis && window.SpeechSynthesisUtterance
    ? null
    : "Your browser can't read text aloud.";
}

export async function requestMic() {
  if (!window.navigator.mediaDevices?.getUserMedia) {
    return 'Your browser only lets apps use the mic over HTTPS or on localhost.';
  }
  try {
    const stream = await window.navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
    return null;
  } catch {
    return 'The mic is blocked for this site in your browser settings.';
  }
}
