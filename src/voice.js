// Voice chat and hands-free: after you speak a message with Canvas's mic,
// send it, read the agent's reply aloud and listen again, and stop the mic
// once you stop talking.

import { speechProblem } from './audio.js';
import { canvasLanguage, openConversationId } from './canvas.js';
import { ACTIVE_STATUSES } from './statuses.js';
import { plainText } from './notifications.js';
import { settings } from './settings.js';

// Canvas's mic, which says it's recording with aria-pressed and starting or
// transcribing with aria-busy, and puts what you said in the message box.
const MIC = '[data-testid="chat-dictation-button"]';
const COMPOSER = '[data-testid="chat-input"]';
const SEND = '[data-testid="submit-button"]';

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

// A reply as speech: Markdown stripped, code left on screen, and split into
// sentences in Canvas's language.
export function spokenSentences(markdown) {
  const text = plainText(
    markdown.replace(/```[\s\S]*?(?:```|$)/g, ' The code is in the chat. '),
    MAX_SPOKEN,
  );
  const sentences = new Intl.Segmenter(canvasLanguage(), { granularity: 'sentence' });
  return [...sentences.segment(text)]
    .map(({ segment }) => segment.trim())
    .filter(Boolean);
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
// Voice chat off ends it.
export function voiceChat(host, loadConversations) {
  let state = 'idle';
  let wasPressed = false;
  // The conversation the turn is in, null on a new chat until Canvas opens
  // it, and its last message from you when the turn started.
  let turn = null;
  let timer = 0;
  let stopDetector = null;
  let unlocked = false;

  const on = () => settings.voiceChat || settings.handsFree;

  function end() {
    state = 'idle';
    turn = null;
    clearTimeout(timer);
    timer = 0;
    if (window.speechSynthesis?.speaking || window.speechSynthesis?.pending) {
      window.speechSynthesis.cancel();
    }
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
    state = 'listening';
    const id = openConversationId();
    const current = { id, baseline: undefined };
    turn = current;
    if (id) {
      loadConversations([id])
        .then(([info]) => {
          current.baseline = info?.last_user_message_id ?? null;
        })
        // Without it, there's no telling the reply from the last one.
        .catch(() => {
          if (turn === current) end();
        });
    } else {
      current.baseline = null;
    }
  }

  // Once what you said is in the message box, send it.
  function onStopped() {
    stopListening();
    if (state !== 'listening') return;
    state = 'sending';
    const started = Date.now();
    const trySend = () => {
      if (state !== 'sending') return;
      const mic = findMic();
      const composer = document.querySelector(COMPOSER);
      const send = sendButton(mic);
      const waited = Date.now() - started;
      if (composer?.textContent.trim() && send && !send.disabled && !busy(mic)) {
        send.click();
        state = 'waiting';
        turn.sawActive = false;
        timer = setTimeout(checkReply, REPLY_CHECK_MS);
      } else if (waited < (busy(mic) ? TRANSCRIBE_TIMEOUT_MS : SEND_TIMEOUT_MS)) {
        timer = setTimeout(trySend, SEND_CHECK_MS);
      } else {
        end();
      }
    };
    timer = setTimeout(trySend, SEND_CHECK_MS);
  }

  // The reply is in once the run that answers your message has stopped:
  // the run was seen going, or the agent has added to the conversation since
  // your message.
  async function checkReply() {
    if (state !== 'waiting') return;
    const current = turn;
    current.id ??= openConversationId();
    if (!current.id) {
      timer = setTimeout(checkReply, REPLY_CHECK_MS);
      return;
    }
    const info = await loadConversations([current.id])
      .then(([result]) => result)
      .catch(() => null);
    if (state !== 'waiting' || turn !== current) return;
    const status = info?.execution_status;
    const message = info?.last_user_message_id;
    const answered = message && current.baseline !== undefined && message !== current.baseline;
    if (answered && ACTIVE_STATUSES.has(status)) current.sawActive = true;
    const done =
      answered &&
      (status === 'waiting_for_confirmation' ||
        (!ACTIVE_STATUSES.has(status) &&
          (current.sawActive || (info.leaf_event_id && info.leaf_event_id !== message))));
    if (!done) {
      timer = setTimeout(checkReply, REPLY_CHECK_MS);
      return;
    }
    if (status === 'finished') {
      const result = await host.agentServer
        .request({ path: `/api/conversations/${current.id}/agent_final_response` })
        .catch(() => null);
      if (state !== 'waiting' || turn !== current) return;
      speak(spokenSentences(result?.response ?? ''), true);
    } else if (SAY[status]) {
      speak([SAY[status]], false);
    } else {
      end();
    }
  }

  // Queues the sentences to be read, then, after a reply, listens again if
  // you're still looking at the conversation. end() cancels what's left.
  function speak(sentences, again) {
    const done = () => (again ? listenAgain() : end());
    if (!sentences.length || speechProblem()) {
      done();
      return;
    }
    state = 'speaking';
    const current = turn;
    const synth = window.speechSynthesis;
    synth.cancel();
    sentences.forEach((sentence, index) => {
      const utterance = new window.SpeechSynthesisUtterance(sentence);
      utterance.lang = canvasLanguage();
      if (index === sentences.length - 1) {
        utterance.onend = () => {
          if (state === 'speaking' && turn === current) done();
        };
      }
      synth.speak(utterance);
    });
  }

  function listenAgain() {
    const { id } = turn;
    end();
    const mic = findMic();
    if (document.hidden || openConversationId() !== id) return;
    if (mic && !mic.disabled && !pressed(mic) && !busy(mic)) mic.click();
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
  // takes keys too.
  function onKeyDown(event) {
    if (state === 'idle' || state === 'listening' || state === 'sending') return;
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return;
    end();
  }

  function onMicChange() {
    const mic = findMic();
    const now = pressed(mic);
    if (now !== wasPressed) {
      wasPressed = now;
      if (now) onListen();
      else onStopped();
    }
    // Leaving the conversation ends its turn.
    if (turn?.id && state !== 'idle' && openConversationId() !== turn.id) end();
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
      wasPressed = pressed(findMic());
    } else {
      attributes.disconnect();
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
      stopListening();
      end();
    }
  }

  return {
    refresh() {
      listen(on());
      if (!settings.handsFree) stopListening();
      if (!settings.voiceChat && state !== 'idle') end();
    },
    onDomChange() {
      if (listening) onMicChange();
    },
    dispose() {
      listen(false);
    },
  };
}
