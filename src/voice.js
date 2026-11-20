// Voice chat, Hands-free and Read aloud buttons: after you speak a message
// with Canvas's mic, send it, read the agent's reply aloud and listen again,
// stop the mic once you stop talking, and read any of the agent's messages.

import { speechProblem } from './audio.js';
import { el, OWN_ATTR } from './dom.js';
import { canvasLanguage, openConversationId } from './canvas.js';
import { ACTIVE_STATUSES } from './statuses.js';
import { plainText } from './notifications.js';
import { settings } from './settings.js';

// Canvas's mic, which says it's recording with aria-pressed and starting or
// transcribing with aria-busy, and puts what you said in the message box.
const MIC = '[data-testid="chat-dictation-button"]';
const COMPOSER = '[data-testid="chat-input"]';
const SEND = '[data-testid="submit-button"]';
const STOP = '[data-testid="stop-button"]';
const AGENT_MESSAGE = 'article[data-testid="agent-message"]';
const READ_ALOUD_ATTR = 'data-extras-read-aloud';

// How often to ask the Agent Server whether the reply is in, and how long to
// wait for what you said to reach the message box.
const REPLY_CHECK_MS = 2000;
const SEND_CHECK_MS = 100;
const SEND_TIMEOUT_MS = 3000;
const TRANSCRIBE_TIMEOUT_MS = 30000;

// Hands-free listens to the mic's level every LEVEL_MS: once you've talked
// for SPEECH_MS, a pause of SILENCE_MS stops the mic, as does saying nothing
// for QUIET_MS.
const LEVEL_MS = 50;
const SPEECH_MS = 250;
const SILENCE_MS = 1500;
const QUIET_MS = 10000;
const MIN_LEVEL = 0.015;

// Replies are cut to this many characters, and read a sentence at a time,
// as Chrome stops reading a long utterance after about 15 seconds.
const MAX_SPOKEN = 1500;

// What's said instead of a reply.
const SAY = {
  waiting_for_confirmation: 'The agent needs your confirmation.',
  error: 'The agent stopped with an error.',
  stuck: 'The agent got stuck.',
};

// Things you can say instead of a message, as what Canvas heard, without
// punctuation, gives them.
const COMMANDS = {
  stop: 'stop',
  'stop it': 'stop',
  pause: 'stop',
  cancel: 'cancel',
  'never mind': 'cancel',
  nevermind: 'cancel',
  repeat: 'repeat',
  'repeat that': 'repeat',
  'say that again': 'repeat',
  'new chat': 'newChat',
  'new conversation': 'newChat',
  'start a new chat': 'newChat',
};

export const commandFor = (text) =>
  COMMANDS[
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
  ] ?? null;

// A speaker, as Canvas draws its message actions' icons.
const SPEAKER_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>';

const findMic = () => document.querySelector(MIC);
const pressed = (mic) => mic?.getAttribute('aria-pressed') === 'true';
const busy = (mic) => mic?.getAttribute('aria-busy') === 'true';

// The send button beside the mic, as there may be other message boxes.
function sendButton(mic) {
  for (let node = mic?.parentElement; node; node = node.parentElement) {
    const button = node.querySelector(SEND);
    if (button) return button;
  }
  return null;
}

// Text split into sentences in Canvas's language, or in one go for a
// language the browser doesn't know.
function sentencesOf(text) {
  let segments;
  try {
    segments = [...new Intl.Segmenter(canvasLanguage(), { granularity: 'sentence' }).segment(text)];
  } catch {
    segments = [{ segment: text }];
  }
  return segments.map(({ segment }) => segment.trim()).filter(Boolean);
}

// A reply as speech: Markdown stripped and code left on screen.
export const spokenSentences = (markdown) =>
  sentencesOf(
    plainText(markdown.replace(/```[\s\S]*?(?:```|$)/g, ' The code is in the chat. '), MAX_SPOKEN),
  );

// One of the agent's messages on the page as speech, read in full, with
// paragraphs, items and cells as separate sentences.
function messageSentences(article) {
  const copy = article.cloneNode(true);
  for (const node of copy.querySelectorAll(':scope > div.absolute, button')) node.remove();
  for (const code of copy.querySelectorAll('pre')) code.replaceWith(' The code is in the chat. ');
  for (const block of copy.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, td, th, blockquote')) {
    block.append('\n');
  }
  return copy.textContent.split(/\n+/).flatMap((line) => sentencesOf(line.replace(/\s+/g, ' ')));
}

// Queues the sentences to be read, then runs onDone once the last is.
// Cancelling the queue skips onDone.
function read(sentences, onDone) {
  const synth = window.speechSynthesis;
  synth.cancel();
  sentences.forEach((sentence, index) => {
    const utterance = new window.SpeechSynthesisUtterance(sentence);
    utterance.lang = canvasLanguage();
    if (index === sentences.length - 1) utterance.onend = onDone;
    synth.speak(utterance);
  });
}

// Stops the mic after you stop talking, from its level on a second stream:
// Canvas's own recognition gives no sign until it's stopped.
function silenceDetector(onSilence) {
  let stopped = false;
  let stream = null;
  let context = null;
  let timer = 0;

  async function start() {
    const Context = window.AudioContext ?? window.webkitAudioContext;
    if (!Context || !window.navigator.mediaDevices?.getUserMedia) return;
    try {
      stream = await window.navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return;
    }
    if (stopped) {
      stop();
      return;
    }
    context = new Context();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    // The room's own level, so a noisy one still reads as quiet: it drops to
    // any quieter moment, such as between words, and creeps up otherwise.
    let floor = MIN_LEVEL;
    let spoke = 0;
    let quiet = 0;
    let elapsed = 0;
    const tick = () => {
      if (stopped) return;
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += sample * sample;
      const level = Math.sqrt(sum / samples.length);
      floor = Math.min(level, floor) * 0.998 + level * 0.002;
      const loud = level > Math.max(MIN_LEVEL, floor * 2.5);
      elapsed += LEVEL_MS;
      if (loud) {
        spoke += LEVEL_MS;
        quiet = 0;
      } else {
        quiet += LEVEL_MS;
      }
      const talked = spoke >= SPEECH_MS;
      if ((talked && quiet >= SILENCE_MS) || (!talked && elapsed >= QUIET_MS)) {
        stop();
        onSilence();
        return;
      }
      timer = setTimeout(tick, LEVEL_MS);
    };
    timer = setTimeout(tick, LEVEL_MS);
  }

  function stop() {
    stopped = true;
    clearTimeout(timer);
    for (const track of stream?.getTracks() ?? []) track.stop();
    stream = null;
    Promise.resolve(context?.close?.()).catch(() => {});
    context = null;
  }

  start();
  return stop;
}

// A turn goes listening → sending → waiting → speaking, then listens again
// by pressing the mic. Pressing a key, leaving the conversation or turning
// Voice chat off ends it. Each step that waits checks the turn is still the
// current one after.
export function voiceChat(host, loadConversations) {
  // The turn: its stage, the conversation it's in, null on a new chat until
  // Canvas opens it, your last message there when it started, and whether
  // the run answering you was seen going.
  let turn = null;
  let wasPressed = false;
  let timer = 0;
  let stopDetector = null;
  let unlocked = false;
  // The screen's wake lock while a turn goes, as a promise of it, and the
  // message a Read aloud button is reading.
  let wakeLock = null;
  let reading = null;

  const on = () => settings.voiceChat || settings.handsFree || settings.readAloud;
  const at = (stage) => turn?.stage === stage;

  function end() {
    turn = null;
    clearTimeout(timer);
    timer = 0;
    letSleep();
    stopReading();
  }

  function stopReading() {
    if (reading) setReading(null);
    if (window.speechSynthesis?.speaking || window.speechSynthesis?.pending) {
      window.speechSynthesis.cancel();
    }
  }

  // Phones sleep, and stop listening, after a while without a touch.
  function keepAwake() {
    if (wakeLock || document.hidden || !window.navigator.wakeLock) return;
    wakeLock = window.navigator.wakeLock.request('screen').catch(() => null);
  }

  function letSleep() {
    const lock = wakeLock;
    wakeLock = null;
    lock?.then((sentinel) => sentinel?.release()).catch(() => {});
  }

  // The browser lets go of the lock when the tab's hidden.
  function onVisibility() {
    if (document.hidden || !turn) return;
    letSleep();
    keepAwake();
  }

  function stopListening() {
    stopDetector?.();
    stopDetector = null;
  }

  function onListen() {
    if (settings.handsFree && !stopDetector) {
      stopDetector = silenceDetector(() => {
        stopDetector = null;
        const mic = findMic();
        if (pressed(mic)) mic.click();
      });
    }
    if (!settings.voiceChat) return;
    // Pressing the mic while the reply is read talks over it.
    end();
    const id = openConversationId();
    const current = { stage: 'listening', id, baseline: id ? undefined : null, sawActive: false };
    turn = current;
    keepAwake();
    if (!id) return;
    loadConversations([id])
      .then(([info]) => {
        current.baseline = info?.last_user_message_id ?? null;
      })
      // Without it, there's no telling the reply from the last one.
      .catch(() => {
        if (turn === current) end();
      });
  }

  // Once what you said is in the message box, send it.
  function onStopped() {
    stopListening();
    if (!at('listening')) return;
    turn.stage = 'sending';
    const started = Date.now();
    const trySend = () => {
      const mic = findMic();
      const composer = document.querySelector(COMPOSER);
      const send = sendButton(mic);
      const waited = Date.now() - started;
      const text = composer?.textContent.trim();
      const command = text && !busy(mic) && commandFor(text);
      if (command) {
        clearComposer(composer);
        runCommand(command);
      } else if (text && send && !send.disabled && !busy(mic)) {
        send.click();
        turn.stage = 'waiting';
        timer = setTimeout(checkReply, REPLY_CHECK_MS);
      } else if (waited < (busy(mic) ? TRANSCRIBE_TIMEOUT_MS : SEND_TIMEOUT_MS)) {
        timer = setTimeout(trySend, SEND_CHECK_MS);
      } else {
        end();
      }
    };
    timer = setTimeout(trySend, SEND_CHECK_MS);
  }

  // Canvas's message box keeps its text in its own state, which hears input.
  function clearComposer(composer) {
    composer.textContent = '';
    composer.dispatchEvent(new window.InputEvent('input', { bubbles: true }));
  }

  // "Stop" presses Canvas's Stop, for a run you talked over; "repeat" reads
  // the last reply again; "new chat" opens one and listens there.
  async function runCommand(command) {
    const current = turn;
    if (command === 'stop') {
      document.querySelector(STOP)?.click();
      speak(['Stopped.'], false);
    } else if (command === 'cancel') {
      end();
    } else if (command === 'newChat') {
      host.navigate('/conversations');
      current.id = null;
      speak(['New chat.'], true);
    } else if (command === 'repeat' && current.id) {
      const result = await host.agentServer
        .request({ path: `/api/conversations/${current.id}/agent_final_response` })
        .catch(() => null);
      if (turn !== current) return;
      speak(spokenSentences(result?.response ?? ''), true);
    } else {
      end();
    }
  }

  // The reply is in once the run that answers your message has stopped:
  // the run was seen going, or the agent has added to the conversation since
  // your message.
  async function checkReply() {
    const current = turn;
    current.id ??= openConversationId();
    const info = current.id
      ? await loadConversations([current.id])
          .then(([result]) => result)
          .catch(() => null)
      : null;
    if (turn !== current) return;
    const status = info?.execution_status;
    const message = info?.last_user_message_id;
    const answered =
      !!message && current.baseline !== undefined && message !== current.baseline;
    const running = ACTIVE_STATUSES.has(status);
    if (answered && running) current.sawActive = true;
    const agentActed = !!info?.leaf_event_id && info.leaf_event_id !== message;
    const needsYou = status === 'waiting_for_confirmation';
    if (!answered || (running && !needsYou) || (!running && !current.sawActive && !agentActed)) {
      timer = setTimeout(checkReply, REPLY_CHECK_MS);
      return;
    }
    if (status === 'finished') {
      const result = await host.agentServer
        .request({ path: `/api/conversations/${current.id}/agent_final_response` })
        .catch(() => null);
      if (turn !== current) return;
      speak(spokenSentences(result?.response ?? ''), true);
    } else if (SAY[status]) {
      speak([SAY[status]], false);
    } else {
      end();
    }
  }

  // Reads the sentences, then, after a reply, listens again if you're still
  // looking at the conversation. end() cancels what's left.
  function speak(sentences, again) {
    const done = () => (again ? listenAgain() : end());
    if (!sentences.length || speechProblem()) {
      done();
      return;
    }
    const current = turn;
    current.stage = 'speaking';
    read(sentences, () => {
      if (turn === current) done();
    });
  }

  function listenAgain() {
    const { id } = turn;
    end();
    if (!settings.voiceChat) return;
    const mic = findMic();
    if (document.hidden || openConversationId() !== id) return;
    if (mic && !mic.disabled && !pressed(mic) && !busy(mic)) mic.click();
  }

  // A Read aloud button reads its message, or stops when it's reading, which
  // ends any turn, as does pressing the mic while it reads.
  function setReading(article) {
    for (const button of document.querySelectorAll(`[${READ_ALOUD_ATTR}]`)) {
      const on = button.closest(AGENT_MESSAGE) === article;
      button.setAttribute('aria-label', on ? 'Stop reading' : 'Read aloud');
      button.classList.toggle('text-contrast', on);
    }
    reading = article;
  }

  function onReadAloud(article) {
    if (reading === article) {
      stopReading();
      return;
    }
    end();
    if (speechProblem()) return;
    setReading(article);
    read(messageSentences(article), () => {
      if (reading === article) setReading(null);
    });
  }

  function addReadAloud() {
    for (const article of document.querySelectorAll(AGENT_MESSAGE)) {
      const actions = article.querySelector(':scope > div.absolute');
      if (!actions || actions.querySelector(`[${READ_ALOUD_ATTR}]`)) continue;
      const button = el('button', 'button-base p-1 cursor-pointer');
      button.type = 'button';
      button.setAttribute(OWN_ATTR, '');
      button.setAttribute(READ_ALOUD_ATTR, '');
      button.setAttribute('aria-label', reading === article ? 'Stop reading' : 'Read aloud');
      button.innerHTML = SPEAKER_ICON;
      button.addEventListener('click', () => onReadAloud(article));
      actions.prepend(button);
    }
  }

  function removeReadAloud() {
    for (const button of document.querySelectorAll(`[${READ_ALOUD_ATTR}]`)) button.remove();
  }

  // Browsers only let a page speak after a click or key press on it, and
  // Safari only from one, so the first press of the mic says nothing.
  function onPointerDown(event) {
    if (unlocked || !settings.voiceChat || !event.target?.closest?.(MIC)) return;
    if (speechProblem()) return;
    unlocked = true;
    window.speechSynthesis.speak(new window.SpeechSynthesisUtterance(''));
  }

  // A key press ends the turn, unless it's while you're talking, as dictation
  // takes keys too. Esc stops a Read aloud button.
  function onKeyDown(event) {
    if (reading && event.key === 'Escape') stopReading();
    if (!at('waiting') && !at('speaking')) return;
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return;
    end();
  }

  function onMicChange() {
    const now = pressed(findMic());
    if (now !== wasPressed) {
      wasPressed = now;
      if (now) onListen();
      else onStopped();
    }
    // Leaving the conversation ends its turn.
    if (turn?.id && openConversationId() !== turn.id) end();
  }

  // Canvas's mic only changes attributes as it starts and stops, which the
  // app's own page observer doesn't hear.
  const attributes = new MutationObserver(onMicChange);
  let listening = false;

  function listen(next) {
    if (next === listening) return;
    listening = next;
    if (next) {
      attributes.observe(document.body, {
        subtree: true,
        attributes: true,
        attributeFilter: ['aria-pressed', 'aria-busy'],
      });
      window.addEventListener('pointerdown', onPointerDown, true);
      window.addEventListener('keydown', onKeyDown, true);
      document.addEventListener('visibilitychange', onVisibility);
      wasPressed = pressed(findMic());
    } else {
      attributes.disconnect();
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('visibilitychange', onVisibility);
      stopListening();
      end();
    }
  }

  return {
    refresh() {
      listen(on());
      if (!settings.handsFree) stopListening();
      if (!settings.voiceChat && turn) end();
      if (settings.readAloud) addReadAloud();
      else {
        if (reading) stopReading();
        removeReadAloud();
      }
    },
    onDomChange() {
      if (!listening) return;
      onMicChange();
      if (settings.readAloud) addReadAloud();
    },
    dispose() {
      listen(false);
    },
  };
}
