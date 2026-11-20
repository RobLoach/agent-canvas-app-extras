// Reading aloud with the browser's voices: the Voice and Reading speed
// settings, ranked and labelled from Readium Speech's recommended voices.

import { canvasLanguage } from './canvas.js';
import { settings, SWITCHES } from './settings.js';
import { DEFAULT_REGION, HIDDEN, TEST_UTTERANCE, VOICES } from './voices-en.js';

const QUALITY_RANKS = { low: 1, normal: 2, high: 3, veryHigh: 4 };
const QUALITY_LABELS = { low: 'low', normal: 'normal', high: 'high', veryHigh: 'very high' };
const KNOWN = new Map(VOICES.flatMap((entry) => entry.names.map((name) => [name, entry])));
const HIDDEN_NAMES = new Set(HIDDEN);

const SPEEDS = SWITCHES.find(({ key }) => key === 'readingSpeed').options;
const readingRate = () => SPEEDS.find(([value]) => value === settings.readingSpeed)?.[2] ?? 1;

const regionName = (language) => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language', languageDisplay: 'standard' }).of(
      language,
    );
  } catch {
    return language;
  }
};

// Apple's voices come in compact, enhanced and premium versions, which their
// names or ids say; Readium rates each version it knows.
function qualityOf(voice, entry) {
  const id = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  const version = /premium/.test(id) ? 'high' : /enhanced/.test(id) ? 'normal' : null;
  return entry.quality.includes(version) ? version : entry.quality[0];
}

// The browser's English voices, but novelty and very low quality ones, each
// with Readium's label, quality and region where it knows the voice.
function englishVoices() {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  return voices.flatMap((voice) => {
    const language = voice.lang.replace('_', '-');
    if (!/^en\b/i.test(language) || HIDDEN_NAMES.has(voice.name)) return [];
    const plainName = voice.name.replace(/\s*\((?:enhanced|premium)\)$/i, '');
    const entry = KNOWN.get(voice.name) ?? KNOWN.get(plainName) ?? KNOWN.get(voice.voiceURI);
    const quality = entry ? qualityOf(voice, entry) : null;
    return [
      {
        voice,
        label: entry?.label ?? voice.name,
        quality,
        rank: QUALITY_RANKS[quality] ?? 0,
        region: entry?.language ?? language,
        online: voice.localService === false,
      },
    ];
  });
}

// Best first: by quality, then in your region, then on your device.
function ranked() {
  const region = /^en-/i.test(window.navigator.language) ? window.navigator.language : DEFAULT_REGION;
  const score = (item) => [
    item.rank,
    item.region.toLowerCase() === region.toLowerCase() ? 1 : 0,
    item.online ? 0 : 1,
  ];
  return englishVoices().sort((a, b) => {
    const [x, y] = [score(a), score(b)];
    const difference = x.findIndex((value, index) => value !== y[index]);
    return difference === -1 ? a.label.localeCompare(b.label) : y[difference] - x[difference];
  });
}

const describe = (item) =>
  [item.label, QUALITY_LABELS[item.quality], item.online && 'online'].filter(Boolean).join(' · ');

// The Voice setting's choices: rated voices by region, the best region
// first, then the rest.
export function voiceGroups() {
  const groups = new Map();
  for (const item of ranked()) {
    const group = item.rank ? regionName(item.region) : 'Other voices';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push([item.voice.name, describe(item)]);
  }
  const other = groups.get('Other voices');
  groups.delete('Other voices');
  if (other) groups.set('Other voices', other);
  return [...groups];
}

// The Voice setting's voice, or else the best rated one, or none, for the
// browser to choose, when it knows none of them.
export function chosenVoice(name = settings.voice) {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  const chosen = name && voices.find((voice) => voice.name === name);
  if (chosen) return chosen;
  const [best] = ranked();
  return best?.rank ? best.voice : null;
}

// Queues the sentences to be read with the chosen voice and speed, then runs
// onDone once the last is. Cancelling the queue skips onDone.
export function read(sentences, onDone, name) {
  const synth = window.speechSynthesis;
  const voice = chosenVoice(name);
  synth.cancel();
  sentences.forEach((sentence, index) => {
    const utterance = new window.SpeechSynthesisUtterance(sentence);
    utterance.lang = voice?.lang ?? canvasLanguage();
    if (voice) utterance.voice = voice;
    utterance.rate = readingRate();
    if (index === sentences.length - 1) utterance.onend = onDone;
    synth.speak(utterance);
  });
}

// Readium's sample sentence in a voice, by its name, or the chosen one.
export function previewVoice(name) {
  const voice = chosenVoice(name);
  const label = voice
    ? (englishVoices().find((item) => item.voice === voice)?.label ?? voice.name)
    : 'your browser';
  read([TEST_UTTERANCE.replace('{name}', label)], null, name);
}
