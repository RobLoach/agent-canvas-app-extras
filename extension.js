// Extras: Agent Canvas tweaks, each switched on from this app's card on
// Customize > Apps and saved in the browser's localStorage.
// - Wide Canvas: removes the chat window's maximum width.
// - Tab status: badges the tab's title and icon with the agent's status.
// - Desktop notifications: tells you when a run ends or needs you while
//   you're away from it.
// - Confirmation sound: chimes when a run needs you while you're away from it.
// - App icon badge: counts the conversations waiting on you on the installed
//   app's icon.
// - Title bar colour: matches the installed app's title bar to Canvas's theme.
// - Hide "Running" and "Reading": folds those chat entries into "Thinking"
//   rows that expand to show them, and says "Thinking" on the activity chip.
//
// Each feature is an object with any of refresh() (settings changed),
// onDomChange(), onStorage(key) and dispose(), which activate() calls.

const STORAGE_KEY = 'openhands-extras:settings';
// The running copy's dispose, on the page's window. Canvas disposes an app
// before activating it again, but two copies folding the same chat, e.g.
// after a dispose that failed part way, would undo each other's work forever.
const INSTANCE = Symbol.for('openhands-extras');
// Runs that ended while you were away, shared by every Canvas window and kept
// across reloads until you open them.
const UNSEEN_KEY = 'openhands-extras:unseen';
const SECTION_ID = 'openhands-extras-settings';
const WIDE_STYLE_ID = 'openhands-extras-wide-canvas';
const THEME_META_ID = 'openhands-extras-theme-color';
const QUIET_STYLE_ID = 'openhands-extras-quiet-activity';
const QUIET_ATTR = 'data-extras-quiet';
const SHOWN_ATTR = 'data-extras-shown';
const THINKING_ATTR = 'data-extras-thinking';
const CHIP_LABEL_ATTR = 'data-extras-chip-label';
const EVENT_TITLE = '[data-testid="generic-event-message-title"]';
// Canvas's titles for commands and file reads, before and after, in English
// until its translations for the page's language load.
const QUIET_LABELS = {
  ACTION_MESSAGE$RUN: 'Running <cmd>{{command}}</cmd>',
  ACTION_MESSAGE$RUN_IPYTHON: 'Running a Python command',
  ACTION_MESSAGE$READ: 'Reading <path>{{path}}</path>',
  ACTION_MESSAGE$ACP_RUN: 'Running <cmd>{{title}}</cmd>',
  ACTION_MESSAGE$ACP_READ: 'Reading <cmd>{{title}}</cmd>',
  OBSERVATION_MESSAGE$RUN: 'Ran <cmd>{{command}}</cmd>',
  OBSERVATION_MESSAGE$RUN_IPYTHON: 'Ran a Python command',
  OBSERVATION_MESSAGE$READ: 'Read <path>{{path}}</path>',
};
const THINKING_KEY = 'THINKING$TITLE';

// The chat thread is the only max-w-200 element that is also h-full, so the
// Customize, Settings and home launcher columns keep their width. Unlayered
// CSS beats Tailwind's @layer utilities regardless of specificity.
const WIDE_CANVAS_CSS =
  '[data-agent-server-ui] .max-w-200.h-full.min-h-0 { max-width: none; }';

// Status checks run at most this often, plus a slow poll while a run is going.
const STATUS_MIN_GAP_MS = 3000;
const STATUS_POLL_MS = 15000;
// Otherwise, how often the count of conversations waiting for confirmation is
// refreshed, as runs started elsewhere don't touch this page.
const COUNT_POLL_MS = 30000;
const WAITING_COUNT_PATH =
  '/api/conversations/count?status=waiting_for_confirmation';
const CONVERSATION_PATH = /\/conversations\/([0-9a-f-]{32,36})(?:\/|$)/i;
// Canvas starts the open conversation's title with its own status emoji,
// which Tab status replaces rather than adding a second.
const CANVAS_TITLE_STATUS = /^(?:🟢|✅|⚪|🔴) /u;
const STATUS_BADGES = {
  running: { emoji: '⏳', color: '#3b82f6', label: 'Running' },
  waiting_for_confirmation: {
    emoji: '✋',
    color: '#f59e0b',
    label: 'Needs your confirmation',
  },
  paused: { emoji: '⏸️', color: '#9ca3af', label: 'Paused' },
  finished: { emoji: '✅', color: '#22c55e', label: 'Finished' },
  error: { emoji: '❌', color: '#ef4444', label: 'Stopped with an error' },
  stuck: { emoji: '❌', color: '#ef4444', label: 'Got stuck' },
};
// Active badges show whenever the status holds; the rest only after this tab
// saw the run, until you come back to the tab.
const ACTIVE_STATUSES = new Set(['running', 'waiting_for_confirmation']);
const ENDED_STATUSES = new Set(['finished', 'error', 'stuck']);
const NOTIFY_STATUSES = new Set(['waiting_for_confirmation', ...ENDED_STATUSES]);

// check() says why a switch can't work, e.g. after a permission was revoked;
// enable(), which defaults to it, may also ask the browser for what it needs.
const SWITCHES = [
  {
    key: 'wideCanvas',
    label: 'Wide Canvas',
    description: 'Let the chat window use the full width of the canvas.',
  },
  {
    key: 'tabStatus',
    label: 'Tab status',
    description: "Show the agent's status in the browser tab's title and icon.",
  },
  {
    key: 'notifications',
    label: 'Desktop notifications',
    description:
      'Notify you when the agent finishes or needs you while this tab is in the background.',
    check: notificationProblem,
    enable: requestNotificationPermission,
  },
  {
    key: 'confirmationSound',
    label: 'Confirmation sound',
    description:
      'Play a chime when the agent needs your confirmation while this tab is in the background.',
    enable: unlockAudio,
  },
  {
    key: 'appBadge',
    label: 'App icon badge',
    description:
      "Show how many conversations need your input on the installed app's icon.",
    check: appBadgeProblem,
  },
  {
    key: 'themeColor',
    label: 'Title bar colour',
    description:
      "Match the installed app's title bar to Canvas's colour theme.",
  },
  {
    key: 'quietActivity',
    label: 'Hide "Running" and "Reading"',
    description:
      'Fold the agent\'s "Running" and "Reading" entries in the chat into "Thinking", which expands to show them.',
  },
];
const DEFAULT_SETTINGS = Object.fromEntries(
  SWITCHES.map(({ key }) => [key, false]),
);

// Class strings mirror Canvas's ToggleSwitchVisual (src/ui/toggle-switch.tsx)
// so the switch picks up the same compiled Tailwind styles.
const TRACK_CLASS =
  'relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out motion-reduce:transition-none h-5.5 w-10 border';
const TRACK_ON_CLASS = 'border-contrast bg-contrast';
const TRACK_OFF_CLASS = 'border-border bg-surface-raised';
const THUMB_CLASS =
  'inline-block rounded-full transition-transform duration-200 ease-in-out motion-reduce:transition-none size-4';
const THUMB_ON_CLASS = 'translate-x-5.25 rtl:-translate-x-5.25 bg-base-secondary';
const THUMB_OFF_CLASS = 'translate-x-0.5 rtl:-translate-x-0.5 bg-muted';

let settings = DEFAULT_SETTINGS;

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function loadSettings() {
  settings = { ...DEFAULT_SETTINGS, ...readJson(STORAGE_KEY, {}) };
}

function saveSettings(next) {
  settings = next;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

// One of our own elements in <head>, by id, created on first use.
function headElement(id, tag, { first = false } = {}) {
  let element = document.getElementById(id);
  if (!element) {
    element = document.createElement(tag);
    element.id = id;
    document.head[first ? 'prepend' : 'append'](element);
  }
  return element;
}

const removeElement = (id) => document.getElementById(id)?.remove();

function toggleStyle(id, css, on) {
  if (!on) {
    removeElement(id);
    return;
  }
  const style = headElement(id, 'style');
  if (style.textContent !== css) style.textContent = css;
}

// The elements this app adds to Canvas's page body.
const OWN_SELECTOR = `#${SECTION_ID}, [${THINKING_ATTR}], [${CHIP_LABEL_ATTR}]`;
const ownNode = (node) => node.nodeType === Node.ELEMENT_NODE && node.matches(OWN_SELECTOR);
const ownChange = (record) =>
  !!record.target.closest?.(OWN_SELECTOR) ||
  [...record.addedNodes, ...record.removedNodes].every(ownNode);

const setAttr = (element, name, on) => {
  if (element.hasAttribute(name) !== on) element.toggleAttribute(name, on);
};

const PERMISSION_PROBLEMS = {
  denied: 'Notifications are blocked for this site in your browser settings.',
  default: "Your browser hasn't allowed notifications yet.",
};

function notificationProblem() {
  if (!window.Notification || !window.isSecureContext) {
    return 'Your browser only allows notifications over HTTPS or on localhost.';
  }
  return PERMISSION_PROBLEMS[Notification.permission] ?? null;
}

async function requestNotificationPermission() {
  await window.Notification?.requestPermission();
  return notificationProblem();
}

// Canvas marks <body> as well as its themed root, which carries the theme.
const themeRoot = () =>
  document.querySelector('[data-agent-server-ui][data-color-theme]') ??
  document.querySelector('[data-agent-server-ui]');

// The first opaque background from Canvas's themed root outwards.
function canvasBackground() {
  const root = themeRoot();
  for (const element of [
    root,
    root?.firstElementChild,
    document.body,
    document.documentElement,
  ]) {
    if (!element) continue;
    const color = window.getComputedStyle(element).backgroundColor;
    if (color && color !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(color)) {
      return color;
    }
  }
  return null;
}

// Installed apps colour their title bar from the theme-color meta, which
// Canvas doesn't set. Follow its theme root's attributes, and the system
// scheme for its "system" theme.
function watchThemeColor() {
  let root = null;
  const scheme = window.matchMedia?.('(prefers-color-scheme: dark)');
  const apply = () => {
    const color = settings.themeColor && canvasBackground();
    if (!color) {
      removeElement(THEME_META_ID);
      return;
    }
    const meta = headElement(THEME_META_ID, 'meta', { first: true });
    meta.name = 'theme-color';
    if (meta.content !== color) meta.content = color;
  };
  const observer = new MutationObserver(apply);
  const track = () => {
    const next = settings.themeColor ? themeRoot() : null;
    if (next === root) return;
    root = next;
    observer.disconnect();
    if (root) observer.observe(root, { attributes: true });
    apply();
  };
  scheme?.addEventListener?.('change', apply);
  return {
    onDomChange: track,
    refresh() {
      track();
      apply();
    },
    dispose() {
      observer.disconnect();
      scheme?.removeEventListener?.('change', apply);
      removeElement(THEME_META_ID);
    },
  };
}

const LIGHTBULB_PATH = 'M11.3931 1.88021C10.78 1.37593 10.062 1.01489 9.29157 0.823438C8.52113 0.631981 7.71767 0.614934 6.9398 0.773542C5.90405 0.982756 4.95379 1.49492 4.20959 2.24506C3.46538 2.9952 2.96078 3.9495 2.7598 4.98688C2.61303 5.76469 2.6397 6.56531 2.83791 7.33163C3.03611 8.09795 3.40097 8.8111 3.90647 9.42021C4.37559 9.94959 4.64449 10.6266 4.66647 11.3335V13.3335C4.66647 13.864 4.87718 14.3727 5.25225 14.7478C5.62732 15.1228 6.13603 15.3335 6.66647 15.3335H9.33313C9.86356 15.3335 10.3723 15.1228 10.7473 14.7478C11.1224 14.3727 11.3331 13.864 11.3331 13.3335V11.4602C11.3555 10.6797 11.6423 9.92983 12.1465 9.33354C13.0299 8.24073 13.4463 6.84342 13.3052 5.44529C13.1642 4.04716 12.477 2.7612 11.3931 1.86687V1.88021ZM9.9998 13.3335C9.9998 13.5104 9.92956 13.6799 9.80454 13.8049C9.67951 13.93 9.50994 14.0002 9.33313 14.0002H6.66647C6.48965 14.0002 6.32009 13.93 6.19506 13.8049C6.07004 13.6799 5.9998 13.5104 5.9998 13.3335V12.6669H9.9998V13.3335ZM11.1131 8.50688C10.4428 9.30194 10.0517 10.2949 9.9998 11.3335H8.66647V9.33354C8.66647 9.15673 8.59623 8.98716 8.4712 8.86214C8.34618 8.73711 8.17661 8.66688 7.9998 8.66688C7.82299 8.66688 7.65342 8.73711 7.52839 8.86214C7.40337 8.98716 7.33313 9.15673 7.33313 9.33354V11.3335H5.9998C5.98221 10.3123 5.60443 9.33005 4.93313 8.56021C4.49023 8.02954 4.19239 7.39316 4.06867 6.71311C3.94495 6.03306 3.99957 5.33255 4.22719 4.6799C4.45481 4.02724 4.84768 3.4447 5.36748 2.98909C5.88728 2.53348 6.51627 2.22034 7.19313 2.08021C7.77483 1.96044 8.37591 1.9717 8.95271 2.11319C9.52952 2.25467 10.0676 2.52282 10.5278 2.89818C10.9881 3.27353 11.359 3.74666 11.6136 4.28322C11.8682 4.81978 12.0001 5.4063 11.9998 6.00021C12.0047 6.91345 11.6912 7.79985 11.1131 8.50688Z';
// Canvas's chevrons for its own expandable entries.
const CHEVRON_DOWN_PATH =
  'M201.4 374.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 306.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z';
const CHEVRON_UP_PATH =
  'M201.4 137.4c12.5-12.5 32.8-12.5 45.3 0l160 160c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L224 205.3 86.6 342.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l160-160z';

// A label like "Führt <cmd>{{command}}</cmd> aus" as a pattern for the text
// Canvas renders from it, e.g. "Führt ls -la aus".
function labelPattern(labels) {
  const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sources = Object.values(labels).map((label) =>
    label
      .split(/<(\w+)>\{\{\w+\}\}<\/\1>|\{\{\w+\}\}/)
      .filter((part, index) => index % 2 === 0)
      .map((part) => escape(part.replace(/<[^>]*>/g, '')))
      .join('[\\s\\S]+'),
  );
  return new RegExp(`^(?:${sources.join('|')})$`);
}

// Canvas's own "Thinking" entry, with its chevron and lightbulb, as a toggle
// for the entries it folds.
function buildThinking(onToggle) {
  const row = document.createElement('div');
  row.className = 'my-1 w-full py-1 text-sm';
  row.setAttribute(THINKING_ATTR, '');
  row.innerHTML = `
    <button type="button" aria-expanded="false" class="w-full flex items-center gap-2 text-left cursor-pointer">
      <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" class="h-4 w-4 fill-muted flex-shrink-0"><path/></svg>
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted flex-shrink-0"><path fill="currentColor" d="${LIGHTBULB_PATH}"/></svg>
      <span class="font-normal text-muted"></span>
    </button>`;
  row.querySelector('button').addEventListener('click', (event) => {
    const button = event.currentTarget;
    button.setAttribute('aria-expanded', String(!expanded(row)));
    onToggle();
  });
  return row;
}

const expanded = (thinking) =>
  thinking.firstElementChild.getAttribute('aria-expanded') === 'true';

// Mark the "Running" and "Reading" entries, which a style hides, rather than
// removing nodes React owns, and fold each stretch of them into a "Thinking"
// toggle placed inside the stretch's last chat item, so the chat list's own
// children stay as React rendered them. An entry can share its item with the
// agent's message, so a whole item is only hidden once nothing in it is left
// to show. Timed out commands, the only failures Canvas marks, stay visible.
// The last stretch pulses while the open conversation is running. The body
// observer only watches child lists, so marking doesn't re-trigger it.
function watchQuietActivity(statusOf) {
  let active = false;
  let disposed = false;
  let language = null;
  let quietTitle = labelPattern(QUIET_LABELS);
  let thinkingLabel = 'Thinking';
  // Each stretch's toggle, by the stretch's first chat item.
  let toggles = new WeakMap();
  // Whether the last stretch pulses, for the open conversation running.
  let pulsing = false;
  const running = () => {
    const id = location.pathname.match(CONVERSATION_PATH)?.[1];
    return !!id && statusOf(id) === 'running';
  };

  // Canvas's translations for its UI language, which it keeps on <html lang>,
  // falling back to English.
  function loadLabels() {
    const next = document.documentElement.lang || 'en';
    if (next === language) return;
    language = next;
    quietTitle = labelPattern(QUIET_LABELS);
    thinkingLabel = 'Thinking';
    if (next === 'en') return;
    fetch(`/locales/${encodeURIComponent(next)}/openhands.json`)
      .then((response) => (response.ok ? response.json() : {}))
      .then((translations) => {
        if (disposed || language !== next) return;
        quietTitle = labelPattern(
          Object.fromEntries(
            Object.entries(QUIET_LABELS).map(([key, label]) => [
              key,
              translations[key] ?? label,
            ]),
          ),
        );
        thinkingLabel = translations[THINKING_KEY] ?? thinkingLabel;
        apply();
      })
      .catch(() => {});
  }

  function reveal() {
    for (const element of document.querySelectorAll(
      `[${QUIET_ATTR}], [${SHOWN_ATTR}]`,
    )) {
      element.removeAttribute(QUIET_ATTR);
      element.removeAttribute(SHOWN_ATTR);
    }
    for (const ours of document.querySelectorAll(
      `[${THINKING_ATTR}], [${CHIP_LABEL_ATTR}]`,
    )) {
      ours.remove();
    }
    toggleStyle(QUIET_STYLE_ID, '', false);
    toggles = new WeakMap();
  }

  // Each chat item's event rows, the quiet ones among them, and whether
  // they're all it shows.
  function readItem(item) {
    const rows = [];
    const quiet = [];
    for (const title of item.querySelectorAll(EVENT_TITLE)) {
      // Only a row inside the item: were Canvas to drop a wrapper, this would
      // otherwise hide the item, or the whole chat.
      const row = title.parentElement?.parentElement;
      if (!row || row === item || !item.contains(row)) continue;
      rows.push(row);
      if (
        quietTitle.test(title.textContent.trim()) &&
        !row.querySelector('[data-testid="status-icon"]')
      ) {
        quiet.push(row);
      }
    }
    const children = [...item.children].filter(
      (child) => !child.hasAttribute(THINKING_ATTR),
    );
    const whole =
      children.length > 0 && children.every((child) => quiet.includes(child));
    return { item, rows, quiet, whole };
  }

  // Runs of items with quiet rows: a stretch starts at any item with some,
  // and carries on through items with nothing else.
  function stretches(items) {
    const found = [];
    let current = null;
    for (const entry of items) {
      if (!entry.quiet.length || !entry.whole) {
        if (current) found.push(current);
        current = entry.quiet.length ? [entry] : null;
      } else {
        (current ??= []).push(entry);
      }
    }
    if (current) found.push(current);
    return found;
  }

  // The live activity chip above the message box says "Running …" too: show
  // "Thinking" in a label of ours beside Canvas's, which React keeps updating.
  function relabelChip() {
    const chip = document.querySelector('[data-testid="live-activity-chip"]');
    if (!chip) return;
    let ours = chip.querySelector(`:scope > [${CHIP_LABEL_ATTR}]`);
    const label = [...chip.children].findLast((child) => child !== ours);
    const quiet = !!label && quietTitle.test(label.textContent.trim());
    if (label) setAttr(label, QUIET_ATTR, quiet);
    if (!quiet) {
      ours?.remove();
      return;
    }
    if (!ours) {
      ours = document.createElement('span');
      ours.className = label.className;
      ours.setAttribute(CHIP_LABEL_ATTR, '');
    }
    if (ours.textContent !== thinkingLabel) ours.textContent = thinkingLabel;
    if (label.nextElementSibling !== ours) label.after(ours);
  }

  function apply() {
    if (disposed) return;
    if (!settings.quietActivity) {
      if (active) reveal();
      active = false;
      return;
    }
    active = true;
    loadLabels();
    toggleStyle(
      QUIET_STYLE_ID,
      `[${QUIET_ATTR}]:not([${SHOWN_ATTR}]) { display: none !important; }`,
      true,
    );
    relabelChip();
    const chat = document.querySelector('[data-testid="chat-scroll-container"]');
    if (!chat) return;
    const items = [...chat.children].map(readItem);
    pulsing = running();
    // Hide whole items, except the last of each stretch, which holds the
    // toggle and hides just its rows.
    const hidden = new Map();
    const used = new Set();
    for (const stretch of stretches(items)) {
      const last = stretch.at(-1);
      let thinking = toggles.get(stretch[0].item);
      if (!thinking) {
        thinking = buildThinking(apply);
        toggles.set(stretch[0].item, thinking);
      }
      used.add(thinking);
      const open = expanded(thinking);
      for (const entry of stretch) {
        const nodes = entry.whole && entry !== last ? [entry.item] : entry.quiet;
        for (const node of nodes) hidden.set(node, open);
      }
      const path = open ? CHEVRON_UP_PATH : CHEVRON_DOWN_PATH;
      const chevron = thinking.querySelector('path');
      if (chevron.getAttribute('d') !== path) chevron.setAttribute('d', path);
      const label = thinking.querySelector('span');
      if (label.textContent !== thinkingLabel) label.textContent = thinkingLabel;
      label.classList.toggle('animate-pulse', pulsing && last === items.at(-1));
      if (last.item.lastElementChild !== thinking) last.item.append(thinking);
    }
    for (const { item, rows } of items) {
      for (const node of [item, ...rows]) {
        setAttr(node, QUIET_ATTR, hidden.has(node));
        setAttr(node, SHOWN_ATTR, hidden.get(node) === true);
      }
    }
    for (const thinking of chat.querySelectorAll(`[${THINKING_ATTR}]`)) {
      if (!used.has(thinking)) thinking.remove();
    }
  }

  return {
    onDomChange: apply,
    refresh: apply,
    // Statuses are checked every few seconds; only the open conversation
    // starting or stopping changes anything here.
    onStatus() {
      if (active && running() !== pulsing) apply();
    },
    dispose() {
      disposed = true;
      reveal();
      active = false;
    },
  };
}

function appBadgeProblem() {
  return window.navigator.setAppBadge
    ? null
    : "Your browser doesn't support app icon badges.";
}

// Browsers only let audio start after a click on the page, so the context is
// created when the switch is turned on; any later click unlocks it too.
let audio = null;
function unlockAudio() {
  const Context = window.AudioContext ?? window.webkitAudioContext;
  if (!Context) return 'Your browser does not support playing sounds.';
  audio ??= new Context();
  audio.resume?.();
  return null;
}

function closeAudio() {
  if (!audio) return;
  Promise.resolve(audio.close?.()).catch(() => {});
  audio = null;
}

// Two short falling tones, made on the fly so the app needs no sound file.
function playChime() {
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

// Final responses are Markdown, which notifications show as raw text. Strip
// the syntax and cut on a word boundary without splitting an emoji.
function plainText(markdown, max = 200) {
  const text = markdown
    .replace(/```[\s\S]*?(?:```|$)/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*([-*_])(?:\s*\1){2,}\s*$/gm, ' ')
    .replace(/^\s{0,3}(?:#{1,6}|>|[-*+]|\d+[.)])\s+/gm, '')
    .replace(/\*+|~~|`+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  const cut = chars.slice(0, max).join('');
  const space = cut.lastIndexOf(' ');
  return `${(space > cut.length / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

// Notify about a run's new status, with the agent's final reply when it
// finished. Clicking opens the run, which may not be the one on screen.
async function notify(host, { id, title, status, icon, isOpen, isDisposed }) {
  if (window.Notification?.permission !== 'granted') return;
  let body = STATUS_BADGES[status].label;
  if (status === 'finished') {
    const result = await host.agentServer
      .request({ path: `/api/conversations/${id}/agent_final_response` })
      .catch(() => null);
    if (result?.response) body = plainText(result.response) || body;
  }
  if (isDisposed()) return;
  const notification = new Notification(title || 'OpenHands', {
    body,
    tag: `openhands-extras-${id}`,
    icon,
  });
  notification.onclick = () => {
    window.focus();
    if (!isOpen()) host.navigate(`/conversations/${id}`);
    notification.close();
  };
}

function buildSwitch(item, onChange) {
  const block = document.createElement('div');
  block.className = 'flex min-w-0 flex-col gap-1';
  block.innerHTML = `
    <label class="flex items-center gap-2 rounded-sm has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus w-fit cursor-pointer">
      <input class="sr-only" type="checkbox" data-testid="extras-${item.key}-switch" aria-describedby="extras-${item.key}-hint" />
      <span aria-hidden="true"><span></span></span>
      <div class="flex items-center gap-1">
        <span class="text-sm"></span>
      </div>
    </label>
    <p id="extras-${item.key}-hint" class="text-xs leading-relaxed text-tertiary-light"></p>`;

  const input = block.querySelector('input');
  const track = input.nextElementSibling;
  const hint = block.querySelector('p');
  const enable = item.enable ?? item.check;
  block.querySelector('.text-sm').textContent = item.label;
  const render = () => {
    track.className = `${TRACK_CLASS} ${input.checked ? TRACK_ON_CLASS : TRACK_OFF_CLASS}`;
    track.firstElementChild.className = `${THUMB_CLASS} ${input.checked ? THUMB_ON_CLASS : THUMB_OFF_CLASS}`;
  };
  input.checked = settings[item.key];
  hint.textContent = (input.checked && item.check?.()) || item.description;
  render();
  input.addEventListener('change', async () => {
    const problem = input.checked && enable ? await enable() : null;
    if (problem) input.checked = false;
    hint.textContent = problem ?? item.description;
    render();
    onChange({ ...settings, [item.key]: input.checked });
  });
  return block;
}

// App cards on Customize > Apps have no host API for settings, so add a
// section above this app's card footer. React may insert its own nodes
// before the footer later, so re-place the section whenever it's displaced,
// and rebuild it when another tab changes the settings.
function watchAppCard(name, onChange) {
  const cardSelector = `article[data-testid="canvas-extension-card-${name}"]`;
  function place() {
    // Skip the DOM search everywhere but Customize > Apps (e.g. while chatting).
    if (!/\/apps\/?$/.test(location.pathname)) return;
    const footer = document.querySelector(`${cardSelector} > footer`);
    if (!footer || footer.previousElementSibling?.id === SECTION_ID) return;
    removeElement(SECTION_ID);
    const section = document.createElement('section');
    section.id = SECTION_ID;
    section.className = 'flex min-w-0 flex-col gap-4 border-t border-border pt-3';
    section.append(...SWITCHES.map((item) => buildSwitch(item, onChange)));
    footer.before(section);
  }
  place();
  return {
    onDomChange: place,
    onStorage(key) {
      if (key !== STORAGE_KEY) return;
      removeElement(SECTION_ID);
      place();
    },
    dispose: () => removeElement(SECTION_ID),
  };
}

const wideCanvas = () => ({
  refresh: () => toggleStyle(WIDE_STYLE_ID, WIDE_CANVAS_CSS, settings.wideCanvas),
  dispose: () => toggleStyle(WIDE_STYLE_ID, '', false),
});

// Edit the <title>'s text node in place: replacing it (document.title = …)
// would detach the node React updates and freeze Canvas's own titles.
function setTitle(text) {
  const element = document.head.querySelector('title');
  const node = element?.firstChild;
  if (node && node === element.lastChild && node.nodeType === Node.TEXT_NODE) {
    node.nodeValue = text;
  }
}

async function loadDataUrl(url) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// A coloured dot on the tab icon, holding a count when there is one. It swaps
// the href of Canvas's own icon links: browsers don't reliably switch to an
// extra icon link, and React owns these elements, so they must not be
// removed. Their original hrefs come back when it clears.
function faviconBadge() {
  const originalHrefs = new WeakMap();
  const badgedHrefs = new Set();
  let href = null;
  let shown = null;
  // Canvas's icon as a data URL, for the icon URL it was loaded from.
  let source = null;
  let sourceUrl;
  const links = () => document.head.querySelectorAll('link[rel~="icon"]');

  function originalUrl() {
    const link = links()[0];
    const original = link && (originalHrefs.get(link) ?? link.getAttribute('href'));
    return original ? new URL(original, document.baseURI).href : undefined;
  }

  // Also re-run when Canvas adds an icon link or React rewrites its href.
  function apply() {
    for (const link of links()) {
      const current = link.getAttribute('href');
      if (!badgedHrefs.has(current)) originalHrefs.set(link, current);
      const next = href ?? originalHrefs.get(link);
      if (next && current !== next) link.setAttribute('href', next);
    }
  }

  async function show(color, count) {
    const key = color && `${color}|${count}`;
    if (key === shown) return;
    shown = key;
    if (!key) {
      href = null;
      apply();
      return;
    }
    const url = originalUrl();
    if (url !== sourceUrl) {
      sourceUrl = url;
      source = loadDataUrl(url);
    }
    const image = await source;
    // Try again next time rather than keep a failed load.
    if (!image) sourceUrl = undefined;
    if (shown !== key) return;
    const background = image
      ? `<image href="${image}" width="32" height="32"/>`
      : '';
    const dot = count
      ? `<circle cx="22" cy="22" r="10" fill="${color}" stroke="#fff" stroke-width="2"/><text x="22" y="22" fill="#fff" font-family="sans-serif" font-size="${count > 9 ? 11 : 14}" font-weight="700" text-anchor="middle" dominant-baseline="central">${count > 9 ? '9+' : count}</text>`
      : `<circle cx="24" cy="24" r="7" fill="${color}" stroke="#fff" stroke-width="2"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${background}${dot}</svg>`;
    href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    badgedHrefs.add(href);
    apply();
  }

  return { show, apply, originalUrl };
}

// Follow the open conversation's status, and runs this tab saw that you've
// since navigated away from, to badge the tab and app icon and to notify when
// a run ends or needs you while you're away from it. Canvas re-renders the
// chat as events stream in, background tabs included, so DOM changes trigger
// checks; onRender runs after every change in what's known.
function watchAgentStatus(host, onRender) {
  const conversations = new Map();
  const favicon = faviconBadge();
  let openId = null;
  // The title we last set, and the one of Canvas's it came from.
  let appliedTitle = null;
  let appliedBadge = null;
  // Conversations waiting for confirmation anywhere, from the Agent Server.
  let waiting = 0;
  let lastCheck = 0;
  let trailing = 0;
  let poll = 0;
  let inFlight = false;
  let again = false;
  let disposed = false;

  // A browser window behind another app often still counts as visible.
  const away = () => document.hidden || !document.hasFocus();
  const watching = () =>
    settings.tabStatus ||
    settings.notifications ||
    settings.confirmationSound ||
    settings.appBadge ||
    settings.quietActivity;
  // The count of conversations that need your input feeds the app icon badge
  // and the tab icon.
  const counting = () => settings.tabStatus || settings.appBadge;
  const loadUnseen = () => {
    const ids = readJson(UNSEEN_KEY, []);
    return new Set(Array.isArray(ids) ? ids : []);
  };
  const needsYou = () =>
    !disposed && counting() ? waiting + loadUnseen().size : 0;

  function markUnseen(id, unseen) {
    const ids = loadUnseen();
    if (ids.has(id) === unseen) return;
    if (unseen) ids.add(id);
    else ids.delete(id);
    try {
      if (ids.size) localStorage.setItem(UNSEEN_KEY, JSON.stringify([...ids]));
      else localStorage.removeItem(UNSEEN_KEY);
    } catch {
      // Storage full or blocked: the badge just won't count this run.
    }
  }

  function badge() {
    const open = settings.tabStatus && conversations.get(openId);
    const current = open && STATUS_BADGES[open.status];
    return current && (ACTIVE_STATUSES.has(open.status) || open.sawActive)
      ? current
      : null;
  }

  // The open conversation's badge, plus how many runs you opened in this tab
  // are still going elsewhere: "⏳3" when the open one is running too, or
  // "✅ ⏳2" when it isn't. A lone badge is skipped when the title already
  // starts with the same emoji, and there's none without either.
  function titlePrefix(title) {
    const emoji = badge()?.emoji;
    const others = [...conversations].filter(
      ([id, entry]) => id !== openId && ACTIVE_STATUSES.has(entry.status),
    ).length;
    if (!others) {
      if (!emoji) return null;
      return title.startsWith(emoji) ? '' : `${emoji} `;
    }
    if (emoji === STATUS_BADGES.running.emoji) return `${emoji}${others + 1} `;
    return `${emoji ? `${emoji} ` : ''}${STATUS_BADGES.running.emoji}${others} `;
  }

  // Work from Canvas's own title, which is the current one unless it's still
  // the one we set. Our badge replaces Canvas's status emoji, and either is
  // dropped when the conversation's title itself starts with it.
  function renderTitle() {
    const current = document.title;
    const base = current === appliedTitle?.title ? appliedTitle.base : current;
    let next = base;
    if (settings.tabStatus && !disposed) {
      const canvasStatus = base.match(CANVAS_TITLE_STATUS)?.[0] ?? '';
      const rest = base.slice(canvasStatus.length);
      const prefix =
        titlePrefix(rest) ??
        (rest.startsWith(canvasStatus.trim()) ? '' : canvasStatus);
      next = prefix + rest;
    }
    appliedTitle = next === base ? null : { title: next, base };
    if (current !== next) setTitle(next);
  }

  // One badge for the whole installed app, which only shows outside a
  // browser tab: the conversations waiting for confirmation, plus the runs
  // that ended while you were away until you open them.
  function renderBadge() {
    const count = settings.appBadge ? needsYou() : 0;
    if (count === appliedBadge) return;
    appliedBadge = count;
    const { navigator } = window;
    const call = count
      ? navigator.setAppBadge?.(count)
      : navigator.clearAppBadge?.();
    call?.catch(() => {});
  }

  function render() {
    renderTitle();
    // The tab icon's dot takes the open conversation's colour, and holds the
    // number of conversations that need your input when there are any.
    const count = settings.tabStatus ? needsYou() : 0;
    favicon.show(
      badge()?.color ??
        (count ? STATUS_BADGES.waiting_for_confirmation.color : null),
      count,
    );
    renderBadge();
    if (!disposed) onRender();
  }

  function update(id, info) {
    const entry = conversations.get(id);
    if (!entry) return;
    const previous = entry.status;
    const next = info.execution_status;
    entry.status = next;
    entry.title = info.title || entry.title;
    if (ACTIVE_STATUSES.has(next)) entry.sawActive = true;
    if (!ENDED_STATUSES.has(next)) markUnseen(id, false);
    const changedWhileAway =
      previous &&
      previous !== next &&
      entry.sawActive &&
      (id !== openId || away());
    if (!changedWhileAway) return;
    if (counting() && ENDED_STATUSES.has(next)) markUnseen(id, true);
    if (settings.notifications && NOTIFY_STATUSES.has(next)) {
      notify(host, {
        id,
        title: entry.title,
        status: next,
        icon: favicon.originalUrl(),
        isOpen: () => id === openId,
        isDisposed: () => disposed,
      }).catch(() => {});
    }
    if (settings.confirmationSound && next === 'waiting_for_confirmation') {
      playChime();
    }
  }

  async function check() {
    lastCheck = Date.now();
    if (inFlight) {
      again = true;
      return;
    }
    const nextOpenId = watching()
      ? (location.pathname.match(CONVERSATION_PATH)?.[1] ?? null)
      : null;
    if (nextOpenId !== openId) {
      openId = nextOpenId;
      if (openId && !conversations.has(openId)) {
        conversations.set(openId, { status: null, title: '', sawActive: false });
      }
      render();
    }
    if (openId && !away()) markUnseen(openId, false);
    for (const [id, entry] of conversations) {
      const followRun = watching() && ACTIVE_STATUSES.has(entry.status);
      if (id !== openId && !followRun) conversations.delete(id);
    }
    // Unseen runs are checked too, to drop ones resumed or deleted elsewhere.
    const unseen = counting()
      ? [...loadUnseen()].filter((id) => !conversations.has(id))
      : [];
    const ids = [...conversations.keys(), ...unseen];
    if (ids.length || counting()) {
      inFlight = true;
      try {
        // One request for every conversation followed; missing ones are null.
        const query = ids.map((id) => `ids=${id}`).join('&');
        const [infos, count] = await Promise.all([
          ids.length
            ? host.agentServer.request({ path: `/api/conversations?${query}` })
            : [],
          counting()
            ? host.agentServer
                .request({ path: WAITING_COUNT_PATH })
                .catch(() => waiting)
            : 0,
        ]);
        // Anything but a list would read as every run gone: keep what's known.
        if (!Array.isArray(infos)) throw new Error('Unexpected statuses');
        if (!disposed) {
          waiting = Number(count) || 0;
          ids.forEach((id, index) => {
            const info = infos[index];
            if (conversations.has(id)) {
              if (info) update(id, info);
            } else if (!ENDED_STATUSES.has(info?.execution_status)) {
              markUnseen(id, false);
            }
          });
        }
      } catch {
        // Keep the last known statuses; the next check retries.
      } finally {
        inFlight = false;
      }
      if (disposed) return;
      render();
    }
    schedulePoll();
    if (again) {
      again = false;
      requestCheck();
    }
  }

  // Poll quickly while a run is going: runs you navigated away from don't
  // re-render this page, and a run's last event can land between checks.
  // Poll slowly while counting, for runs started elsewhere. Otherwise, page
  // changes and coming back to the tab trigger checks.
  function schedulePoll() {
    clearTimeout(poll);
    const running = [...conversations.values()].some((entry) =>
      ACTIVE_STATUSES.has(entry.status),
    );
    const wait = running ? STATUS_POLL_MS : counting() ? COUNT_POLL_MS : 0;
    poll = wait ? setTimeout(requestCheck, wait) : 0;
  }

  function requestCheck() {
    const wait = lastCheck + STATUS_MIN_GAP_MS - Date.now();
    if (wait <= 0) {
      check().catch(() => {});
    } else if (!trailing) {
      trailing = setTimeout(() => {
        trailing = 0;
        check().catch(() => {});
      }, wait);
    }
  }

  // Coming back to the tab or window clears the finished/error/paused badges.
  function onReturn() {
    if (away() || !watching()) return;
    const open = conversations.get(openId);
    if (open && !ACTIVE_STATUSES.has(open.status)) open.sawActive = false;
    if (openId) markUnseen(openId, false);
    render();
    requestCheck();
  }

  // Canvas rewrites the title on navigation, and may add icon links or reset
  // their href; re-apply the badge to both.
  const headObserver = new MutationObserver(() => {
    favicon.apply();
    renderTitle();
  });
  headObserver.observe(document.head, {
    childList: true,
    characterData: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href'],
  });
  document.addEventListener('visibilitychange', onReturn);
  window.addEventListener('focus', onReturn);

  return {
    statusOf: (id) => conversations.get(id)?.status ?? null,
    onDomChange() {
      if (watching()) requestCheck();
    },
    // Another window marked or cleared a run: the open one can't be unseen
    // while you're looking at it.
    onStorage(key) {
      if (key !== UNSEEN_KEY) return;
      if (openId && !away()) markUnseen(openId, false);
      render();
    },
    // Also runs the first check, as activate() applies the initial settings.
    refresh() {
      if (!counting()) localStorage.removeItem(UNSEEN_KEY);
      render();
      lastCheck = 0;
      requestCheck();
    },
    dispose() {
      disposed = true;
      headObserver.disconnect();
      clearTimeout(trailing);
      clearTimeout(poll);
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
      openId = null;
      conversations.clear();
      render();
    },
  };
}

export function activate(host) {
  if (host.apiVersion !== '1') {
    throw new Error(`Extras requires host API 1, got ${host.apiVersion}.`);
  }
  window[INSTANCE]?.();
  loadSettings();
  // Hiding "Running" and "Reading" pulses on the open conversation's status.
  const quietActivity = watchQuietActivity((id) => agentStatus.statusOf(id));
  const agentStatus = watchAgentStatus(host, () => quietActivity.onStatus());
  // In dispose order: the agent status re-renders as it goes, so it comes
  // before what it re-renders.
  const features = [
    watchAppCard(host.extension.name, (next) => {
      saveSettings(next);
      each('refresh');
    }),
    wideCanvas(),
    agentStatus,
    watchThemeColor(),
    quietActivity,
  ];
  function each(method, ...args) {
    for (const feature of features) feature[method]?.(...args);
  }
  // Settings changed in another tab apply here too.
  const onStorage = ({ key }) => {
    if (key === STORAGE_KEY) loadSettings();
    each('onStorage', key);
    if (key === STORAGE_KEY) each('refresh');
  };
  window.addEventListener('storage', onStorage);
  each('refresh');
  // One body observer for all: Canvas renders the app card on Customize >
  // Apps, re-renders the chat as a run's events stream in, and may re-mount
  // its themed root. Changes to only our own elements are the features'
  // doing, and would just run them again for nothing.
  const observer = new MutationObserver((records) => {
    if (!records.every(ownChange)) each('onDomChange');
  });
  observer.observe(document.body, { childList: true, subtree: true });
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (window[INSTANCE] === dispose) delete window[INSTANCE];
    observer.disconnect();
    window.removeEventListener('storage', onStorage);
    each('dispose');
    closeAudio();
  };
  window[INSTANCE] = dispose;
  return dispose;
}
