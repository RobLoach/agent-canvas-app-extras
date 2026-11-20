// Builds src/voices-en.js from Readium Speech's recommended voices, at the
// commit below: npm run voices. Only what Extras uses is kept, so the bundle
// stays small.
import { writeFile } from 'node:fs/promises';

const READIUM = 'https://raw.githubusercontent.com/readium/speech';
const COMMIT = '8c37650e9465e4e69551b29de2c8e96a482c46cf';
const json = async (path) => {
  const response = await fetch(`${READIUM}/${COMMIT}/json/${path}`);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
};

const [english, novelty, veryLow, license] = await Promise.all([
  json('en.json'),
  json('filters/novelty.json'),
  json('filters/veryLowQuality.json'),
  fetch(`${READIUM}/${COMMIT}/LICENSE`).then((response) => response.text()),
]);
const names = (voice) => [voice.name, ...(voice.altNames ?? []), ...(voice.nativeID ?? [])];
const voices = english.voices.map((voice) => ({
  names: names(voice),
  label: voice.label,
  language: voice.language,
  quality: voice.quality,
}));
const englishOnly = (voice) =>
  !voice.language || [voice.language, ...(voice.otherLanguages ?? [])].some((tag) => tag.startsWith('en'));
const hidden = [...novelty.voices, ...veryLow.voices].filter(englishOnly).flatMap(names);

await writeFile(
  new URL('../src/voices-en.js', import.meta.url),
  `// Built by scripts/voices.js from Readium Speech's recommended voices
// (https://github.com/readium/speech) at commit
// ${COMMIT}; edit the script instead.
// Its license, which extension.js carries along with this data:
//
${license.trim().split('\n').map((line) => `// ${line}`.trimEnd()).join('\n')}

export const TEST_UTTERANCE = ${JSON.stringify(english.testUtterance)};
export const DEFAULT_REGION = ${JSON.stringify(english.defaultRegion)};
export const VOICES = [
${voices.map((voice) => `  ${JSON.stringify(voice)},`).join('\n')}
];
export const HIDDEN = ${JSON.stringify(hidden)};
`,
);
