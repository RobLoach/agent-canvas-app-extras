import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flush, openSettings, setupPage, start } from './helpers.js';

// The browser's voices, as getVoices() gives them.
const voice = (name, lang, { voiceURI = name, localService = true } = {}) => ({
  name,
  lang,
  voiceURI,
  localService,
  default: false,
});
const EMMA = voice('Microsoft Emma Online (Natural) - English (United States)', 'en-US', {
  localService: false,
});
const SAMANTHA = voice('Samantha (Enhanced)', 'en-US', {
  voiceURI: 'com.apple.voice.enhanced.en-US.Samantha',
});
const DANIEL = voice('Daniel', 'en-GB');
const ESPEAK = voice('English (America)', 'en-US');
const NOVELTY = voice('Bad News', 'en-US');
const FRENCH = voice('Thomas', 'fr-FR');
const VOICES = [ESPEAK, DANIEL, NOVELTY, FRENCH, SAMANTHA, EMMA];

const MESSAGE = `
  <article data-testid="agent-message">
    <div class="absolute hidden"></div>
    <div><p>All tests pass.</p></div>
  </article>`;

// Reads the agent's message aloud with a Read aloud button.
async function readMessage(t, settings, voices = VOICES) {
  const { page } = await start(t, {
    path: '/conversations/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    body: MESSAGE,
    settings: { readAloud: true, ...settings },
    before: (page) => {
      page.voices = voices;
    },
  });
  page.document.querySelector('[data-extras-read-aloud]').click();
  return page.spoken[0];
}

const settingsPage = async (t, settings) => {
  const page = setupPage(t, {
    url: 'https://canvas.test/extensions/agent-canvas-app-extras/settings',
    settings,
  });
  page.voices = VOICES;
  await openSettings(page);
  return page;
};

const voiceChoices = (page) =>
  [...page.document.querySelector('[data-testid="extras-voice-select"]').children].map((child) =>
    child.tagName === 'OPTGROUP'
      ? [child.label, [...child.children].map((option) => option.textContent)]
      : child.textContent,
  );

test("lists the browser's English voices by region, best first, without novelty ones", async (t) => {
  const page = await settingsPage(t);

  assert.deepEqual(voiceChoices(page), [
    'Automatic (best available)',
    ['English (United States)', ['Emma · very high · online', 'Samantha · normal']],
    ['English (United Kingdom)', ['Daniel · low']],
    ['Other voices', ['English (America)']],
  ]);
});

test('lists voices the browser finds after the page loads', async (t) => {
  const page = await settingsPage(t);
  await page.setVoices([DANIEL]);

  assert.deepEqual(voiceChoices(page), [
    'Automatic (best available)',
    ['English (United Kingdom)', ['Daniel · low']],
  ]);
});

test('keeps a voice this device does not have', async (t) => {
  const page = await settingsPage(t, { voice: 'Karen' });

  assert.equal(voiceChoices(page)[1], 'Karen (not on this device)');
  assert.equal(page.document.querySelector('[data-testid="extras-voice-select"]').value, 'Karen');
});

test('saves the voice and previews it as soon as it is picked', async (t) => {
  const page = await settingsPage(t);
  const select = page.document.querySelector('[data-testid="extras-voice-select"]');
  select.value = 'Daniel';
  select.dispatchEvent(new page.window.Event('change'));

  assert.equal(
    JSON.parse(page.window.localStorage.getItem('openhands-extras:settings')).voice,
    'Daniel',
  );
  assert.deepEqual(page.utterances, ['Hello, my name is Daniel and I am an English voice.']);
  assert.equal(page.spoken[0].voice, DANIEL);
});

test('Preview reads the picked voice again', async (t) => {
  const page = await settingsPage(t, { voice: 'Daniel' });
  page.document.querySelector('[data-testid="extras-voice-preview"]').click();

  assert.deepEqual(page.utterances, ['Hello, my name is Daniel and I am an English voice.']);
});

test('reads with the best rated voice by default', async (t) => {
  const utterance = await readMessage(t, {});

  assert.equal(utterance.voice, EMMA);
  assert.equal(utterance.rate, 1);
});

test('reads with the chosen voice and speed', async (t) => {
  const utterance = await readMessage(t, { voice: 'Daniel', readingSpeed: '1.5' });

  assert.equal(utterance.voice, DANIEL);
  assert.equal(utterance.lang, 'en-GB');
  assert.equal(utterance.rate, 1.5);
});

test('falls back to the best rated voice when the chosen one is missing', async (t) => {
  const utterance = await readMessage(t, { voice: 'Karen' });

  assert.equal(utterance.voice, EMMA);
});

test('leaves the voice to the browser when it knows none of them', async (t) => {
  const utterance = await readMessage(t, {}, [ESPEAK]);

  assert.equal(utterance.voice, undefined);
  assert.equal(utterance.lang, 'en');
});

test('lists Reading speed under Voice', async (t) => {
  const page = await settingsPage(t);
  const select = page.document.querySelector('[data-testid="extras-readingSpeed-select"]');
  await flush();

  assert.equal(select.value, '1');
  assert.deepEqual(
    [...select.options].map((option) => option.textContent),
    ['0.75×', '1×', '1.25×', '1.5×', '1.75×', '2×'],
  );
});
